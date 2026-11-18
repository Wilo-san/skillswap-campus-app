"""API REST FastAPI : mêmes routes et mêmes formats JSON que le frontend React."""
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from . import services as S
from .config import ADMIN_EMAIL, ADMIN_PASSWORD, DEFAULT_CATEGORIES
from .db import SessionLocal, get_db
from .models import (
    Booking,
    Category,
    CreditMovement,
    Dispute,
    DisputeMessage,
    Offer,
    Review,
    Slot,
    User,
)
from .security import create_token, decode_token, hash_password, verify_password
from .schemas import (
    ActiveIn,
    BookingIn,
    CategoryIn,
    DisputeIn,
    HiddenIn,
    LoginIn,
    MessageIn,
    OfferIn,
    ProfileIn,
    ReasonIn,
    RegisterIn,
    ResolveIn,
    ReviewIn,
    SlotIn,
    StatusIn,
)
from .serializers import (
    booking_view,
    iso_local_naive,
    iso_utc,
    movement_view,
    offer_view,
    rating_of,
    user_public,
)

app = FastAPI(title="SkillSwap Campus API", version="1.0.0")

# Le frontend tourne sur un autre port : on autorise les appels cross-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Gestion des erreurs : le frontend affiche le champ « error »
# --------------------------------------------------------------------------
@app.exception_handler(S.AppError)
async def app_error_handler(_request: Request, exc: S.AppError):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_request: Request, _exc: IntegrityError):
    return JSONResponse(
        status_code=409, content={"error": "Opération en doublon refusée."}
    )


# --------------------------------------------------------------------------
# Authentification
# --------------------------------------------------------------------------
def current_user_optional(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    user_id = decode_token(authorization[7:])
    if user_id is None:
        return None
    user = db.get(User, user_id)
    if user is None or not user.active:
        return None
    return user


def current_user(user: User | None = Depends(current_user_optional)) -> User:
    if user is None:
        S.fail("Veuillez vous connecter.", 401)
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        S.fail("Accès réservé à l’administrateur.", 403)
    return user


# --------------------------------------------------------------------------
# Outils
# --------------------------------------------------------------------------
def parse_dt(value: str) -> datetime:
    """Accepte « 2026-11-20T17:00:00.000Z » et renvoie une date UTC naïve."""
    text = (value or "").strip()
    if not text:
        S.fail("Date de début invalide.")
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(
            tzinfo=None, microsecond=0
        )
    except ValueError:
        S.fail("Date de début invalide.")


def validate_offer(db: Session, payload: OfferIn) -> None:
    if not payload.title.strip() or not payload.skill.strip() or not payload.description.strip():
        S.fail("Titre, compétence et description sont obligatoires.")
    if payload.category_id is None or db.get(Category, payload.category_id) is None:
        S.fail("Catégorie invalide.")
    if payload.level not in ("Débutant", "Intermédiaire", "Avancé"):
        S.fail("Niveau invalide.")
    if payload.duration not in (1, 2):
        S.fail("La durée doit être de 1 ou 2 heures.")
    if payload.mode not in ("Présentiel", "À distance"):
        S.fail("Mode de déroulement invalide.")


# --------------------------------------------------------------------------
# Démarrage : catégories par défaut et compte administrateur
# --------------------------------------------------------------------------
@app.on_event("startup")
def ensure_seed_data() -> None:
    """Crée les catégories par défaut et le compte administrateur."""
    db = SessionLocal()
    try:
        _seed_defaults(db)
    except OperationalError as exc:
        raise RuntimeError(
            "La base de données n'est pas initialisée.\n"
            "Lancez d'abord :  python -m alembic upgrade head"
        ) from exc
    finally:
        db.close()


def _seed_defaults(db: Session) -> None:
    """Catégories par défaut et compte administrateur (idempotent)."""
    for name in DEFAULT_CATEGORIES:
        if not db.execute(select(Category.id).where(Category.name == name)).first():
            db.add(Category(name=name))

    if not db.execute(select(User.id).where(User.role == "admin")).first():
        db.add(
            User(
                email=ADMIN_EMAIL.lower(),
                password_hash=hash_password(ADMIN_PASSWORD),
                first_name="Admin",
                last_name="SkillSwap",
                field="Administration",
                role="admin",
                balance=0,
            )
        )
    db.commit()


@app.get("/api/health")
def health():
    return {"ok": True}


# --------------------------------------------------------------------------
# Authentification et profils
# --------------------------------------------------------------------------
@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        S.fail("Adresse e-mail invalide.")
    if len(payload.password or "") < 8:
        S.fail("Le mot de passe doit contenir au moins 8 caractères.")
    if not payload.first_name.strip() or not payload.last_name.strip():
        S.fail("Nom et prénom obligatoires.")
    if db.execute(select(User.id).where(User.email == email)).first():
        S.fail("Cette adresse e-mail est déjà utilisée.", 409)

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        field=(payload.field or "").strip(),
        balance=2,  # RG01 : 2 crédits de bienvenue, une seule fois
    )
    db.add(user)
    db.flush()
    db.add(
        CreditMovement(
            user_id=user.id,
            type="bienvenue",
            amount=2,
            note="Crédits de bienvenue",
        )
    )
    db.flush()
    return {"token": create_token(user.id), "user": user_public(user)}


