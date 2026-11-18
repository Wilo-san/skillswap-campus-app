# 🔄 SkillSwap Campus

Application web d'échange de compétences entre étudiants, basée sur une **banque de temps** :
**1 crédit = 1 heure**. Chaque nouvel inscrit reçoit **2 crédits de bienvenue**, qu'il dépense
en réservant la séance d'un autre étudiant, et qu'il récupère en donnant lui-même des séances.

> Mini-projet GL & Modélisation UML (M234) — DUT GI S3, EST Béni Mellal.

Le projet contient **deux applications séparées** :

| Dossier | Rôle | Technologie | Adresse en local |
|---|---|---|---|
| `backend/` | API REST + base de données | Node.js, Express, SQLite | http://localhost:4000 |
| `frontend/` | Interface utilisateur | React 18, Vite, React Router | http://localhost:5173 |

Le frontend ne parle au backend que par HTTP (`/api/...`). Vous pouvez donc remplacer le backend
fourni par le vôtre : voir la section [Brancher votre propre backend](#brancher-votre-propre-backend).

---

## Sommaire

1. [Ce que fait l'application](#ce-que-fait-lapplication)
2. [Prérequis](#prérequis)
3. [Lancer l'application (pas à pas)](#lancer-lapplication-pas-à-pas)
4. [Comptes de test](#comptes-de-test)
5. [Vérifier que tout fonctionne](#vérifier-que-tout-fonctionne)
6. [Scénario de test complet](#scénario-de-test-complet)
7. [Variables d'environnement](#variables-denvironnement)
8. [Commandes npm](#commandes-npm)
9. [Réinitialiser la base de données](#réinitialiser-la-base-de-données)
10. [Tests automatisés](#tests-automatisés)
11. [Structure du projet](#structure-du-projet)
12. [Où sont appliquées les règles de gestion](#où-sont-appliquées-les-règles-de-gestion)
13. [API REST](#api-rest)
14. [Brancher votre propre backend](#brancher-votre-propre-backend)
15. [Dépannage](#dépannage)

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
| **Node.js** | 18 ou plus (20 LTS recommandé) | `node -v` |
| **npm** | fourni avec Node.js | `npm -v` |

Aucune base de données à installer : **SQLite est intégré** au backend et le fichier de base est
créé automatiquement au premier démarrage.

Si `node -v` affiche une erreur, installez Node.js LTS depuis <https://nodejs.org> (version « LTS »,
pas « Current »), puis **fermez et rouvrez** votre terminal.

---

## Lancer l'application (pas à pas)

L'application a besoin de **deux programmes en même temps** : le backend et le frontend.
Il faut donc **deux terminaux ouverts côte à côte** (par exemple deux fenêtres PowerShell).

### Étape 1 — Ouvrir un premier terminal et démarrer le backend

```bash
cd backend
npm install
npm start
```

- `npm install` télécharge les dépendances : à faire **une seule fois** (quelques dizaines de secondes).
- `npm start` démarre l'API et doit afficher :

```
SkillSwap API sur http://localhost:4000
```

**Laissez ce terminal ouvert** : le backend doit tourner pendant toute la durée de l'utilisation.

### Étape 2 — (Optionnel) Charger des données de démonstration

Dans un **troisième terminal** (ou après avoir arrêté le backend avec `Ctrl + C`) :

```bash
cd backend
npm run seed
```

Cela crée 2 étudiants et 3 offres déjà publiées avec des créneaux, pour tester immédiatement.
Cette commande est sans danger : elle ne crée pas de doublons si vous la relancez.

### Étape 3 — Ouvrir un second terminal et démarrer le frontend

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

### Étape 4 — Ouvrir l'application

Dans votre navigateur : **<http://localhost:5173>**

Vous arrivez sur la page de connexion. Connectez-vous avec un compte ci-dessous, ou créez un compte
avec le lien « S'inscrire » (2 crédits offerts).

> ⚠️ N'ouvrez pas <http://localhost:4000> dans le navigateur : c'est l'API, elle répond du JSON brut.
> L'interface est uniquement sur le port **5173**.

### Comment arrêter l'application

Dans chaque terminal : `Ctrl + C`, puis `O` si Windows demande confirmation.

### Windows : erreurs fréquentes au démarrage

PowerShell peut bloquer `npm` avec un message du type *« l'exécution de scripts est désactivée »*.
Dans ce cas, lancez une fois :

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Ou utilisez directement **Invite de commandes (cmd)** au lieu de PowerShell.

---

## Comptes de test

| Rôle | E-mail | Mot de passe | Comment l'obtenir |
|---|---|---|---|
| **Administrateur** | `admin@skillswap.ma` | `Admin123!` | créé automatiquement au premier démarrage |
| Étudiant 1 | `sara@campus.ma` | `password123` | après `npm run seed` |
| Étudiant 2 | `amine@campus.ma` | `password123` | après `npm run seed` |

L'administrateur n'a pas de portefeuille de crédits : sa connexion ouvre directement l'espace
d'administration. Pour tester un parcours étudiant, utilisez Sara ou Amine, ou créez un compte.

> En production, changez le mot de passe administrateur (il est défini dans `backend/src/db.js`)
> et la valeur de `JWT_SECRET` (voir [Variables d'environnement](#variables-denvironnement)).

---

## Vérifier que tout fonctionne

| Test | Résultat attendu |
|---|---|
| `curl http://localhost:4000/api/health` | `{"ok":true}` |
| Ouvrir <http://localhost:5173> | page de connexion SkillSwap Campus |
| Se connecter avec `sara@campus.ma` | catalogue avec les offres de démonstration |
| Mauvais mot de passe | message « Identifiants incorrects. » |
| Arrêter le backend puis recharger une page | message « Impossible de joindre le serveur… » |

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

## Variables d'environnement

### Backend

Copiez le modèle puis adaptez-le (facultatif, des valeurs par défaut existent) :

```bash
cd backend
cp .env.example .env      # Windows : copy .env.example .env
```

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `4000` | port d'écoute de l'API |
| `JWT_SECRET` | `dev-secret-change-me` | clé de signature des jetons de connexion — **à changer** |
| `DB_FILE` | `backend/skillswap.db` | emplacement du fichier SQLite |

Le fichier `.env` est lu automatiquement au démarrage (`dotenv`) et n'est **jamais** versionné.

### Frontend

| Variable | Défaut | Rôle |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | cible du proxy de développement pour `/api` |
| `VITE_API_BASE` | `/api` | préfixe des appels API côté navigateur |

En développement, vous n'avez **rien à configurer** : Vite redirige automatiquement `/api` vers le
backend. Si vous changez le port du backend, créez `frontend/.env.local` :

```
VITE_API_URL=http://localhost:4001
```

Pour un build de production servi par un autre serveur que Vite, indiquez l'URL complète de l'API
**au moment du build** (les variables `VITE_*` sont figées à la compilation) :

```bash
# macOS / Linux
VITE_API_BASE=http://localhost:4000/api npm run build

# Windows PowerShell
$env:VITE_API_BASE="http://localhost:4000/api"; npm run build
```

---

## Commandes npm

### `backend/`

| Commande | Effet |
|---|---|
| `npm start` | démarre l'API |
| `npm run dev` | démarre l'API et **redémarre automatiquement** à chaque modification |
| `npm run seed` | insère les données de démonstration (sans doublons) |
| `npm test` | lance les tests des règles de gestion (base en mémoire) |

### `frontend/`

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement avec rechargement à chaud |
| `npm run build` | build de production dans `frontend/dist/` |
| `npm run preview` | sert le build de production (port 4173) |

---

## Réinitialiser la base de données

Tout est stocké dans un seul fichier : `backend/skillswap.db`.

Pour repartir de zéro : arrêtez le backend (`Ctrl + C`), supprimez le fichier, redémarrez.

```bash
cd backend
rm skillswap.db skillswap.db-shm skillswap.db-wal    # Windows : del skillswap.db*
npm start
```

Au démarrage suivant, la base est recréée avec les catégories par défaut et le compte administrateur.
Relancez `npm run seed` si vous voulez retrouver les données de démonstration.

---

## Tests automatisés

```bash
cd backend
npm test
```

Le script vérifie les règles de gestion sur une base **en mémoire** : vos données réelles ne sont
jamais modifiées. Il couvre notamment le blocage et le transfert des crédits, le refus des doublons,
les conflits de planning, les droits d'accès, le déroulement d'un litige et l'unicité du règlement.

Résultat attendu :

```
43 vérifications réussies ✅
```

---

## Structure du projet

```
skillswap-campus-app/
├── backend/
│   ├── .env.example         modèle de configuration
│   ├── package.json
│   └── src/
│       ├── db.js            schéma SQLite, index, données initiales
│       ├── services.js      règles métier (crédits, réservations, litiges)
│       ├── server.js        routes REST + authentification JWT
│       ├── seed.js          données de démonstration
│       └── test.js          tests des règles de gestion
│
└── frontend/
    ├── index.html
    ├── vite.config.js       port 5173 + proxy /api → backend
    └── src/
        ├── main.jsx         point d'entrée
        ├── App.jsx          routes et navigation
        ├── api.js           client HTTP + formatage des dates
        ├── auth.jsx         contexte d'authentification
        ├── ui.jsx           composants réutilisables (badges, modales, notes)
        ├── styles.css
        └── pages/
            ├── Login.jsx, Register.jsx, Profile.jsx
            ├── Catalog.jsx, OfferDetail.jsx
            ├── MyOffers.jsx, OfferForm.jsx
            ├── Requests.jsx, Planning.jsx, Wallet.jsx
            ├── Notifications.jsx, Disputes.jsx, DisputeDetail.jsx
            └── admin/       tableau de bord, comptes, catégories, modération, litiges
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

Les contrôles sont faits **côté serveur** (l'interface ne fait que les refléter) et renforcés par
des contraintes SQL, afin qu'ils restent valables même en cas d'appels simultanés.

| Règle | Implémentation |
|---|---|
| RG01 — e-mail unique, 2 crédits une seule fois | `UNIQUE` sur `users.email`, inscription dans une transaction |
| RG02 — offre publiée, active, non masquée | filtres de `GET /api/offers` |
| RG03 — pas de réservation de sa propre offre, pas de doublon | contrôles + index unique partiel `uq_booking_dup` |
| RG04 — créneau futur et libre, pas de chevauchement d'offres | contrôles à la création du créneau |
| RG05 — solde suffisant | contrôle à la demande et à l'acceptation |
| RG06 — blocage à l'acceptation | `blocked` + mouvement `blocage` |
| RG07 — un seul bénéficiaire par créneau | index unique `uq_slot_active`, autres demandes refusées automatiquement |
| RG08 — pas de séances qui se chevauchent | `hasConflict()` à l'acceptation (séances consécutives autorisées) |
| RG09 — visibilité du lieu après acceptation | filtrage dans `offerView` / `bookingView` |
| RG10 — annulation avant le début, crédits libérés | `cancelBooking()` |
| RG11 — confirmation possible après l'heure de fin | `confirmBooking()` |
| RG12 — transfert après **double** confirmation | `transferCredits()` |
| RG13 — litige : crédits bloqués, décision admin | `openDispute()` / `resolveDispute()` |
| RG14 — règlement unique et définitif | index `uq_transfer_once`, `settled` |
| RG15 — une évaluation par participant et par séance | `UNIQUE(booking_id, author_id)` |
| RG16 — crédits jamais négatifs | `CHECK (balance >= 0)`, `CHECK (blocked >= 0)` |
| RG17 — archivage / masquage annule les demandes en attente | `cancelPendingForOffer()` |
| RG18 — compte désactivé : connexion et réservations bloquées | `setUserActive()` |
| RG19 — litiges et lieux réservés aux participants et à l'admin | contrôles d'accès sur chaque route |

Toutes les opérations sensibles s'exécutent dans des **transactions SQLite sérialisées** : deux clics
simultanés ne peuvent pas provoquer une double attribution de créneau ni un double transfert de crédits.
Les boutons de l'interface sont également désactivés pendant l'envoi d'une requête.

---

## API REST

Authentification par jeton : envoyez l'en-tête `Authorization: Bearer <token>` renvoyé par
`/auth/login` ou `/auth/register`. Les routes marquées **Admin** exigent le rôle `admin`.

### Authentification et profils

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/auth/register` | inscription (2 crédits offerts) |
| `POST` | `/api/auth/login` | connexion → `{ token, user }` |
| `GET` | `/api/me` | profil courant + note moyenne |
| `PUT` | `/api/me` | mise à jour du profil |
| `GET` | `/api/users/:id` | profil public + évaluations |

### Catégories

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/categories` | liste des catégories |
| `POST` | `/api/categories` | **Admin** — créer |
| `PUT` | `/api/categories/:id` | **Admin** — renommer |
| `DELETE` | `/api/categories/:id` | **Admin** — supprimer (refusé si utilisée) |

### Offres et créneaux

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/offers` | catalogue — filtres `q`, `category_id`, `level`, `mode`, `date`, `suggestions=1` |
| `GET` | `/api/offers/mine` | mes offres (tous états) |
| `GET` | `/api/offers/:id` | détail d'une offre |
| `POST` | `/api/offers` | créer une offre (brouillon) |
| `PUT` | `/api/offers/:id` | modifier (durée verrouillée si séance acceptée) |
| `POST` | `/api/offers/:id/status` | `{ status: "brouillon" \| "publiée" \| "archivée" }` |
| `POST` | `/api/offers/:id/slots` | ajouter un créneau `{ start_at, location }` |
| `DELETE` | `/api/slots/:id` | supprimer un créneau libre |

### Réservations

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/bookings` | demander un créneau `{ slot_id }` |
| `GET` | `/api/bookings?box=sent\|received` | mes demandes |
| `GET` | `/api/planning` | séances acceptées |
| `POST` | `/api/bookings/:id/accept` | intervenant : accepter (bloque les crédits) |
| `POST` | `/api/bookings/:id/refuse` | intervenant : refuser `{ reason }` |
| `POST` | `/api/bookings/:id/withdraw` | bénéficiaire : retirer une demande en attente |
| `POST` | `/api/bookings/:id/cancel` | annuler une séance avant son début |
| `POST` | `/api/bookings/:id/confirm` | confirmer la réalisation |
| `POST` | `/api/bookings/:id/review` | évaluer `{ rating, comment }` |
| `POST` | `/api/bookings/:id/dispute` | signaler `{ kind, description }` |

### Crédits, notifications, litiges

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/wallet` | solde, crédits bloqués, historique |
| `GET` | `/api/notifications` | mes notifications |
| `POST` | `/api/notifications/read` | tout marquer comme lu |
| `GET` | `/api/disputes` | mes litiges (tous pour l'admin) |
| `GET` | `/api/disputes/:id` | détail + messages |
| `POST` | `/api/disputes/:id/messages` | ajouter un message |
| `POST` | `/api/admin/disputes/:id/resolve` | **Admin** — `{ decision: "transfert" \| "restitution", reason }` |

### Administration

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/admin/stats` | indicateurs du tableau de bord |
| `GET` | `/api/admin/users` | tous les comptes |
| `POST` | `/api/admin/users/:id/active` | activer / désactiver `{ active }` |
| `GET` | `/api/admin/offers` | offres pour la modération |
| `POST` | `/api/admin/offers/:id/hide` | masquer / réafficher `{ hidden }` |
| `GET` | `/api/admin/bookings` | séances acceptées et en litige |
| `POST` | `/api/admin/bookings/:id/cancel` | annuler une séance (crédits libérés) |

---

## Brancher votre propre backend

Le frontend est indépendant du backend fourni. Pour utiliser le vôtre :

1. Implémentez les routes `/api/...` listées ci-dessus et renvoyez du JSON.
2. Authentifiez-vous avec un jeton `Bearer` (même mécanisme que JWT).
3. En cas d'erreur, renvoyez un code HTTP 4xx/5xx et un corps `{ "error": "message lisible" }` :
   c'est ce message qui s'affiche dans l'interface.
4. Indiquez l'adresse de votre API au frontend :
   - en développement : `frontend/.env.local` avec `VITE_API_URL=http://localhost:VOTRE_PORT` ;
   - si votre API est sur une autre origine : `VITE_API_BASE=http://localhost:VOTRE_PORT/api`
     (les CORS sont ouverts dans le backend fourni ; configurez-les chez vous).
5. Les règles de gestion doivent être appliquées **côté serveur** : l'interface ne fait que les
   afficher, elle ne peut pas garantir l'unicité d'un transfert de crédits.

Les formats de données attendus sont directement lisibles dans `frontend/src/pages/` et
`backend/src/server.js`.

---

## Dépannage

| Problème | Cause probable | Solution |
|---|---|---|
| `This site can't be reached` sur le port 5173 | frontend non démarré | lancer `npm run dev` dans `frontend/` |
| « Impossible de joindre le serveur » dans l'app | backend arrêté ou mauvais port | lancer `npm start` dans `backend/`, vérifier le port 4000 |
| `EADDRINUSE` au démarrage | port déjà utilisé | voir ci-dessous |
| Page blanche | ancien build ou erreur JS | `Ctrl + F5`, vider le cache, vérifier la console du navigateur |
| `npm install` échoue sur `better-sqlite3` | compilation native | installer Node.js **LTS**, puis `npm rebuild better-sqlite3` |
| « l'exécution de scripts est désactivée » (Windows) | politique PowerShell | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| Les données de démo n'apparaissent pas | `npm run seed` non lancé | lancer `npm run seed` dans `backend/` |
| Connexion refusée après `npm run seed` | base créée avec d'autres identifiants | supprimer `backend/skillswap.db` puis redémarrer |
| Modifications du code sans effet | serveur lancé avec `npm start` | utiliser `npm run dev` pour le rechargement automatique |

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

- Les notifications sont rafraîchies toutes les 15 secondes (pas de WebSocket) : l'interface n'est pas
  temps réel.
- Aucun envoi d'e-mail : l'adresse sert uniquement d'identifiant.
- Les crédits n'ont pas de valeur monétaire et ne sont ni achetables ni convertibles.
- Le fichier `backend/skillswap.db` et les dossiers `node_modules/` ne sont pas versionnés.
