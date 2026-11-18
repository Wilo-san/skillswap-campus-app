"""Données de démonstration (optionnel) : python -m app.seed"""
from datetime import datetime, timedelta

from sqlalchemy import select

from .config import DEFAULT_CATEGORIES
from .db import SessionLocal
from .models import Category, CreditMovement, Offer, Slot, User
from .security import hash_password

PASSWORD = "password123"


def get_or_create_category(db, name: str) -> Category:
    category = db.execute(select(Category).where(Category.name == name)).scalars().first()
    if category is None:
        category = Category(name=name)
        db.add(category)
        db.flush()
    return category


def get_or_create_user(db, email, first, last, field, offered, wanted) -> User:
    user = db.execute(select(User).where(User.email == email)).scalars().first()
    if user is not None:
        return user
    user = User(
        email=email,
        password_hash=hash_password(PASSWORD),
        first_name=first,
        last_name=last,
        field=field,
        offered_skills=offered,
        wanted_skills=wanted,
        balance=2,
    )
    db.add(user)
    db.flush()
    db.add(
        CreditMovement(
            user_id=user.id, type="bienvenue", amount=2, note="Crédits de bienvenue"
        )
    )
    return user


def create_offer(db, owner, title, category, skill, description, level, duration, mode, slots):
    existing = db.execute(
        select(Offer).where(Offer.title == title, Offer.owner_id == owner.id)
    ).scalars().first()
    if existing is not None:
        return
    offer = Offer(
        owner_id=owner.id,
        category_id=get_or_create_category(db, category).id,
        title=title,
        skill=skill,
        description=description,
        level=level,
        duration=duration,
        mode=mode,
        status="publiée",
    )
    db.add(offer)
    db.flush()
    for days, hour, location in slots:
        start = (datetime.utcnow() + timedelta(days=days)).replace(
            hour=hour, minute=0, second=0, microsecond=0
        )
        db.add(
            Slot(
                offer_id=offer.id,
                start_at=start,
                end_at=start + timedelta(hours=duration),
                location=location,
            )
        )


def main() -> None:
    db = SessionLocal()
    try:
        for name in DEFAULT_CATEGORIES:
            get_or_create_category(db, name)

        sara = get_or_create_user(
            db, "sara@campus.ma", "Sara", "Benali", "DUT GI", "Python, SQL", "Anglais"
        )
        amine = get_or_create_user(
            db, "amine@campus.ma", "Amine", "El Idrissi", "DUT GI", "Anglais", "Python"
        )

        create_offer(
            db, sara, "Initiation à Python", "Programmation", "Python",
            "Variables, boucles, fonctions : les bases pour démarrer.",
            "Débutant", 1, "À distance",
            [(2, 17, "https://meet.example/python"), (3, 17, "https://meet.example/python2")],
        )
        create_offer(
            db, sara, "SQL pour débutants", "Programmation", "SQL",
            "Requêtes SELECT, jointures et modélisation simple.",
            "Intermédiaire", 2, "Présentiel", [(4, 14, "Salle B12")],
        )
        create_offer(
            db, amine, "Conversation en anglais", "Langues", "Anglais",
            "Pratiquer l’oral et gagner en confiance.",
            "Intermédiaire", 1, "À distance",
            [(2, 10, "https://meet.example/english"), (5, 10, "https://meet.example/english2")],
        )
        db.commit()
        print(
            "Données de démo créées. Comptes : sara@campus.ma / amine@campus.ma "
            f"(mot de passe : {PASSWORD})"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
