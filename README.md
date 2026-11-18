# 🔄 SkillSwap Campus

Application web d'échange de compétences entre étudiants, basée sur une **banque de temps** :
**1 crédit = 1 heure**. Chaque nouvel inscrit reçoit **2 crédits de bienvenue**, qu'il dépense
en réservant la séance d'un autre étudiant, et qu'il récupère en donnant lui-même des séances.

> Mini-projet GL & Modélisation UML (M234) — DUT GI S3, EST Béni Mellal.

Le projet contient **deux applications séparées** :

| Dossier | Rôle | Technologie | Adresse en local |
|---|---|---|---|
| `backend/` | API REST + base de données | Python, FastAPI, SQLAlchemy, Alembic | http://localhost:4000 |
| `frontend/` | Interface utilisateur | React 18, Vite, React Router | http://localhost:5173 |

Le frontend ne parle au backend que par HTTP (`/api/...`). Les deux tournent séparément :
le backend doit être démarré **avant** d'ouvrir l'interface.

---

## Sommaire

1. [Ce que fait l'application](#ce-que-fait-lapplication)
2. [Prérequis](#prérequis)
3. [Lancer le backend Python](#lancer-le-backend-python)
4. [Lancer le frontend](#lancer-le-frontend)
5. [Comptes de test](#comptes-de-test)
6. [Vérifier que tout fonctionne](#vérifier-que-tout-fonctionne)
7. [Scénario de test complet](#scénario-de-test-complet)
8. [Base de données et migrations Alembic](#base-de-données-et-migrations-alembic)
9. [Variables d'environnement](#variables-denvironnement)
10. [Commandes utiles](#commandes-utiles)
11. [Tests automatisés](#tests-automatisés)
12. [Structure du projet](#structure-du-projet)
13. [Où sont appliquées les règles de gestion](#où-sont-appliquées-les-règles-de-gestion)
14. [API REST](#api-rest)
15. [Brancher le frontend sur une autre API](#brancher-le-frontend-sur-une-autre-api)
16. [Dépannage](#dépannage)

---

## Ce que fait l'application

**Côté étudiant**

- Inscription / connexion, profil (filière, compétences proposées, compétences recherchées, note moyenne).
- Création d'offres de séances : catégorie, compétence, niveau, durée (1 h ou 2 h), présentiel ou distanciel.
- Gestion des créneaux (date + heure), publication / dépublication / archivage de l'offre.
- Catalogue avec recherche par mot-clé, catégorie, niveau, mode et date.
- Onglet **✨ Suggestions** : offres qui correspondent aux compétences recherchées dans le profil.
- Demande de réservation, suivi des demandes envoyées et reçues, acceptation ou refus motivé.
- Planning personnel des séances acceptées, avec le lieu ou le lien de réunion (privé).
- Portefeuille de crédits : solde disponible, crédits bloqués, historique détaillé des mouvements.
- Confirmation de réalisation de la séance (double confirmation), puis évaluation de 1 à 5 étoiles.
- Signalement d'un problème (absence, désaccord, confirmation manquante) et échanges sur le litige.
- Notifications dans l'espace personnel.

**Côté administrateur**

- Tableau de bord : comptes actifs, offres publiées, séances acceptées / réalisées, crédits transférés, litiges ouverts.
- Gestion des comptes : activation et désactivation.
- Gestion des catégories de compétences.
- Modération des offres (masquer / réafficher).
- Traitement des litiges avec décision motivée et définitive.

---

## Prérequis

| Outil | Version | Vérifier avec |
|---|---|---|
| **Python** | 3.10 ou plus (3.11 recommandé) | `python --version` |
| **Node.js** | 18 ou plus | `node -v` |
| **npm** | fourni avec Node.js | `npm -v` |

Aucun serveur de base de données à installer : le projet utilise **SQLite** par défaut, un simple
fichier créé automatiquement. Le passage à **PostgreSQL** est possible sans changer le code
(voir [Base de données et migrations Alembic](#base-de-données-et-migrations-alembic)).

Sous Windows, si `python` n'est pas reconnu, essayez `py --version` et remplacez `python` par `py`
dans toutes les commandes ci-dessous.

---

## Lancer le backend Python

### Étape 1 — Créer et activer un environnement virtuel

Un environnement virtuel isole les dépendances du projet de celles du système.

```bash
cd backend
python -m venv .venv
```

Activation :

```bash
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Windows (cmd)
.venv\Scripts\activate.bat

# macOS / Linux
source .venv/bin/activate
```

Le prompt du terminal commence alors par `(.venv)`.

### Étape 2 — Installer les dépendances

```bash
pip install -r requirements.txt
```

Cela installe FastAPI, Uvicorn, SQLAlchemy, Alembic, PyJWT, bcrypt et python-dotenv.
À faire **une seule fois** par environnement.

### Étape 3 — Créer la base de données avec Alembic

```bash
python -m alembic upgrade head
```

Cette commande applique la migration `0001_schema_initial` et crée toutes les tables
(`users`, `offers`, `slots`, `bookings`, `credit_movements`, `reviews`, `disputes`, …)
dans le fichier `backend/skillswap.db`.

### Étape 4 — (Optionnel) Charger des données de démonstration

```bash
python -m app.seed
```

Crée 2 étudiants et 3 offres publiées avec des créneaux, pour tester immédiatement.
La commande ne crée pas de doublons si vous la relancez.

### Étape 5 — Démarrer l'API

```bash
python -m uvicorn app.main:app --reload --port 4000
```

Vous devez voir :

```
INFO:     Uvicorn running on http://127.0.0.1:4000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

**Laissez ce terminal ouvert.** L'option `--reload` redémarre automatiquement le serveur
à chaque modification d'un fichier Python.

> La documentation interactive de l'API est disponible sur <http://localhost:4000/docs>.
> Elle permet de tester chaque route directement depuis le navigateur.

---

## Lancer le frontend

Ouvrez **un second terminal** (le backend doit continuer de tourner) :

```bash
cd frontend
npm install
npm run dev
```

Le terminal affiche :

```
  VITE v5.4.21  ready in 174 ms
  ➜  Local:   http://localhost:5173/
```

Ouvrez ensuite **<http://localhost:5173>** dans votre navigateur.

> ⚠️ N'ouvrez pas <http://localhost:5173> avant d'avoir démarré le backend : la page s'afficherait
> mais la connexion échouerait avec « Impossible de joindre le serveur ».

---

## Comptes de test

| Rôle | E-mail | Mot de passe | Comment l'obtenir |
|---|---|---|---|
| **Administrateur** | `admin@skillswap.ma` | `Admin123!` | créé automatiquement au démarrage de l'API |
| Étudiant 1 | `sara@campus.ma` | `password123` | après `python -m app.seed` |
| Étudiant 2 | `amine@campus.ma` | `password123` | après `python -m app.seed` |

L'administrateur n'a pas de portefeuille de crédits : sa connexion ouvre directement l'espace
d'administration. Pour tester un parcours étudiant, utilisez Sara ou Amine, ou créez un compte.

Les identifiants de l'administrateur se changent avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`
dans le fichier `.env`.

---

## Vérifier que tout fonctionne

| Test | Résultat attendu |
|---|---|
| <http://localhost:4000/api/health> | `{"ok":true}` |
| <http://localhost:4000/docs> | documentation interactive FastAPI |
| <http://localhost:5173> | page de connexion SkillSwap Campus |
| Se connecter avec `sara@campus.ma` | catalogue avec les offres de démonstration |
| Mauvais mot de passe | message « Identifiants incorrects. » |

---

## Scénario de test complet

Pour vérifier le fonctionnement de bout en bout, utilisez **deux navigateurs différents**
(ou une fenêtre de navigation privée) afin d'être connecté avec deux comptes à la fois.

1. **Sara** (`sara@campus.ma`) → *Mes offres* → **+ Nouvelle offre** : remplir, enregistrer.
2. Sur la page de l'offre, ajouter un **créneau** futur (date + heure + salle ou lien).
3. Cliquer sur **Publier**. L'offre apparaît dans le catalogue des autres étudiants.
4. **Amine** (`amine@campus.ma`) → *Catalogue* → ouvrir l'offre de Sara → **Demander ce créneau**.
5. Son solde ne change pas encore : les crédits ne sont **pas** débités à la demande.
6. **Sara** → *Demandes* → onglet *Reçues* → **Accepter**.
   À cet instant, **1 ou 2 crédits sont bloqués** chez Amine (visibles dans *Crédits*).
7. Le créneau disparaît du catalogue : il est attribué. Les autres demandes éventuelles sont refusées automatiquement.
8. Attendre l'heure de fin de la séance, puis **chaque participant** clique sur **Confirmer la réalisation**.
9. Après la **deuxième** confirmation, les crédits passent d'Amine à Sara : le transfert est unique.
10. Chacun peut ensuite **évaluer** l'autre participant (1 étoile à 5 étoiles + commentaire).
11. Pour tester un **litige** : après le début d'une séance acceptée, cliquer sur **Signaler un problème**.
    Les crédits restent bloqués ; l'administrateur tranche (transfert ou restitution) depuis *Litiges*.

---

## Base de données et migrations Alembic

Le schéma est **versionné par Alembic** : la base n'est jamais créée à la main, elle est
construite en appliquant les migrations.

| Commande | Effet |
|---|---|
| `python -m alembic upgrade head` | applique toutes les migrations (crée la base si besoin) |
| `python -m alembic current` | affiche la version actuelle du schéma |
| `python -m alembic history` | liste les migrations |
| `python -m alembic downgrade -1` | annule la dernière migration |
| `python -m alembic revision --autogenerate -m "ajout table x"` | génère une migration à partir des modèles |

**Ajouter une table ou une colonne** : modifiez `backend/app/models.py`, puis

```bash
python -m alembic revision --autogenerate -m "description du changement"
python -m alembic upgrade head
```

Relisez toujours le fichier généré dans `backend/alembic/versions/` avant de l'appliquer.

**Repartir d'une base vide** : arrêtez l'API, supprimez le fichier, relancez les migrations.

```bash
# Windows
del skillswap.db*

# macOS / Linux
rm skillswap.db*

python -m alembic upgrade head
python -m app.seed        # facultatif
```

**Passer à PostgreSQL** (facultatif) : installez le pilote, puis indiquez l'URL de connexion.

```bash
pip install "psycopg[binary]"
```

Dans `backend/.env` :

```
DATABASE_URL=postgresql+psycopg://utilisateur:motdepasse@localhost:5432/skillswap
```

Puis `python -m alembic upgrade head`. Aucun autre changement n'est nécessaire : les modèles
et les index (y compris les index partiels) sont compatibles PostgreSQL.

---

## Variables d'environnement

Copiez le modèle puis adaptez-le (facultatif, des valeurs par défaut existent) :

```bash
cd backend
cp .env.example .env      # Windows : copy .env.example .env
```

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `4000` | port conseillé pour l'API (passé à Uvicorn en ligne de commande) |
| `DATABASE_URL` | `sqlite:///backend/skillswap.db` | base de données (SQLite ou PostgreSQL) |
| `JWT_SECRET` | clé de développement | signature des jetons — **à changer** |
| `ADMIN_EMAIL` | `admin@skillswap.ma` | e-mail du compte administrateur créé au démarrage |
| `ADMIN_PASSWORD` | `Admin123!` | mot de passe de ce compte |

Le fichier `.env` est lu automatiquement au démarrage (`python-dotenv`) et n'est **jamais** versionné.

Côté frontend, deux variables facultatives :

| Variable | Défaut | Rôle |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | cible du proxy de développement pour `/api` |
| `VITE_API_BASE` | `/api` | préfixe des appels API côté navigateur |

---

## Commandes utiles

### `backend/` (environnement virtuel activé)

| Commande | Effet |
|---|---|
| `python -m uvicorn app.main:app --reload --port 4000` | démarre l'API avec rechargement automatique |
| `python -m alembic upgrade head` | applique les migrations |
| `python -m app.seed` | données de démonstration |
| `python -m app.test_rules` | tests des règles de gestion |

### `frontend/`

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement (port 5173) |
| `npm run build` | build de production dans `frontend/dist/` |
| `npm run preview` | sert le build de production (port 4173) |

---

## Tests automatisés

```bash
cd backend
python -m app.test_rules
```

Le script crée une base **temporaire** (vos données ne sont pas touchées), applique la migration
Alembic, puis vérifie les règles de gestion : blocage et transfert des crédits, refus des doublons,
conflits de planning, droits d'accès, déroulement d'un litige, unicité du règlement.

Résultat attendu :

```
42 vérifications réussies ✅
```

---

## Structure du projet

```
skillswap-campus-app/
├── backend/                        API Python
│   ├── .env.example                modèle de configuration
│   ├── requirements.txt            dépendances Python
│   ├── alembic.ini                 configuration Alembic
│   ├── alembic/
│   │   ├── env.py                  branchement d'Alembic sur les modèles
│   │   └── versions/
│   │       └── 0001_schema_initial.py   migration initiale
│   └── app/
│       ├── config.py               configuration (.env)
│       ├── db.py                   moteur et session SQLAlchemy
│       ├── models.py               tables (User, Offer, Slot, Booking, …)
│       ├── schemas.py              schémas Pydantic d'entrée
│       ├── security.py             bcrypt + jetons JWT
│       ├── serializers.py          conversion en JSON pour le frontend
│       ├── services.py             règles métier RG01 à RG19
│       ├── main.py                 application FastAPI et routes
│       ├── seed.py                 données de démonstration
│       └── test_rules.py           tests des règles de gestion
│
└── frontend/                       interface React
    ├── vite.config.js              port 5173 + proxy /api → backend
    └── src/
        ├── App.jsx                 routes et navigation
        ├── api.js                  client HTTP
        ├── auth.jsx                contexte d'authentification
        ├── ui.jsx                  composants réutilisables
        └── pages/                  catalogue, offres, demandes, crédits, admin…
```

**Pages de l'interface**

| Adresse | Page |
|---|---|
| `/login`, `/register` | connexion, inscription |
| `/` | catalogue + suggestions |
| `/offers/:id` | détail d'une offre et demande de créneau |
| `/my-offers`, `/my-offers/new`, `/my-offers/:id` | mes offres, création, édition + créneaux |
| `/requests` | demandes reçues / envoyées |
| `/planning` | séances acceptées |
| `/wallet` | crédits et historique |
| `/profile`, `/users/:id` | mon profil, profil public |
| `/disputes`, `/disputes/:id` | signalements |
| `/admin/...` | espace administrateur (rôle admin uniquement) |

---

## Où sont appliquées les règles de gestion

Tous les contrôles sont faits **côté serveur** (`app/services.py`) et renforcés par des
contraintes SQL, afin qu'ils restent valables même en cas d'appels simultanés.

| Règle | Implémentation |
|---|---|
| RG01 — e-mail unique, 2 crédits une seule fois | colonne `email` unique + inscription transactionnelle |
| RG02 — offre publiée, active, non masquée | filtres de `GET /api/offers` |
| RG03 — pas de réservation de sa propre offre, pas de doublon | `request_booking()` + index unique `uq_booking_dup` |
| RG04 — créneau futur et libre, pas de chevauchement d'offres | `add_slot()` et `change_offer_status()` |
| RG05 — solde suffisant | contrôles à la demande et à l'acceptation |
| RG06 — blocage à l'acceptation | `accept_booking()` + mouvement `blocage` |
| RG07 — un seul bénéficiaire par créneau | index unique `uq_slot_active`, autres demandes refusées |
| RG08 — pas de séances qui se chevauchent | `has_conflict()` (séances consécutives autorisées) |
| RG09 — visibilité du lieu après acceptation | `offer_view()` / `booking_view()` |
| RG10 — annulation avant le début, crédits libérés | `cancel_booking()` |
| RG11 — confirmation après l'heure de fin | `confirm_booking()` |
| RG12 — transfert après **double** confirmation | `transfer_credits()` |
| RG13 — litige : crédits bloqués, décision admin | `open_dispute()` / `resolve_dispute()` |
| RG14 — règlement unique et définitif | index `uq_transfer_once` + `settled` |
| RG15 — une évaluation par participant et par séance | `UniqueConstraint(booking_id, author_id)` |
| RG16 — crédits jamais négatifs | `CHECK (balance >= 0)`, `CHECK (blocked >= 0)` |
| RG17 — archivage / masquage annule les demandes en attente | `cancel_pending_for_offer()` |
| RG18 — compte désactivé : connexion et réservations bloquées | `set_user_active()` |
| RG19 — litiges et lieux réservés aux participants et à l'admin | contrôles d'accès sur chaque route |

---

## API REST

Authentification par jeton : envoyez l'en-tête `Authorization: Bearer <token>` renvoyé par
`/api/auth/login` ou `/api/auth/register`. Les routes marquées **Admin** exigent le rôle `admin`.
Toutes les erreurs renvoient un code HTTP 4xx/5xx et un corps `{ "error": "message" }`.

### Authentification et profils

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/auth/register` | inscription (2 crédits offerts) |
| `POST` | `/api/auth/login` | connexion → `{ token, user }` |
| `GET` | `/api/me` | profil courant + note moyenne |
| `PUT` | `/api/me` | mise à jour du profil |
| `GET` | `/api/users/{id}` | profil public + évaluations |

### Catégories

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/categories` | liste des catégories |
| `POST` | `/api/categories` | **Admin** — créer |
| `PUT` | `/api/categories/{id}` | **Admin** — renommer |
| `DELETE` | `/api/categories/{id}` | **Admin** — supprimer (refusé si utilisée) |

### Offres et créneaux

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/offers` | catalogue — filtres `q`, `category_id`, `level`, `mode`, `date`, `suggestions=1` |
| `GET` | `/api/offers/mine` | mes offres (tous états) |
| `GET` | `/api/offers/{id}` | détail d'une offre |
| `POST` | `/api/offers` | créer une offre (brouillon) |
| `PUT` | `/api/offers/{id}` | modifier (durée verrouillée si séance acceptée) |
| `POST` | `/api/offers/{id}/status` | `{ "status": "brouillon" \| "publiée" \| "archivée" }` |
| `POST` | `/api/offers/{id}/slots` | ajouter un créneau `{ start_at, location }` |
| `DELETE` | `/api/slots/{id}` | supprimer un créneau libre |

### Réservations

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/bookings` | demander un créneau `{ slot_id }` |
| `GET` | `/api/bookings?box=sent\|received` | mes demandes |
| `GET` | `/api/planning` | séances acceptées |
| `POST` | `/api/bookings/{id}/accept` | intervenant : accepter (bloque les crédits) |
| `POST` | `/api/bookings/{id}/refuse` | intervenant : refuser `{ reason }` |
| `POST` | `/api/bookings/{id}/withdraw` | bénéficiaire : retirer une demande en attente |
| `POST` | `/api/bookings/{id}/cancel` | annuler une séance avant son début |
| `POST` | `/api/bookings/{id}/confirm` | confirmer la réalisation |
| `POST` | `/api/bookings/{id}/review` | évaluer `{ rating, comment }` |
| `POST` | `/api/bookings/{id}/dispute` | signaler `{ kind, description }` |

### Crédits, notifications, litiges

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/wallet` | solde, crédits bloqués, historique |
| `GET` | `/api/notifications` | mes notifications |
| `POST` | `/api/notifications/read` | tout marquer comme lu |
| `GET` | `/api/disputes` | mes litiges (tous pour l'admin) |
| `GET` | `/api/disputes/{id}` | détail + messages |
| `POST` | `/api/disputes/{id}/messages` | ajouter un message |
| `POST` | `/api/admin/disputes/{id}/resolve` | **Admin** — `{ decision, reason }` |

### Administration

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/admin/stats` | indicateurs du tableau de bord |
| `GET` | `/api/admin/users` | tous les comptes |
| `POST` | `/api/admin/users/{id}/active` | activer / désactiver `{ active }` |
| `GET` | `/api/admin/offers` | offres pour la modération |
| `POST` | `/api/admin/offers/{id}/hide` | masquer / réafficher `{ hidden }` |
| `GET` | `/api/admin/bookings` | séances acceptées et en litige |
| `POST` | `/api/admin/bookings/{id}/cancel` | annuler une séance (crédits libérés) |

---

## Brancher le frontend sur une autre API

Par défaut, le frontend appelle `/api` et le serveur de développement Vite **redirige** ces appels
vers `http://localhost:4000` (voir `frontend/vite.config.js`). Rien à configurer si l'API écoute
sur ce port.

**Si votre API écoute sur un autre port**, créez `frontend/.env.local` :

```
VITE_API_URL=http://localhost:8000
```

**Si votre API est sur une autre origine** (autre machine, autre domaine), indiquez l'URL complète.
Cette variable est lue **au moment du build** :

```bash
# macOS / Linux
VITE_API_BASE=http://192.168.1.10:8000/api npm run build

# Windows PowerShell
$env:VITE_API_BASE="http://192.168.1.10:8000/api"; npm run build
```

Pour rester compatible avec l'interface, votre API doit :

1. exposer les routes `/api/...` listées ci-dessus ;
2. authentifier par jeton `Bearer` ;
3. renvoyer les erreurs sous la forme `{ "error": "message lisible" }` ;
4. renvoyer les dates de créneaux avec fuseau (`2026-11-20T17:00:00Z`) et les horodatages
   sans fuseau (`2026-11-20T17:00:00`), comme le fait `app/serializers.py` ;
5. autoriser les requêtes cross-origin (CORS) si le frontend et l'API n'ont pas le même port.

---

## Dépannage

| Problème | Cause probable | Solution |
|---|---|---|
| `python : commande introuvable` | Python absent du PATH | utilisez `py` sous Windows, ou réinstallez Python en cochant « Add to PATH » |
| `.venv\Scripts\Activate.ps1` refusé | politique PowerShell | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| `ModuleNotFoundError: No module named 'app'` | commande lancée hors de `backend/` | placez-vous dans `backend/` avant de lancer la commande |
| `alembic : commande introuvable` | environnement virtuel non activé | `python -m alembic upgrade head` |
| `no such table: users` | migrations non appliquées | `python -m alembic upgrade head` |
| `no such table: alembic_version` | base créée hors migration | supprimez `skillswap.db*` puis relancez les migrations |
| `Address already in use` (port 4000) | ancien serveur encore actif | fermez le terminal concerné, ou `--port 4001` + `VITE_API_URL` |
| « Impossible de joindre le serveur » dans l'app | API arrêtée | relancez `python -m uvicorn app.main:app --reload --port 4000` |
| Page blanche | erreur JavaScript | `F12` → Console, puis `Ctrl + F5` |
| `ModuleNotFoundError: psycopg` | PostgreSQL sans pilote | `pip install "psycopg[binary]"` |
| Les données de démo n'apparaissent pas | seed non lancé | `python -m app.seed` |
| Connexion refusée après changement de `.env` | ancien compte en base | supprimez `skillswap.db*`, refaites les migrations |

**Libérer un port occupé**

```bash
# Windows (PowerShell)
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# macOS / Linux
lsof -i :4000
kill -9 <PID>
```

---

## Notes et limites

- Les notifications sont rafraîchies toutes les 15 secondes (pas de WebSocket) : l'interface n'est
  pas temps réel.
- Aucun envoi d'e-mail : l'adresse sert uniquement d'identifiant.
- Les crédits n'ont pas de valeur monétaire et ne sont ni achetables ni convertibles.
- Le jeton de connexion expire au bout de 7 jours : il suffit de se reconnecter.
