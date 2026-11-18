"""Conversion des objets SQLAlchemy en JSON attendu par le frontend."""
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Booking, CreditMovement, Dispute, Offer, Review, Slot, User


# --------------------------------------------------------------------------
# Formats de dates
# --------------------------------------------------------------------------
def iso_utc(dt: datetime | None) -> str | None:
    """Date avec fuseau explicite (créneaux, séances). Ex : 2026-11-20T17:00:00Z"""
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat() + "Z"


def iso_local_naive(dt: datetime | None) -> str | None:
    """Date sans fuseau (horodatages). Le frontend ajoute lui-même le « Z »."""
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat()


# --------------------------------------------------------------------------
# Notes
# --------------------------------------------------------------------------
def rating_of(db: Session, user_id: int) -> dict:
    avg, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.target_id == user_id)
    ).one()
    return {"avg": round(float(avg), 2) if avg is not None else None, "n": int(count or 0)}


# --------------------------------------------------------------------------
# Utilisateurs
# --------------------------------------------------------------------------
def user_public(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "field": u.field,
        "offered_skills": u.offered_skills,
        "wanted_skills": u.wanted_skills,
        "role": u.role,
        "active": bool(u.active),
        "balance": u.balance,
        "blocked": u.blocked,
        "created_at": iso_local_naive(u.created_at),
    }


# --------------------------------------------------------------------------
# Offres
# --------------------------------------------------------------------------
def slot_active_booking(db: Session, slot_id: int) -> Booking | None:
    return db.execute(
        select(Booking).where(
            Booking.slot_id == slot_id,
            Booking.status.in_(["acceptée", "en_litige", "réalisée"]),
        )
    ).scalars().first()


def offer_view(db: Session, offer: Offer, viewer: User | None) -> dict:
    owner = db.get(User, offer.owner_id)
    category = offer.category.name if offer.category else None
    is_owner = viewer is not None and viewer.id == offer.owner_id
    is_admin = viewer is not None and viewer.role == "admin"

    slots = []
    for slot in sorted(offer.slots, key=lambda s: s.start_at):
        taken = slot_active_booking(db, slot.id) is not None
        participant = False
        if viewer is not None:
            participant = (
                db.execute(
                    select(Booking.id).where(
                        Booking.slot_id == slot.id,
                        Booking.status.in_(["acceptée", "en_litige", "réalisée"]),
                        (Booking.provider_id == viewer.id) | (Booking.beneficiary_id == viewer.id),
                    )
                ).first()
                is not None
            )
        can_see_location = is_owner or is_admin or participant  # RG09 / RG19
        item = {
            "id": slot.id,
            "start_at": iso_utc(slot.start_at),
            "end_at": iso_utc(slot.end_at),
            "taken": taken,
        }
        if can_see_location:
            item["location"] = slot.location
        slots.append(item)

    return {
        "id": offer.id,
        "owner_id": offer.owner_id,
        "category_id": offer.category_id,
        "title": offer.title,
        "skill": offer.skill,
        "description": offer.description,
        "level": offer.level,
        "duration": offer.duration,
        "mode": offer.mode,
        "status": offer.status,
        "hidden": bool(offer.hidden),
        "created_at": iso_local_naive(offer.created_at),
        "category": category,
        "owner": {
            "id": owner.id,
            "first_name": owner.first_name,
            "last_name": owner.last_name,
            "field": owner.field,
            "rating": rating_of(db, owner.id),
        },
        "slots": slots,
    }


# --------------------------------------------------------------------------
# Réservations
# --------------------------------------------------------------------------
def booking_view(db: Session, booking: Booking, viewer: User) -> dict:
    slot = db.get(Slot, booking.slot_id)
    offer = db.get(Offer, booking.offer_id)
    provider = db.get(User, booking.provider_id)
    beneficiary = db.get(User, booking.beneficiary_id)

    participant = viewer.id in (booking.provider_id, booking.beneficiary_id)
    show_location = participant and booking.status in ("acceptée", "réalisée", "en_litige")

    reviewed = (
        db.execute(
            select(Review.id).where(
                Review.booking_id == booking.id, Review.author_id == viewer.id
            )
        ).first()
        is not None
    )
    dispute = db.execute(
        select(Dispute).where(Dispute.booking_id == booking.id).order_by(Dispute.id.desc())
    ).scalars().first()

    my_confirmed = (
        booking.provider_confirmed if viewer.id == booking.provider_id else booking.beneficiary_confirmed
    )

    return {
        "id": booking.id,
        "slot_id": booking.slot_id,
        "offer_id": booking.offer_id,
        "provider_id": booking.provider_id,
        "beneficiary_id": booking.beneficiary_id,
        "cost": booking.cost,
        "status": booking.status,
        "reason": booking.reason,
        "provider_confirmed": bool(booking.provider_confirmed),
        "beneficiary_confirmed": bool(booking.beneficiary_confirmed),
        "settled": bool(booking.settled),
        "created_at": iso_local_naive(booking.created_at),
        "offer": {
            "id": offer.id,
            "title": offer.title,
            "skill": offer.skill,
            "duration": offer.duration,
            "mode": offer.mode,
        },
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
        "start_at": iso_utc(slot.start_at),
        "end_at": iso_utc(slot.end_at),
        "location": slot.location if show_location else None,
        "role": "intervenant" if viewer.id == booking.provider_id else "bénéficiaire",
        "my_confirmed": bool(my_confirmed),
        "reviewed": reviewed,
        "dispute": {"id": dispute.id, "status": dispute.status} if dispute else None,
    }


# --------------------------------------------------------------------------
# Mouvements de crédits
# --------------------------------------------------------------------------
def movement_view(m: CreditMovement, offer_title: str | None = None) -> dict:
    return {
        "id": m.id,
        "user_id": m.user_id,
        "booking_id": m.booking_id,
        "type": m.type,
        "amount": m.amount,
        "note": m.note,
        "created_at": iso_local_naive(m.created_at),
        "offer_title": offer_title,
    }
