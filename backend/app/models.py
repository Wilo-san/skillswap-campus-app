"""Modèles SQLAlchemy : miroir exact du schéma de la base."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    """Heure UTC « naïve » (sans fuseau), stockée telle quelle en base."""
    return datetime.utcnow()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    field: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    offered_skills: Mapped[str] = mapped_column(Text, default="", nullable=False)
    wanted_skills: Mapped[str] = mapped_column(Text, default="", nullable=False)
    role: Mapped[str] = mapped_column(String(10), default="student", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    blocked: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("role IN ('student','admin')", name="ck_users_role"),
        CheckConstraint("balance >= 0", name="ck_users_balance"),
        CheckConstraint("blocked >= 0", name="ck_users_blocked"),
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)


class Offer(Base):
    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    skill: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    level: Mapped[str] = mapped_column(String(20), nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="brouillon", nullable=False)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    owner: Mapped[User] = relationship()
    category: Mapped[Category] = relationship()
    slots: Mapped[list["Slot"]] = relationship(
        back_populates="offer", cascade="all, delete-orphan", order_by="Slot.start_at"
    )

    __table_args__ = (
        CheckConstraint("level IN ('Débutant','Intermédiaire','Avancé')", name="ck_offers_level"),
        CheckConstraint("duration IN (1,2)", name="ck_offers_duration"),
        CheckConstraint("mode IN ('Présentiel','À distance')", name="ck_offers_mode"),
        CheckConstraint(
            "status IN ('brouillon','publiée','archivée')", name="ck_offers_status"
        ),
    )


class Slot(Base):
    __tablename__ = "slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    offer_id: Mapped[int] = mapped_column(
        ForeignKey("offers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    location: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    offer: Mapped[Offer] = relationship(back_populates="slots")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slot_id: Mapped[int] = mapped_column(ForeignKey("slots.id"), nullable=False, index=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id"), nullable=False)
    provider_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    beneficiary_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    cost: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="en_attente", nullable=False)
    reason: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    provider_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    beneficiary_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    settled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    slot: Mapped[Slot] = relationship()
    offer: Mapped[Offer] = relationship()
    provider: Mapped[User] = relationship(foreign_keys=[provider_id])
    beneficiary: Mapped[User] = relationship(foreign_keys=[beneficiary_id])

    __table_args__ = (
        CheckConstraint(
            "status IN ('en_attente','refusée','acceptée','annulée','réalisée','en_litige')",
            name="ck_bookings_status",
        ),
        # RG07 : un seul bénéficiaire par créneau
        Index(
            "uq_slot_active",
            "slot_id",
            unique=True,
            sqlite_where=text("status IN ('acceptée','en_litige','réalisée')"),
            postgresql_where=text("status IN ('acceptée','en_litige','réalisée')"),
        ),
        # RG03 : pas de doublon pour un même bénéficiaire sur un créneau
        Index(
            "uq_booking_dup",
            "slot_id",
            "beneficiary_id",
            unique=True,
            sqlite_where=text("status IN ('en_attente','acceptée','en_litige')"),
            postgresql_where=text("status IN ('en_attente','acceptée','en_litige')"),
        ),
    )


class CreditMovement(Base):
    __tablename__ = "credit_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "type IN ('bienvenue','blocage','libération','transfert_sortant',"
            "'transfert_entrant','restitution')",
            name="ck_movements_type",
        ),
        # RG14 : un seul règlement par réservation
        Index(
            "uq_transfer_once",
            "booking_id",
            "type",
            unique=True,
            sqlite_where=text(
                "type IN ('transfert_entrant','transfert_sortant','restitution')"
            ),
            postgresql_where=text(
                "type IN ('transfert_entrant','transfert_sortant','restitution')"
            ),
        ),
    )


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    target_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("booking_id", "author_id", name="uq_review_once"),  # RG15
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating"),
    )


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    opened_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ouvert", nullable=False)
    decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "kind IN ('absence','désaccord','confirmation_manquante')", name="ck_disputes_kind"
        ),
        CheckConstraint("status IN ('ouvert','résolu')", name="ck_disputes_status"),
    )


class DisputeMessage(Base):
    __tablename__ = "dispute_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dispute_id: Mapped[int] = mapped_column(
        ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
