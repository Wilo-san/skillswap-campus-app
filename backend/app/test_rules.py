"""Tests des règles de gestion (RG01 à RG19).

Lancement :  python -m app.test_rules
La base utilisée est temporaire : vos données réelles ne sont pas touchées.
"""
import os
import tempfile
from datetime import datetime, timedelta

DB_PATH = os.path.join(tempfile.gettempdir(), "skillswap_test.db")
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Slot  # noqa: E402

# Création du schéma par la migration Alembic (vérifie aussi la migration)
command.upgrade(Config("alembic.ini"), "head")

checks = 0


def ok(condition, label):
    global checks
    assert condition, f"ÉCHEC : {label}"
    checks += 1
    print("  ✔", label)


def main() -> None:
    with TestClient(app) as client:
        def call(method, path, body=None, token=None):
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            response = client.request(method, path, json=body, headers=headers)
            return response.status_code, (response.json() if response.content else {})

        def register(email, first):
            _, data = call(
                "POST",
                "/api/auth/register",
                {
                    "email": email,
                    "password": "password1",
                    "first_name": first,
                    "last_name": "Test",
                    "field": "GI",
                },
            )
            return data

        def future(hours):
            return (datetime.utcnow() + timedelta(hours=hours)).isoformat() + "Z"

        sara = register("sara@t.ma", "Sara")
        amine = register("amine@t.ma", "Amine")
        youssef = register("youssef@t.ma", "Youssef")
        ok(sara["user"]["balance"] == 2, "RG01 : 2 crédits de bienvenue")
        status, _ = call(
            "POST",
            "/api/auth/register",
            {"email": "SARA@t.ma", "password": "password1", "first_name": "x", "last_name": "y"},
        )
        ok(status == 409, "RG01 : e-mail unique (insensible à la casse)")
        status, _ = call("POST", "/api/auth/login", {"email": "sara@t.ma", "password": "bad"})
        ok(status == 401, "Identifiants incorrects refusés")

        _, admin = call(
            "POST", "/api/auth/login", {"email": "admin@skillswap.ma", "password": "Admin123!"}
        )
        T = lambda u: u["token"]  # noqa: E731

        # --- Offres -----------------------------------------------------
        status, data = call(
            "POST",
            "/api/offers",
            {
                "title": "Python",
                "category_id": 1,
                "skill": "Python",
                "description": "Bases",
                "level": "Débutant",
                "duration": 1,
                "mode": "À distance",
            },
            T(sara),
        )
        offer_id = data["id"]
        status, _ = call("POST", f"/api/offers/{offer_id}/status", {"status": "publiée"}, T(sara))
        ok(status == 400, "RG04 : publication sans créneau refusée")

        status, data = call(
            "POST",
            f"/api/offers/{offer_id}/slots",
            {"start_at": future(48), "location": "https://meet/x"},
            T(sara),
        )
        slot1 = data["id"]
        ok(status == 201, "Créneau créé")
        call("POST", f"/api/offers/{offer_id}/status", {"status": "publiée"}, T(sara))

        status, _ = call("POST", "/api/bookings", {"slot_id": slot1}, T(sara))
        ok(status == 400, "RG03 : réservation de sa propre offre refusée")
        status, data = call("POST", "/api/bookings", {"slot_id": slot1}, T(amine))
        b1 = data["id"]
        ok(status == 201, "Demande créée")
        status, _ = call("POST", "/api/bookings", {"slot_id": slot1}, T(amine))
        ok(status == 400, "RG03 : doublon refusé")
        call("POST", "/api/bookings", {"slot_id": slot1}, T(youssef))

        call(
            "PUT",
            "/api/me",
            {"first_name": "Amine", "last_name": "Test", "wanted_skills": "Python"},
            T(amine),
        )
        _, suggestions = call("GET", "/api/offers?suggestions=1", token=T(amine))
        ok(len(suggestions) == 1, "Suggestions basées sur les compétences recherchées")
        _, catalog = call("GET", "/api/offers", token=T(sara))
        ok(len(catalog) == 0, "Ses propres offres sont exclues du catalogue")

        # --- Acceptation -------------------------------------------------
        status, _ = call("POST", f"/api/bookings/{b1}/accept", token=T(amine))
        ok(status == 403, "Droits : seul l’intervenant accepte")
        status, _ = call("POST", f"/api/bookings/{b1}/accept", token=T(sara))
        ok(status == 200, "Acceptation")
        _, wallet = call("GET", "/api/wallet", token=T(amine))
        ok(wallet["balance"] == 1 and wallet["blocked"] == 1, "RG06 : crédit bloqué")
        _, sent = call("GET", "/api/bookings?box=sent", token=T(youssef))
        ok(sent[0]["status"] == "refusée", "RG07 : autres demandes refusées automatiquement")
        status, _ = call("POST", f"/api/bookings/{b1}/accept", token=T(sara))
        ok(status == 400, "Double acceptation refusée")

        # --- Annulation avant le début ----------------------------------
        status, _ = call("POST", f"/api/bookings/{b1}/cancel", token=T(amine))
        ok(status == 200, "RG10 : annulation avant le début")
        _, wallet = call("GET", "/api/wallet", token=T(amine))
        ok(wallet["balance"] == 2 and wallet["blocked"] == 0, "RG10 : crédits libérés")
        status, data = call("POST", "/api/bookings", {"slot_id": slot1}, T(amine))
        b3 = data["id"]
        ok(status == 201, "Créneau réservable à nouveau")
        call("POST", f"/api/bookings/{b3}/accept", token=T(sara))

        # --- Simulation du temps : séance terminée ----------------------
        db = SessionLocal()
        slot = db.get(Slot, slot1)
        slot.start_at = datetime.utcnow() - timedelta(hours=2)
        slot.end_at = datetime.utcnow() - timedelta(hours=1)
        db.commit()
        db.close()

        status, _ = call("POST", f"/api/bookings/{b3}/cancel", token=T(sara))
        ok(status == 400, "Annulation directe interdite après le début")
        _, data = call("POST", f"/api/bookings/{b3}/confirm", token=T(sara))
        ok(data["result"] == "confirmé", "Première confirmation")
        status, _ = call("POST", f"/api/bookings/{b3}/confirm", token=T(sara))
        ok(status == 400, "Une seule confirmation par participant")
        _, data = call("POST", f"/api/bookings/{b3}/confirm", token=T(amine))
        ok(data["result"] == "transféré", "Deuxième confirmation : transfert")
        status, _ = call("POST", f"/api/bookings/{b3}/confirm", token=T(amine))
        ok(status == 400, "Aucun second transfert possible")
        _, ws = call("GET", "/api/wallet", token=T(sara))
        _, wa = call("GET", "/api/wallet", token=T(amine))
        ok(
            ws["balance"] == 3 and wa["balance"] == 1 and wa["blocked"] == 0,
            "Soldes cohérents après transfert",
        )

        # --- Évaluations -------------------------------------------------
        status, _ = call(
            "POST", f"/api/bookings/{b3}/review", {"rating": 5, "comment": "Top"}, T(amine)
        )
        ok(status == 200, "Évaluation déposée")
        status, _ = call("POST", f"/api/bookings/{b3}/review", {"rating": 4}, T(amine))
        ok(status == 400, "RG15 : une seule évaluation par participant")
        _, profile = call("GET", f"/api/users/{sara['user']['id']}", token=T(amine))
        ok(profile["rating"]["avg"] == 5, "Note moyenne calculée")

        # --- Litige ------------------------------------------------------
        _, data = call(
            "POST",
            "/api/offers",
            {
                "title": "Anglais",
                "category_id": 2,
                "skill": "Anglais",
                "description": "Conv",
                "level": "Intermédiaire",
                "duration": 2,
                "mode": "Présentiel",
            },
            T(youssef),
        )
        offer2 = data["id"]
        _, data = call(
            "POST",
            f"/api/offers/{offer2}/slots",
            {"start_at": future(100), "location": "Salle 3"},
            T(youssef),
        )
        slot2 = data["id"]
        call("POST", f"/api/offers/{offer2}/status", {"status": "publiée"}, T(youssef))
        _, data = call("POST", "/api/bookings", {"slot_id": slot2}, T(sara))
        b4 = data["id"]
        call("POST", f"/api/bookings/{b4}/accept", token=T(youssef))
        db = SessionLocal()
        slot = db.get(Slot, slot2)
        slot.start_at = datetime.utcnow() - timedelta(hours=3)
        slot.end_at = datetime.utcnow() - timedelta(hours=1)
        db.commit()
        db.close()

        status, data = call(
            "POST",
            f"/api/bookings/{b4}/dispute",
            {"kind": "absence", "description": "Intervenant absent"},
            T(sara),
        )
        ok(status == 201, "Signalement ouvert")
        dispute_id = data["id"]
        status, _ = call("GET", f"/api/disputes/{dispute_id}", token=T(amine))
        ok(status == 404, "RG19 : non-participant refusé")
        status, _ = call("POST", f"/api/bookings/{b4}/confirm", token=T(youssef))
        ok(status == 400, "Un litige bloque la confirmation et le transfert")
        status, _ = call(
            "POST",
            f"/api/admin/disputes/{dispute_id}/resolve",
            {"decision": "restitution", "reason": "Absence confirmée"},
            T(sara),
        )
        ok(status == 403, "Droits administrateur requis")
        status, _ = call(
            "POST",
            f"/api/admin/disputes/{dispute_id}/resolve",
            {"decision": "restitution", "reason": "Absence confirmée"},
            T(admin),
        )
        ok(status == 200, "Restitution des crédits")
        status, _ = call(
            "POST",
            f"/api/admin/disputes/{dispute_id}/resolve",
            {"decision": "transfert", "reason": "Second essai"},
            T(admin),
        )
        ok(status == 400, "RG14 : second règlement refusé")
        _, wallet = call("GET", "/api/wallet", token=T(sara))
        ok(wallet["balance"] == 3 and wallet["blocked"] == 0, "Crédits restitués intégralement")

        # --- RG08 : conflit de planning ---------------------------------
        base = datetime.utcnow() + timedelta(hours=200)
        _, data = call(
            "POST",
            "/api/offers",
            {
                "title": "Design",
                "category_id": 5,
                "skill": "Figma",
                "description": "UI",
                "level": "Débutant",
                "duration": 1,
                "mode": "À distance",
            },
            T(youssef),
        )
        o3 = data["id"]
        _, data = call(
            "POST",
            f"/api/offers/{o3}/slots",
            {"start_at": base.isoformat() + "Z", "location": "x"},
            T(youssef),
        )
        s3 = data["id"]
        _, data = call(
            "POST",
            "/api/offers",
            {
                "title": "Excel",
                "category_id": 6,
                "skill": "Excel",
                "description": "Tableaux",
                "level": "Débutant",
                "duration": 1,
                "mode": "À distance",
            },
            T(amine),
        )
        o4 = data["id"]
        _, data = call(
            "POST",
            f"/api/offers/{o4}/slots",
            {"start_at": (base + timedelta(minutes=30)).isoformat() + "Z", "location": "x"},
            T(amine),
        )
        s4 = data["id"]
        call("POST", f"/api/offers/{o3}/status", {"status": "publiée"}, T(youssef))
        call("POST", f"/api/offers/{o4}/status", {"status": "publiée"}, T(amine))
        _, data = call("POST", "/api/bookings", {"slot_id": s3}, T(sara))
        c1 = data["id"]
        _, data = call("POST", "/api/bookings", {"slot_id": s4}, T(sara))
        c2 = data["id"]
        status, _ = call("POST", f"/api/bookings/{c1}/accept", token=T(youssef))
        ok(status == 200, "Première séance acceptée")
        status, _ = call("POST", f"/api/bookings/{c2}/accept", token=T(amine))
        ok(status == 400, "RG08 : chevauchement horaire refusé")

        # --- RG05 : solde insuffisant ------------------------------------
        poor = register("poor@t.ma", "Poor")
        db = SessionLocal()
        from app.models import User

        user_row = db.get(User, poor["user"]["id"])
        user_row.balance = 0
        db.commit()
        db.close()
        status, _ = call("POST", "/api/bookings", {"slot_id": s3}, T(poor))
        ok(status == 400, "RG05 : solde insuffisant refusé")

        # --- RG17 : archivage -------------------------------------------
        _, data = call("POST", "/api/bookings", {"slot_id": s4}, T(youssef))
        c3 = data["id"]
        call("POST", f"/api/offers/{o4}/status", {"status": "archivée"}, T(amine))
        _, sent = call("GET", "/api/bookings?box=sent", token=T(youssef))
        ok(
            next(b for b in sent if b["id"] == c3)["status"] == "annulée",
            "RG17 : archivage annule les demandes en attente",
        )

        # --- RG18 : désactivation ---------------------------------------
        status, _ = call(
            "POST",
            f"/api/admin/users/{youssef['user']['id']}/active",
            {"active": False},
            T(admin),
        )
        ok(status == 200, "Désactivation du compte")
        status, _ = call(
            "POST", "/api/auth/login", {"email": "youssef@t.ma", "password": "password1"}
        )
        ok(status == 403, "RG18 : compte désactivé ne peut plus se connecter")
        status, _ = call("GET", "/api/admin/stats", token=T(admin))
        ok(status == 200, "Tableau de bord administrateur")
        status, _ = call("GET", "/api/admin/stats", token=T(sara))
        ok(status == 403, "Droits administrateur contrôlés côté serveur")

    print(f"\n{checks} vérifications réussies ✅")


if __name__ == "__main__":
    main()
