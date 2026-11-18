"""Schémas Pydantic d'entrée de l'API.

Tous les champs ont une valeur par défaut : la validation métier (messages en
français) est faite dans app/services.py, afin de renvoyer des erreurs lisibles
plutôt que les erreurs techniques de Pydantic.
"""
from pydantic import BaseModel



class RegisterIn(BaseModel):
    email: str = ""
    password: str = ""
    first_name: str = ""
    last_name: str = ""
    field: str = ""


class LoginIn(BaseModel):
    email: str = ""
    password: str = ""


class ProfileIn(BaseModel):
    first_name: str = ""
    last_name: str = ""
    field: str = ""
    offered_skills: str = ""
    wanted_skills: str = ""


class CategoryIn(BaseModel):
    name: str = ""


class OfferIn(BaseModel):
    title: str = ""
    category_id: int | None = None
    skill: str = ""
    description: str = ""
    level: str = ""
    duration: int | None = None
    mode: str = ""


class StatusIn(BaseModel):
    status: str = ""


class SlotIn(BaseModel):
    start_at: str = ""
    location: str = ""


class BookingIn(BaseModel):
    slot_id: int | None = None


class ReasonIn(BaseModel):
    reason: str = ""


class ReviewIn(BaseModel):
    rating: int = 0
    comment: str = ""


class DisputeIn(BaseModel):
    kind: str = ""
    description: str = ""


class MessageIn(BaseModel):
    message: str = ""


class ActiveIn(BaseModel):
    active: bool = True


class HiddenIn(BaseModel):
    hidden: bool = True


class ResolveIn(BaseModel):
    decision: str = ""
    reason: str = ""