@app.post("/api/auth/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    user = db.execute(select(User).where(User.email == email)).scalars().first()
    if user is None or not verify_password(payload.password or "", user.password_hash):
        S.fail("Identifiants incorrects.", 401)
    if not user.active:
        S.fail("Ce compte est désactivé.", 403)
    return {"token": create_token(user.id), "user": user_public(user)}


@app.get("/api/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {**user_public(user), "rating": rating_of(db, user.id)}


@app.put("/api/me")
def update_me(
    payload: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    if not payload.first_name.strip() or not payload.last_name.strip():
        S.fail("Nom et prénom obligatoires.")
    user.first_name = payload.first_name.strip()
    user.last_name = payload.last_name.strip()
    user.field = (payload.field or "").strip()
    user.offered_skills = (payload.offered_skills or "").strip()
    user.wanted_skills = (payload.wanted_skills or "").strip()
    db.flush()
    return user_public(user)


@app.get("/api/users/{user_id}")
def public_profile(
    user_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    target = db.get(User, user_id)
    if target is None:
        S.fail("Profil introuvable.", 404)
    reviews = db.execute(
        select(Review, User)
        .join(User, User.id == Review.author_id)
        .where(Review.target_id == user_id)
        .order_by(Review.created_at.desc())
    ).all()
    return {
        "id": target.id,
        "first_name": target.first_name,
        "last_name": target.last_name,
        "field": target.field,
        "offered_skills": target.offered_skills,
        "wanted_skills": target.wanted_skills,
        "rating": rating_of(db, target.id),
        "reviews": [
            {
                "rating": review.rating,
                "comment": review.comment,
                "created_at": iso_local_naive(review.created_at),
                "first_name": author.first_name,
                "last_name": author.last_name,
            }
            for review, author in reviews
        ],
    }


# --------------------------------------------------------------------------
# Catégories
# --------------------------------------------------------------------------
@app.get("/api/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = db.execute(select(Category).order_by(Category.name)).scalars().all()
    return [{"id": c.id, "name": c.name} for c in rows]


@app.post("/api/categories")
def create_category(
    payload: CategoryIn, _admin: User = Depends(admin_user), db: Session = Depends(get_db)
):
    name = payload.name.strip()
    if not name:
        S.fail("Nom de catégorie obligatoire.")
    if db.execute(select(Category.id).where(Category.name == name)).first():
        S.fail("Cette catégorie existe déjà.", 409)
    category = Category(name=name)
    db.add(category)
    db.flush()
    return {"id": category.id, "name": category.name}


@app.put("/api/categories/{category_id}")
def rename_category(
    category_id: int,
    payload: CategoryIn,
    _admin: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    category = db.get(Category, category_id)
    if category is None:
        S.fail("Catégorie introuvable.", 404)
    name = payload.name.strip()
    if not name:
        S.fail("Nom de catégorie obligatoire.")
    category.name = name
    return {"ok": True}


@app.delete("/api/categories/{category_id}")
def delete_category(
    category_id: int, _admin: User = Depends(admin_user), db: Session = Depends(get_db)
):
    if db.execute(select(Offer.id).where(Offer.category_id == category_id)).first():
        S.fail("Catégorie utilisée par des offres : suppression impossible.")
    category = db.get(Category, category_id)
    if category is None:
        S.fail("Catégorie introuvable.", 404)
    db.delete(category)
    return {"ok": True}


# --------------------------------------------------------------------------
# Offres
# --------------------------------------------------------------------------
@app.get("/api/offers")
def list_offers(
    q: str | None = None,
    category_id: int | None = None,
    level: str | None = None,
    mode: str | None = None,
    date: str | None = None,
    suggestions: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    rows = db.execute(
        select(Offer)
        .join(User, User.id == Offer.owner_id)
        .where(
            Offer.status == "publiée",
            Offer.hidden.is_(False),
            User.active.is_(True),
            Offer.owner_id != user.id,
        )
        .order_by(Offer.created_at.desc())
    ).scalars().all()

    views = []
    for offer in rows:
        view = offer_view(db, offer, user)
        # On ne garde que les créneaux libres et futurs
        view["slots"] = [s for s in view["slots"] if not s["taken"] and s["start_at"] > iso_utc(now)]
        if view["slots"]:
            views.append(view)

    if category_id:
        views = [v for v in views if v["category_id"] == category_id]
    if level:
        views = [v for v in views if v["level"] == level]
    if mode:
        views = [v for v in views if v["mode"] == mode]
    if q:
        needle = q.lower()
        views = [
            v
            for v in views
            if needle in f"{v['skill']} {v['title']} {v['description']}".lower()
        ]
    if date:
        views = [v for v in views if any(s["start_at"][:10] == date for s in v["slots"])]
    if suggestions == "1":
        wanted = [
            w.strip().lower()
            for w in (user.wanted_skills or "").replace(";", ",").replace("\n", ",").split(",")
            if w.strip()
        ]
        views = [
            v
            for v in views
            if any(
                w in v["skill"].lower()
                or v["skill"].lower() in w
                or (v["category"] or "").lower() == w
                or w in v["title"].lower()
                for w in wanted
            )
        ]
    return views


@app.get("/api/offers/mine")
def my_offers(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Offer).where(Offer.owner_id == user.id).order_by(Offer.created_at.desc())
    ).scalars().all()
    return [offer_view(db, o, user) for o in rows]


@app.get("/api/offers/{offer_id}")
def get_offer(
    offer_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    offer = db.get(Offer, offer_id)
    if offer is None:
        S.fail("Offre introuvable.", 404)
    if offer.owner_id != user.id and user.role != "admin":
        if offer.status != "publiée" or offer.hidden:
            S.fail("Offre introuvable.", 404)
    return offer_view(db, offer, user)


@app.post("/api/offers", status_code=201)
def create_offer(
    payload: OfferIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    validate_offer(db, payload)
    offer = Offer(
        owner_id=user.id,
        category_id=payload.category_id,
        title=payload.title.strip(),
        skill=payload.skill.strip(),
        description=payload.description.strip(),
        level=payload.level,
        duration=payload.duration,
        mode=payload.mode,
        status="brouillon",
    )
    db.add(offer)
    db.flush()
    return {"id": offer.id}


@app.put("/api/offers/{offer_id}")
def update_offer(
    offer_id: int,
    payload: OfferIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    offer = db.get(Offer, offer_id)
    if offer is None or offer.owner_id != user.id:
        S.fail("Offre introuvable.", 404)
    validate_offer(db, payload)

    # RG17 : la durée ne peut plus changer si une séance est déjà acceptée
    if payload.duration != offer.duration and db.execute(
        select(Booking.id).where(
            Booking.offer_id == offer.id, Booking.status.in_(("acceptée", "en_litige"))
        )
    ).first():
        S.fail("La durée ne peut plus être modifiée : une séance est déjà acceptée.")

    offer.category_id = payload.category_id
    offer.title = payload.title.strip()
    offer.skill = payload.skill.strip()
    offer.description = payload.description.strip()
    offer.level = payload.level
    offer.duration = payload.duration
    offer.mode = payload.mode
    return {"ok": True}


@app.post("/api/offers/{offer_id}/status")
def change_offer_status(
    offer_id: int,
    payload: StatusIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    offer = db.get(Offer, offer_id)
    if offer is None or offer.owner_id != user.id:
        S.fail("Offre introuvable.", 404)
    if payload.status not in ("brouillon", "publiée", "archivée"):
        S.fail("État invalide.")
    if payload.status == "publiée":
        if offer.hidden:
            S.fail("Cette offre a été masquée par un administrateur.")
        has_future_slot = any(s.start_at > datetime.utcnow() for s in offer.slots)
        if not has_future_slot:
            S.fail("Ajoutez au moins un créneau futur avant de publier.")  # RG04

    offer.status = payload.status
    if payload.status != "publiée":
        S.cancel_pending_for_offer(db, offer.id, "l'offre n'est plus publiée.")
    return {"ok": True}


@app.post("/api/offers/{offer_id}/slots", status_code=201)
def add_slot(
    offer_id: int,
    payload: SlotIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    offer = db.get(Offer, offer_id)
    if offer is None or offer.owner_id != user.id:
        S.fail("Offre introuvable.", 404)

    start = parse_dt(payload.start_at)
    if start <= datetime.utcnow():
        S.fail("Le créneau doit être dans le futur.")
    end = start + timedelta(hours=offer.duration)

    if not payload.location.strip():
        S.fail(
            "Le lien de réunion est obligatoire."
            if offer.mode == "À distance"
            else "Le lieu est obligatoire."
        )

    # Pas de chevauchement avec les autres créneaux du même intervenant
    existing = db.execute(
        select(Slot.start_at, Slot.end_at)
        .join(Offer, Offer.id == Slot.offer_id)
        .where(Offer.owner_id == user.id)
    ).all()
    if any(S.overlaps(start, end, s, e) for s, e in existing):
        S.fail("Ce créneau chevauche un de vos autres créneaux.")

    slot = Slot(
        offer_id=offer.id, start_at=start, end_at=end, location=payload.location.strip()
    )
    db.add(slot)
    db.flush()
    return {"id": slot.id}


@app.delete("/api/slots/{slot_id}")
def delete_slot(
    slot_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    slot = db.get(Slot, slot_id)
    if slot is None or slot.offer.owner_id != user.id:
        S.fail("Créneau introuvable.", 404)
    if db.execute(
        select(Booking.id).where(
            Booking.slot_id == slot_id,
            Booking.status.in_(("en_attente", "acceptée", "en_litige", "réalisée")),
        )
    ).first():
        S.fail("Ce créneau a des demandes ou une réservation : suppression impossible.")
    db.delete(slot)
    return {"ok": True}


# --------------------------------------------------------------------------
# Réservations
# --------------------------------------------------------------------------
@app.post("/api/bookings", status_code=201)
def create_booking(
    payload: BookingIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    if payload.slot_id is None:
        S.fail("Créneau introuvable.", 404)
    booking = S.request_booking(db, user, payload.slot_id)
    return {"id": booking.id}


@app.get("/api/bookings")
def list_bookings(
    box: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = select(Booking)
    if box == "received":
        query = query.where(Booking.provider_id == user.id)
    elif box == "sent":
        query = query.where(Booking.beneficiary_id == user.id)
    else:
        query = query.where(
            (Booking.provider_id == user.id) | (Booking.beneficiary_id == user.id)
        )
    rows = db.execute(query.order_by(Booking.created_at.desc())).scalars().all()
    return [booking_view(db, b, user) for b in rows]


@app.get("/api/planning")
def planning(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Booking)
        .join(Slot, Slot.id == Booking.slot_id)
        .where(
            Booking.status.in_(("acceptée", "en_litige")),
            (Booking.provider_id == user.id) | (Booking.beneficiary_id == user.id),
        )
        .order_by(Slot.start_at)
    ).scalars().all()
    return [booking_view(db, b, user) for b in rows]


@app.post("/api/bookings/{booking_id}/accept")
def accept_booking(
    booking_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    S.accept_booking(db, user, booking_id)
    return {"ok": True}


@app.post("/api/bookings/{booking_id}/refuse")
def refuse_booking(
    booking_id: int,
    payload: ReasonIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    S.refuse_booking(db, user, booking_id, payload.reason)
    return {"ok": True}


@app.post("/api/bookings/{booking_id}/withdraw")
def withdraw_booking(
    booking_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    S.withdraw_booking(db, user, booking_id)
    return {"ok": True}


@app.post("/api/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    S.cancel_booking(db, user, booking_id)
    return {"ok": True}


@app.post("/api/bookings/{booking_id}/confirm")
def confirm_booking(
    booking_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    return {"result": S.confirm_booking(db, user, booking_id)}


@app.post("/api/bookings/{booking_id}/review")
def review_booking(
    booking_id: int,
    payload: ReviewIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    S.submit_review(db, user, booking_id, payload.rating, payload.comment)
    return {"ok": True}


@app.post("/api/bookings/{booking_id}/dispute", status_code=201)
def dispute_booking(
    booking_id: int,
    payload: DisputeIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    dispute = S.open_dispute(db, user, booking_id, payload.kind, payload.description)
    return {"id": dispute.id}


# --------------------------------------------------------------------------
# Crédits et notifications
# --------------------------------------------------------------------------
@app.get("/api/wallet")
def wallet(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(CreditMovement)
        .where(CreditMovement.user_id == user.id)
        .order_by(CreditMovement.id.desc())
    ).scalars().all()
    movements = []
    for movement in rows:
        title = None
        if movement.booking_id:
            booking = db.get(Booking, movement.booking_id)
            if booking:
                offer = db.get(Offer, booking.offer_id)
                title = offer.title if offer else None
        movements.append(movement_view(movement, title))
    return {"balance": user.balance, "blocked": user.blocked, "movements": movements}


@app.get("/api/notifications")
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    from .models import Notification

    rows = db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.id.desc())
        .limit(100)
    ).scalars().all()
    return [
        {
            "id": n.id,
            "message": n.message,
            "read": bool(n.read),
            "created_at": iso_local_naive(n.created_at),
        }
        for n in rows
    ]


@app.post("/api/notifications/read")
def read_notifications(
    user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .models import Notification

    for notification in db.execute(
        select(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))
    ).scalars():
        notification.read = True
    return {"ok": True}


# --------------------------------------------------------------------------
# Litiges
# --------------------------------------------------------------------------
def dispute_view(db: Session, dispute: Dispute) -> dict:
    booking = db.get(Booking, dispute.booking_id)
    offer = db.get(Offer, booking.offer_id)
    slot = db.get(Slot, booking.slot_id)
    provider = db.get(User, booking.provider_id)
    beneficiary = db.get(User, booking.beneficiary_id)
    messages = db.execute(
        select(DisputeMessage, User)
        .join(User, User.id == DisputeMessage.user_id)
        .where(DisputeMessage.dispute_id == dispute.id)
        .order_by(DisputeMessage.id)
    ).all()
    return {
        "id": dispute.id,
        "booking_id": dispute.booking_id,
        "opened_by": dispute.opened_by,
        "kind": dispute.kind,
        "description": dispute.description,
        "status": dispute.status,
        "decision": dispute.decision,
        "decision_reason": dispute.decision_reason,
        "decided_by": dispute.decided_by,
        "created_at": iso_local_naive(dispute.created_at),
        "resolved_at": iso_local_naive(dispute.resolved_at),
        "offer_title": offer.title,
        "cost": booking.cost,
        "provider": {
            "id": provider.id,
            "first_name": provider.first_name,
            "last_name": provider.last_name,
        },
        "beneficiary": {
            "id": beneficiary.id,
            "first_name": beneficiary.first_name,
            "last_name": beneficiary.last_name,
        },
        "provider_confirmed": bool(booking.provider_confirmed),
        "beneficiary_confirmed": bool(booking.beneficiary_confirmed),
        "start_at": iso_utc(slot.start_at),
        "end_at": iso_utc(slot.end_at),
        "messages": [
            {
                "id": message.id,
                "dispute_id": message.dispute_id,
                "user_id": message.user_id,
                "message": message.message,
                "created_at": iso_local_naive(message.created_at),
                "first_name": author.first_name,
                "last_name": author.last_name,
            }
            for message, author in messages
        ],
    }


def can_see_dispute(db: Session, user: User, dispute: Dispute) -> bool:
    if user.role == "admin":
        return True
    booking = db.get(Booking, dispute.booking_id)
    return user.id in (booking.provider_id, booking.beneficiary_id)


@app.get("/api/disputes")
def list_disputes(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role == "admin":
        rows = db.execute(select(Dispute).order_by(Dispute.status, Dispute.id.desc())).scalars().all()
    else:
        rows = db.execute(
            select(Dispute)
            .join(Booking, Booking.id == Dispute.booking_id)
            .where(
                (Booking.provider_id == user.id) | (Booking.beneficiary_id == user.id)
            )
            .order_by(Dispute.id.desc())
        ).scalars().all()
    return [dispute_view(db, d) for d in rows]


@app.get("/api/disputes/{dispute_id}")
def get_dispute(
    dispute_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    dispute = db.get(Dispute, dispute_id)
    if dispute is None or not can_see_dispute(db, user, dispute):  # RG19
        S.fail("Litige introuvable.", 404)
    return dispute_view(db, dispute)


@app.post("/api/disputes/{dispute_id}/messages")
def add_dispute_message(
    dispute_id: int,
    payload: MessageIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    dispute = db.get(Dispute, dispute_id)
    if dispute is None or not can_see_dispute(db, user, dispute):
        S.fail("Litige introuvable.", 404)
    if dispute.status != "ouvert":
        S.fail("Ce litige est clos.")
    text = (payload.message or "").strip()
    if len(text) < 2:
        S.fail("Message trop court.")
    db.add(DisputeMessage(dispute_id=dispute.id, user_id=user.id, message=text))
    return {"ok": True}


# --------------------------------------------------------------------------
# Administration
# --------------------------------------------------------------------------
@app.get("/api/admin/stats")
def admin_stats(_admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    def count(condition) -> int:
        return int(db.execute(select(func.count()).select_from(User).where(condition)).scalar_one())

    def count_rows(model, *conditions) -> int:
        query = select(func.count()).select_from(model)
        for condition in conditions:
            query = query.where(condition)
        return int(db.execute(query).scalar_one())

    return {
        "active_accounts": count((User.active.is_(True)) & (User.role == "student")),
        "published_offers": count_rows(
            Offer, Offer.status == "publiée", Offer.hidden.is_(False)
        ),
        "accepted_sessions": count_rows(
            Booking, Booking.status.in_(("acceptée", "en_litige"))
        ),
        "completed_sessions": count_rows(Booking, Booking.status == "réalisée"),
        "credits_transferred": int(
            db.execute(
                select(func.coalesce(func.sum(CreditMovement.amount), 0)).where(
                    CreditMovement.type == "transfert_entrant"
                )
            ).scalar_one()
        ),
        "open_disputes": count_rows(Dispute, Dispute.status == "ouvert"),
    }


@app.get("/api/admin/users")
def admin_users(_admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.execute(select(User).order_by(User.id)).scalars().all()
    return [user_public(u) for u in rows]


@app.post("/api/admin/users/{user_id}/active")
def admin_set_active(
    user_id: int,
    payload: ActiveIn,
    _admin: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    S.set_user_active(db, user_id, payload.active)
    return {"ok": True}


@app.get("/api/admin/offers")
def admin_offers(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Offer).where(Offer.status != "brouillon").order_by(Offer.id.desc())
    ).scalars().all()
    return [offer_view(db, o, admin) for o in rows]


@app.post("/api/admin/offers/{offer_id}/hide")
def admin_hide_offer(
    offer_id: int,
    payload: HiddenIn,
    _admin: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    offer = db.get(Offer, offer_id)
    if offer is None:
        S.fail("Offre introuvable.", 404)
    offer.hidden = payload.hidden
    if payload.hidden:
        S.cancel_pending_for_offer(db, offer.id, "offre masquée par la modération.")
        S.notify(
            db, offer.owner_id, f"Votre offre « {offer.title} » a été masquée par la modération."
        )
    return {"ok": True}


@app.get("/api/admin/bookings")
def admin_bookings(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Booking)
        .where(Booking.status.in_(("acceptée", "en_litige")))
        .order_by(Booking.id.desc())
    ).scalars().all()
    return [booking_view(db, b, admin) for b in rows]


@app.post("/api/admin/bookings/{booking_id}/cancel")
def admin_cancel(
    booking_id: int, _admin: User = Depends(admin_user), db: Session = Depends(get_db)
):
    S.admin_cancel_booking(db, booking_id)
    return {"ok": True}


@app.post("/api/admin/disputes/{dispute_id}/resolve")
def admin_resolve(
    dispute_id: int,
    payload: ResolveIn,
    admin: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    S.resolve_dispute(db, admin, dispute_id, payload.decision, payload.reason)
    return {"ok": True}
