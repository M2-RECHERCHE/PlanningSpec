# Planning Spec — monorepo pnpm corrigé

Ce dépôt a été réorganisé pour avoir **une seule installation de dépendances à la racine** et une structure plus propre pour le backend Langium/Express.

## Ce qui a été corrigé

- passage à un **workspace `pnpm` unique** à la racine ;
- correction du `pnpm-workspace.yaml` pour inclure les vrais paquets du projet ;
- suppression de la logique Express du package `language` et création d'un package dédié `src/backend/packages/server` ;
- correction des scripts backend cassés (`apps/frontend`, `ts-node`, chemin `dist/src/server/server.js`, références manquantes, etc.) ;
- conversion des dépendances locales `planning-spec-language` vers `workspace:*` pour le CLI, l'extension et le serveur ;
- ajout d'un **README opérationnel** et de fichiers `.env.example` ;
- externalisation de l'URL backend côté frontend via `REACT_APP_API_BASE_URL` ;
- ajout explicite du champ `types` dans `planning-spec-language` pour que TypeScript résolve correctement les déclarations lors du build des autres paquets ;
- nettoyage du dépôt : les `node_modules`, builds générés et `package-lock.json` locaux ont été retirés du projet livré.

## Nouvelle architecture

```text
IMPLEMENTATION_V1/
├── src/
│   ├── backend/
│   │   ├── package.json              # orchestration du backend
│   │   ├── planning-solver-springboot/
│   │   └── packages/
│   │       ├── language/             # DSL Langium + génération MiniZinc
│   │       ├── server/               # API Express
│   │       ├── cli/                  # CLI Langium
│   │       └── extension/            # extension VS Code
│   ├── frontend/                     # interface React
│   └── python/                       # outils et benchmarks Python
├── deployment/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── docker-compose.release.yml
│   ├── docker-compose.prod.yml
│   └── docker/                       # Dockerfiles et nginx
├── docs/                             # documentation
├── run.sh                            # lancement Docker principal
├── package.json                      # orchestration globale
├── pnpm-workspace.yaml
└── .npmrc
```

## Prérequis

- **Node.js 20.10+**
- **pnpm 10+** via Corepack
- **MiniZinc** installé sur la machine pour utiliser `/api/solve`

## Installation

À la racine du projet :

```bash
corepack enable
corepack use pnpm@10.31.0
pnpm install
```

> Toute l'installation se fait maintenant **une seule fois à la racine**.

## Lancer le projet en développement

### Backend seul

```bash
pnpm dev:backend
```

### Frontend seul

```bash
pnpm dev:frontend
```

### Frontend + backend

```bash
pnpm dev
```

## Build

### Build complet

```bash
pnpm build
```

### Build backend uniquement

```bash
pnpm build:backend
```

### Génération Langium uniquement

```bash
pnpm langium:generate
```

## Tests

```bash
pnpm test
```

## Release

- Procédure complète de versioning/tagging: `docs/RELEASE_TAGGING.md`
- Historique des versions: `docs/CHANGELOG.md`

## Variables d'environnement

### Backend — `src/backend/packages/server/.env.example`

```env
PORT=4000
ALLOWED_ORIGINS=http://localhost:3000
MINIZINC_SOLVER=Highs
```

### Frontend — `src/frontend/.env.example`

```env
REACT_APP_API_BASE_URL=http://localhost:4000
```

## API backend

### `GET /api/health`
Vérifie que le serveur Express démarre correctement.

### `POST /api/solve`
Accepte soit :

```json
{
  "source": "{ ... }"
}
```

ou directement un corps JSON conforme à la grammaire `PlanningSpec`.

Le serveur :
1. construit un document Langium,
2. exécute la validation,
3. génère le fichier MiniZinc,
4. lance MiniZinc,
5. renvoie le résultat.

## Déploiement conseillé

### Serveur

```bash
pnpm install --frozen-lockfile
pnpm build:backend
pnpm start:backend
```

### Frontend

```bash
pnpm install --frozen-lockfile
pnpm build:frontend
```

Le dossier de build CRA est `src/frontend/build`.

## Remarques importantes
- La résolution TypeScript des imports du package local `planning-spec-language` passe par un alias `paths` dans `src/backend/tsconfig.json`, ce qui évite les erreurs TS7016 lors du build des paquets backend.

- Le package `src/backend/packages/language` ne contient plus le serveur HTTP : il sert uniquement au DSL.
- Le package `src/backend/packages/server` est maintenant le point d'entrée Express.
- Le frontend n'appelle plus une URL backend codée en dur : l'URL passe par `REACT_APP_API_BASE_URL`.


## Note de build TypeScript

Les paquets `server`, `cli` et `extension` consomment maintenant les déclarations déjà générées dans `src/backend/packages/language/out`, ce qui évite les erreurs `TS6305` liées aux project references lors du build.
