"""Configuration centralisée, lue depuis le fichier .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# SQLite par défaut (aucune installation). Pour PostgreSQL :
#   DATABASE_URL=postgresql+psycopg://user:motdepasse@localhost:5432/skillswap
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'skillswap.db'}")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me-please-set-your-own-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7

PORT = int(os.getenv("PORT", "4000"))

# Compte administrateur créé automatiquement au premier démarrage
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@skillswap.ma")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin123!")

DEFAULT_CATEGORIES = [
    "Programmation",
    "Langues",
    "Communication orale",
    "Mathématiques",
    "Design",
    "Bureautique",
]
