# Modélisation UML

Les diagrammes sont fournis sous deux formes complémentaires.

| Dossier | Contenu | Usage |
|---|---|---|
| `src/` | sources **PlantUML** (`.puml`) | fichiers texte modifiables avec n'importe quel éditeur |
| `exports/` | exports **SVG** (vectoriel) et **PNG** | lecture directe, insertion dans un rapport ou un diaporama |

## Diagrammes fournis

| Fichier | Diagramme | Règles illustrées |
|---|---|---|
| `01-cas-utilisation` | cas d'utilisation (2 acteurs, 24 cas) | ensemble du périmètre |
| `02-classes` | classes (10 classes, multiplicités, contraintes) | modèle de données |
| `03-sequence-inscription-connexion` | inscription et connexion | RG01, RG18 |
| `04-sequence-publier-offre` | publication d'une offre et de ses créneaux | RG04, RG09, RG17 |
| `05-sequence-reserver-seance` | demande d'un créneau puis acceptation | RG03, RG05 à RG08 |
| `06-sequence-realisation-transfert` | annulation, double confirmation, transfert | RG10 à RG14 |
| `07-sequence-litige` | signalement, échanges, décision de l'administrateur | RG13, RG14, RG19 |
| `08-sequence-moderation` | modération d'une offre, désactivation d'un compte | RG17, RG18 |

## Modifier un diagramme

1. Éditez le fichier `.puml` correspondant dans `src/`.
2. Régénérez l'export, au choix :
   - avec l'extension **PlantUML** de VS Code (`Alt + D` pour prévisualiser, commande *Export current diagram*) ;
   - avec le site <https://www.plantuml.com/plantuml> en collant le contenu du fichier ;
   - en ligne de commande, si PlantUML et Java sont installés :
     `plantuml -tsvg -tpng src/01-cas-utilisation.puml -o exports`.

Le préambule `skinparam` présent dans chaque source fixe les couleurs et la police pour que tous les
diagrammes restent visuellement cohérents.

## Convention de lecture

- Les blocs `alt` des diagrammes de séquence correspondent aux **exceptions réellement implémentées**,
  avec le message d'erreur renvoyé par l'API.
- Les références `RGxx` renvoient au tableau des règles de gestion du rapport (chapitre 3).
