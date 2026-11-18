"""Règles de gestion (RG01 à RG19). Tous les contrôles sont faits côté serveur."""
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Booking,
    CreditMovement,
    Dispute,
    DisputeMessage,
    Notification,
    Offer,
    Review,
    Slot,
    User,
    utcnow,
)

ACTIVE_STATUSES = ("acceptée", "en_litige", "réalisée")
PENDING_STATUSES = ("en_attente", "acceptée", "en_litige")


class AppError(Exception):
    """Erreur métier renvoyée au client sous la forme {"error": "..."}."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def fail(message: str, status_code: int = 400):
    raise AppError(message, status_code)


# --------------------------------------------------------------------------
# Utilitaires
# --------------------------------------------------------------------------
def notify(db: Session, user_id: int, message: str) -> None:
    db.add(Notification(user_id=user_id, message=message))


def add_movement(
    db: Session, user_id: int, booking_id: int | None, type_: str, amount: int, note: str = ""
) -> None:
    db.add(
        CreditMovement(
            user_id=user_id, booking_id=booking_id, type=type_, amount=amount, note=note
        )
    )


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def has_conflict(db: Session, user_id: int, slot: Slot, ignore_booking_id: int = 0) -> bool:
    """RG08 : une personne ne peut pas avoir deux séances qui se chevauchent."""
    rows = db.execute(
        select(Slot.start_at, Slot.end_at)
        .join(Booking, Booking.slot_id == Slot.id)
        .where(
            Booking.status.in_(("acceptée", "en_litige")),
            Booking.id != ignore_booking_id,
            (Booking.provider_id == user_id) | (Booking.beneficiary_id == user_id),
        )
    ).all()
    return any(
        overlaps(slot.start_at, slot.end_at, start, end) for start, end in rows
    )


def get_booking(db: Session, booking_id: int) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        fail("Réservation introuvable.", 404)
    return booking


# --------------------------------------------------------------------------
# RG02 / RG03 / RG05 : demande de réservation
# --------------------------------------------------------------------------
def request_booking(db: Session, user: User, slot_id: int) -> Booking:
    slot = db.get(Slot, slot_id)
    if slot is None:
        fail("Créneau introuvable.", 404)
    offer = db.get(Offer, slot.offer_id)
    provider = db.get(User, offer.owner_id)

    if offer.owner_id == user.id:
        fail("Vous ne pouvez pas réserver votre propre offre.")
    if offer.status != "publiée" or offer.hidden:
        fail("Cette offre n'est pas disponible.")
    if not provider.active:
        fail("L'intervenant n'est plus actif.")
    if slot.start_at <= datetime.utcnow():
        fail("Ce créneau est déjà passé.")
    if db.execute(
        select(Booking.id).where(
            Booking.slot_id == slot_id, Booking.status.in_(ACTIVE_STATUSES)
        )
    ).first():
        fail("Ce créneau est déjà attribué.")
    if db.execute(
        select(Booking.id).where(
            Booking.slot_id == slot_id,
            Booking.beneficiary_id == user.id,
            Booking.status.in_(PENDING_STATUSES),
        )
    ).first():
        fail("Vous avez déjà une demande en cours pour ce créneau.")
    if user.balance < offer.duration:
        fail(
            f"Solde insuffisant : {offer.duration} crédit(s) requis, "
            f"{user.balance} disponible(s)."
        )

    booking = Booking(
        slot_id=slot_id,
        offer_id=offer.id,
        provider_id=offer.owner_id,
        beneficiary_id=user.id,
        cost=offer.duration,
    )
    db.add(booking)
    db.flush()
    notify(
        db,
        offer.owner_id,
        f"Nouvelle demande de {user.first_name} {user.last_name} pour « {offer.title} ».",
    )
    return booking


# --------------------------------------------------------------------------
# RG06 / RG07 : acceptation
# --------------------------------------------------------------------------
def accept_booking(db: Session, user: User, booking_id: int) -> None:
    booking = get_booking(db, booking_id)
    if booking.provider_id != user.id:
        fail("Seul l’intervenant peut accepter.", 403)
    if booking.status != "en_attente":
        fail("Cette demande n’est plus en attente.")

    slot = db.get(Slot, booking.slot_id)
    offer = db.get(Offer, booking.offer_id)
    provider = db.get(User, booking.provider_id)
    beneficiary = db.get(User, booking.beneficiary_id)

    if not provider.active:
        fail("Votre compte est désactivé.")
    if not beneficiary.active:
        fail("Le compte du bénéficiaire est désactivé.")
    if offer.status != "publiée" or offer.hidden:
        fail("L’offre n’est plus publiée.")
    if slot.start_at <= datetime.utcnow():
        fail("Ce créneau est déjà passé.")
    if db.execute(
        select(Booking.id).where(
            Booking.slot_id == booking.slot_id, Booking.status.in_(ACTIVE_STATUSES)
        )
    ).first():
        fail("Ce créneau est déjà attribué.")
    if has_conflict(db, booking.provider_id, slot):
        fail("Conflit de planning : vous avez déjà une séance sur cet horaire.")
    if has_conflict(db, booking.beneficiary_id, slot):
        fail("Conflit de planning pour le bénéficiaire sur cet horaire.")
    if beneficiary.balance < booking.cost:
        fail("Solde insuffisant du bénéficiaire pour accepter cette demande.")  # RG05

    beneficiary.balance -= booking.cost
    beneficiary.blocked += booking.cost
    add_movement(
        db, beneficiary.id, booking.id, "blocage", booking.cost, f"Blocage pour « {offer.title} »"
    )
    booking.status = "acceptée"

    # RG07 : les autres demandes sur ce créneau sont refusées automatiquement
    others = db.execute(
        select(Booking).where(
            Booking.slot_id == booking.slot_id,
            Booking.status == "en_attente",
            Booking.id != booking.id,
        )
    ).scalars().all()
    for other in others:
        other.status = "refusée"
        other.reason = "Créneau attribué à une autre demande."
        notify(
            db,
            other.beneficiary_id,
            f"Votre demande pour « {offer.title} » a été refusée : "
            "créneau attribué à une autre demande.",
        )

    notify(
        db,
        beneficiary.id,
        f"Votre demande pour « {offer.title} » a été acceptée. "
        f"{booking.cost} crédit(s) bloqué(s).",
    )


def refuse_booking(db: Session, user: User, booking_id: int, reason: str) -> None:
    booking = get_booking(db, booking_id)
    if booking.provider_id != user.id:
        fail("Seul l’intervenant peut refuser.", 403)
    if booking.status != "en_attente":
        fail("Cette demande n’est plus en attente.")
    if not reason or not reason.strip():
        fail("Un motif de refus est obligatoire.")
    booking.status = "refusée"
    booking.reason = reason.strip()[:255]
    notify(db, booking.beneficiary_id, f"Votre demande a été refusée. Motif : {reason.strip()}")


def withdraw_booking(db: Session, user: User, booking_id: int) -> None:
    booking = get_booking(db, booking_id)
    if booking.beneficiary_id != user.id:
        fail("Seul le bénéficiaire peut retirer sa demande.", 403)
    if booking.status != "en_attente":
        fail("Seule une demande en attente peut être retirée.")
    booking.status = "annulée"
    booking.reason = "Retirée par le bénéficiaire"
    notify(db, booking.provider_id, "Une demande en attente a été retirée.")


# --------------------------------------------------------------------------
# RG10 : annulation avant le début
# --------------------------------------------------------------------------
def release_credits(db: Session, booking: Booking, note: str) -> None:
    beneficiary = db.get(User, booking.beneficiary_id)
    beneficiary.balance += booking.cost
    beneficiary.blocked -= booking.cost
    add_movement(db, beneficiary.id, booking.id, "libération", booking.cost, note)


def cancel_booking(db: Session, user: User, booking_id: int) -> None:
    booking = get_booking(db, booking_id)
    if user.id not in (booking.provider_id, booking.beneficiary_id):
        fail("Accès refusé.", 403)
    if booking.status != "acceptée":
        fail("Seule une séance acceptée peut être annulée.")
    slot = db.get(Slot, booking.slot_id)
    if slot.start_at <= datetime.utcnow():
        fail(
            "La séance a déjà commencé : annulation directe impossible, "
            "ouvrez un signalement."
        )
    release_credits(db, booking, "Annulation avant le début de la séance")
    booking.status = "annulée"
    booking.reason = "Annulée avant le début"
    other = booking.beneficiary_id if user.id == booking.provider_id else booking.provider_id
    notify(db, other, "Une séance acceptée a été annulée. Les crédits ont été libérés.")


# --------------------------------------------------------------------------
# RG11 / RG12 / RG14 : confirmations et transfert unique
# --------------------------------------------------------------------------
def transfer_credits(db: Session, booking: Booking, note: str) -> None:
    if booking.settled:
        fail("Cette réservation a déjà été réglée.")
    beneficiary = db.get(User, booking.beneficiary_id)
    provider = db.get(User, booking.provider_id)
    beneficiary.blocked -= booking.cost
    provider.balance += booking.cost
    add_movement(db, beneficiary.id, booking.id, "transfert_sortant", booking.cost, note)
    add_movement(db, provider.id, booking.id, "transfert_entrant", booking.cost, note)
    booking.status = "réalisée"
    booking.settled = True
    notify(db, provider.id, f"Vous avez reçu {booking.cost} crédit(s).")
    notify(db, beneficiary.id, f"{booking.cost} crédit(s) transféré(s) à l’intervenant.")


def confirm_booking(db: Session, user: User, booking_id: int) -> str:
    booking = get_booking(db, booking_id)
    if user.id not in (booking.provider_id, booking.beneficiary_id):
        fail("Accès refusé.", 403)
    if booking.status != "acceptée":
        fail("Cette réservation ne peut pas être confirmée dans son état actuel.")
    slot = db.get(Slot, booking.slot_id)
    if datetime.utcnow() < slot.end_at:
        fail("La confirmation est possible uniquement après l’heure de fin.")

    is_provider = user.id == booking.provider_id
    if is_provider and booking.provider_confirmed:
        fail("Vous avez déjà confirmé cette séance.")
    if not is_provider and booking.beneficiary_confirmed:
        fail("Vous avez déjà confirmé cette séance.")

    if is_provider:
        booking.provider_confirmed = True
    else:
        booking.beneficiary_confirmed = True
    db.flush()

    if booking.provider_confirmed and booking.beneficiary_confirmed:
        open_dispute_row = db.execute(
            select(Dispute.id).where(
                Dispute.booking_id == booking.id, Dispute.status == "ouvert"
            )
        ).first()
        if open_dispute_row:
            fail("Un litige est ouvert : le transfert est bloqué.")
        transfer_credits(db, booking, "Transfert après double confirmation")
        return "transféré"

    other = booking.beneficiary_id if is_provider else booking.provider_id
    notify(
        db, other, "L’autre participant a confirmé la séance. À vous de confirmer."
    )
    return "confirmé"


# --------------------------------------------------------------------------
# RG13 / RG19 : litiges
# --------------------------------------------------------------------------
def open_dispute(db: Session, user: User, booking_id: int, kind: str, description: str) -> Dispute:
    booking = get_booking(db, booking_id)
    if user.id not in (booking.provider_id, booking.beneficiary_id):
        fail("Accès refusé.", 403)
    if booking.settled:
        fail("Cette réservation est déjà réglée définitivement.")
    if booking.status != "acceptée":
        fail("Un signalement n’est possible que sur une séance acceptée.")
    slot = db.get(Slot, booking.slot_id)
    if datetime.utcnow() < slot.start_at:
        fail("Avant le début, utilisez l’annulation.")
    if kind not in ("absence", "désaccord", "confirmation_manquante"):
        fail("Type de signalement invalide.")
    if not description or len(description.strip()) < 5:
        fail("Décrivez le problème (5 caractères minimum).")
    if db.execute(
        select(Dispute.id).where(
            Dispute.booking_id == booking.id, Dispute.status == "ouvert"
        )
    ).first():
        fail("Un litige est déjà ouvert pour cette réservation.")

    dispute = Dispute(
        booking_id=booking.id,
        opened_by=user.id,
        kind=kind,
        description=description.strip(),
    )
    db.add(dispute)
    db.flush()
    db.add(
        DisputeMessage(dispute_id=dispute.id, user_id=user.id, message=description.strip())
    )
    booking.status = "en_litige"

    other = booking.beneficiary_id if user.id == booking.provider_id else booking.provider_id
    notify(db, other, "Un signalement a été ouvert sur une de vos séances.")
    for admin in db.execute(select(User).where(User.role == "admin")).scalars():
        notify(db, admin.id, "Nouveau litige à examiner.")
    return dispute


def resolve_dispute(
    db: Session, admin: User, dispute_id: int, decision: str, reason: str
) -> None:
    dispute = db.get(Dispute, dispute_id)
    if dispute is None:
        fail("Litige introuvable.", 404)
    if dispute.status != "ouvert":
        fail("Ce litige est déjà réglé : aucun second règlement n’est autorisé.")
    if decision not in ("transfert", "restitution"):
        fail("Décision invalide (transfert ou restitution).")
    if not reason or len(reason.strip()) < 5:
        fail("La décision doit être motivée.")

    booking = db.get(Booking, dispute.booking_id)
    if booking.settled:
        fail("Cette réservation est déjà réglée.")

    if decision == "transfert":
        transfer_credits(db, booking, "Règlement administrateur : transfert")
    else:
        beneficiary = db.get(User, booking.beneficiary_id)
        beneficiary.blocked -= booking.cost
        beneficiary.balance += booking.cost
        add_movement(
            db, beneficiary.id, booking.id, "restitution", booking.cost,
            "Règlement administrateur : restitution",
        )
        booking.status = "annulée"
        booking.settled = True

    dispute.status = "résolu"
    dispute.decision = decision
    dispute.decision_reason = reason.strip()
    dispute.decided_by = admin.id
    dispute.resolved_at = utcnow()

    label = (
        "transfert à l’intervenant" if decision == "transfert" else "restitution au bénéficiaire"
    )
    message = f"Litige réglé : {label}. Motif : {reason.strip()}"
    notify(db, booking.provider_id, message)
    notify(db, booking.beneficiary_id, message)


# --------------------------------------------------------------------------
# RG17 : archivage / masquage
# --------------------------------------------------------------------------
def cancel_pending_for_offer(db: Session, offer_id: int, why: str) -> None:
    pending = db.execute(
        select(Booking).where(Booking.offer_id == offer_id, Booking.status == "en_attente")
    ).scalars().all()
    for booking in pending:
        booking.status = "annulée"
        booking.reason = why[:255]
        notify(db, booking.beneficiary_id, f"Votre demande a été annulée : {why}")


# --------------------------------------------------------------------------
# RG18 : comptes
# --------------------------------------------------------------------------
def set_user_active(db: Session, user_id: int, active: bool) -> None:
    user = db.get(User, user_id)
    if user is None:
        fail("Utilisateur introuvable.", 404)
    if user.role == "admin" and not active:
        fail("Un administrateur ne peut pas être désactivé.")
    user.active = active
    if not active:
        pending = db.execute(
            select(Booking).where(
                Booking.status == "en_attente",
                (Booking.provider_id == user_id) | (Booking.beneficiary_id == user_id),
            )
        ).scalars().all()
        for booking in pending:
            booking.status = "annulée"
            booking.reason = "Compte désactivé"
            other = (
                booking.beneficiary_id
                if booking.provider_id == user_id
                else booking.provider_id
            )
            notify(db, other, "Une demande a été annulée (compte désactivé).")


def admin_cancel_booking(db: Session, booking_id: int) -> None:
    booking = get_booking(db, booking_id)
    if booking.status != "acceptée":
        fail("Seule une séance acceptée peut être annulée par l’administrateur.")
    release_credits(db, booking, "Annulation administrateur")
    booking.status = "annulée"
    booking.reason = "Annulée par l’administrateur"
    notify(db, booking.provider_id, "Une séance a été annulée par l’administrateur.")
    notify(
        db, booking.beneficiary_id,
        "Une séance a été annulée par l’administrateur. Crédits libérés.",
    )


# --------------------------------------------------------------------------
# RG15 : évaluations
# --------------------------------------------------------------------------
def submit_review(
    db: Session, user: User, booking_id: int, rating: int, comment: str
) -> None:
    booking = get_booking(db, booking_id)
    if user.id not in (booking.provider_id, booking.beneficiary_id):
        fail("Accès refusé.", 403)
    if booking.status != "réalisée":
        fail("Une évaluation n’est possible qu’après une séance réalisée.")
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        fail("La note doit être comprise entre 1 et 5.")
    if db.execute(
        select(Review.id).where(
            Review.booking_id == booking_id, Review.author_id == user.id
        )
    ).first():
        fail("Vous avez déjà évalué cette séance.")

    target = (
        booking.beneficiary_id if user.id == booking.provider_id else booking.provider_id
    )
    db.add(
        Review(
            booking_id=booking_id,
            author_id=user.id,
            target_id=target,
            rating=rating,
            comment=(comment or "").strip(),
        )
    )
    notify(db, target, "Vous avez reçu une nouvelle évaluation.")
