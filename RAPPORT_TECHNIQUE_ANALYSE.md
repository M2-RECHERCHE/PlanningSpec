# RAPPORT TECHNIQUE D'ANALYSE COMPLÈTE
## Monorepo Planning Spec — État actuel et plan d'évolution

**Date** : 19 mars 2026  
**Statut** : Analyse sans modifications du code  
**Objectif** : Comprendre l'architecture, identifier les points d'intégration, et planifier l'ajout de persistance + authentification

---

## 1. ARCHITECTURE ACTUELLE (FRONTEND/BACKEND)

### 1.1 Vue d'ensemble

C'est un **monorepo pnpm** composé de :
- **Backend** : Langium (DSL) + Express (API REST) + CLI + Extension VS Code
- **Frontend** : React 18 + Tailwind CSS + Material-UI + CodeMirror
- **Gestion des dépendances** : Workspace pnpm unique à la racine

```
IMPLEMENTATION_MONO_REPO_V1/
├── package.json (orchestration racine)
├── pnpm-workspace.yaml
├── backend/
│   ├── package.json (orchestration backend)
│   └── packages/
│       ├── language/      → DSL Langium + générateur MiniZinc
│       ├── server/        → API Express (port 4000 par défaut)
│       ├── cli/           → CLI Langium
│       └── extension/     → Extension VS Code
└── frontend/
    ├── package.json (React + dépendances UI)
    └── src/
        ├── App.tsx        → Routeur principal (Home, Planification)
        ├── views/         → Pages (Home, Planification)
        ├── components/    → Composants réutilisables
        │   └── PlanningWizard.tsx + steps/
        ├── model/         → Types TypeScript (Planning.ts)
        └── services/      → [ABSENT] À créer pour API
```

### 1.2 Architecture backend détaillée

#### Couche Langium (DSL)

**Package** : `backend/packages/language`

**Fichier DSL** : `src/planning-spec.langium` (119 lignes)

Grammaire définie :
- **Entry Point** : `Planification` (objet JSON structuré)
- **Time** : Jours + slotsPerDay
- **Activities** : Liste d'activités avec count et duration
- **Resources** : Types de ressources + instances (ex: Teacher, Room)
- **Roles** : Associations role → resourceType par activité
- **Constraints** : 4 types
  - `CardinalityPerActivity` : min/max occurrences d'un rôle
  - `ResourceExclusivity` : exclusivité de ressource par activité
  - `FixedAssignment` : assignation forcée (resource → activity)
  - `ForbiddenAssignment` : assignation interdite
- **Preferences** : 2 types
  - `AvoidParticipationOnDate` : éviter ressource à date donnée
  - `MaxPerScope` : limiter ressource par scope (ex: par jour, semaine)

**Classe `PlanningSpecValidator`** (`src/planning-spec-validator.ts`)
- Valide : `slotsPerDay > 0`, `min ≤ max`, poids préférences > 0
- Intégration Langium standard (ValidationAcceptor)

**Classe `PlanningSpecMiniZincGenerator`** (`src/planning-spec-minizinc-generator.ts`, 441 lignes)
- Compile DSL → MiniZinc 2.8 pour résolution de contraintes
- Génère enums, variables, contraintes globales
- Gère non-overlaps, cardinality, exclusivité ressources
- Exporte fichier `.mzn` et `json` dans répertoire temporaire

#### Couche API Express

**Package** : `backend/packages/server`

**Fichier** : `src/server.ts` (117 lignes)

**Endpoints** :

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/solve` | Parse JSON planning → valide Langium → génère MiniZinc → exécute `minizinc` → retourne solution |
| GET | `/api/health` | Santé du serveur (port, solver) |
| GET | `/` | Message "running" |

**CORS** : Configurable via `ALLOWED_ORIGINS` env (défaut: `http://localhost:3000`)

**Port** : `PORT` env (défaut: 4000)

**Solver** : `MINIZINC_SOLVER` env (défaut: `Highs`)

**Important** : 
- Aucune persistance de données ✗
- Pas d'authentification ✗
- Chaque requête crée un répertoire temporaire, l'exécute, puis le supprime

### 1.3 Architecture frontend détaillée

**Package** : `frontend`

**Point d'entrée** : `src/App.tsx` → Routeur React Router v7 → 2 routes :
1. `/` → `Home.tsx` (landing page)
2. `/planification` → `Planification.tsx` → `PlanningWizard.tsx`

**Flux utilisateur** (wizard) :

```
Accueil
  ↓
[Étape 0] TimeStep      → Jours + slotsPerDay
  ↓ (validation: ≥1 jour et slots > 0)
[Étape 1] ActivitiesStep → Nom, count, duration
  ↓ (validation: ≥1 activité)
[Étape 2] ResourcesStep  → Types ressources + instances
  ↓ (validation: ≥1 ressource)
[Étape 3] RolesStep      → Rôles + assignations ressource
  ↓ (validation: ≥1 rôle)
[Étape 4] ConstraintsStep → Ajouter contraintes (optionnel mais validation ≥1)
  ↓ (validation: ≥1 contrainte)
[Étape 5] PreferencesStep → Préférences (optionnel)
  ↓ (validation: aucune obligatoire)
[Étape 6] SummaryStep   → Résumé + bouton "Planifier/Résoudre"
  ↓ (POST /api/solve)
Résultat MiniZinc (stdout)
```

**Type de données** : `src/model/Planning.ts` → Interface TypeScript `PlanningData`

**Appels API** : 
- Base URL : `REACT_APP_API_BASE_URL` env (défaut: `http://localhost:4000`)
- Utilisé dans `PlanningWizard.tsx` avec Axios
- Pas de gestion d'erreur persistante, affichage dans `<pre>`

**État global** : Aucun store (Redux, Zustand, etc.) → props drilling dans PlanningWizard

**Styling** : 
- Tailwind CSS (postcss.config.js, tailwind.config.js)
- Material-UI components (@mui/material)
- CodeMirror integration (non utilisé actuellement sauf dépendance)

---

## 2. OÙ SE TROUVENT LES MODÈLES DE DONNÉES

### 2.1 Types TypeScript

**Frontend** (`frontend/src/model/Planning.ts`) — 40 lignes

```typescript
export interface PlanningData {
  time: { days: string[]; slotsPerDay: number };
  activities: Record<string, { count: number; duration: number }>;
  resources: Record<string, string[]>; // resourceType → instances
  roles: Record<string, Record<string, string>>; // activity → (role → resourceType)
  constraints: Array<{
    type: string;
    activity?: string; role?: string; resourceType?: string; target?: string;
    min?: number; max?: number; activityInstance?: string;
    resource?: string; scope?: string;
  }>;
  preferences: Array<{
    type: string; resource?: string; date?: string; resourceType?: string;
    activity?: string; scope?: string; max?: number; weight?: number;
  }>;
}
```

**Limitations** :
- Types très génériques (Union de champs optionnels)
- Pas de validation au runtime (yup, zod)
- Pas de sérialisation/désérialisation structurée

### 2.2 AST Langium (Backend)

**Backend** (`backend/packages/language/src/generated/ast.ts`) — généré automatiquement

Repose sur la grammaire `planning-spec.langium` :
- Classes : `Planification`, `Time`, `Activities`, `Resources`, `Roles`, `Constraints`, `Preferences`
- Chaque règle grammaire → classe TypeScript
- Parsing/validation via Langium

### 2.3 Où manquent les modèles pour la persistance

**Actuellement absent** :
- ❌ Modèle utilisateur (User, Profile)
- ❌ Modèle de planification persistée (Planning, version, créé_à, modifié_à, propriétaire)
- ❌ Historique/audit (qui a créé/modifié quand)
- ❌ Relations : User ↔ Planning (1-many)
- ❌ Statut de planning (brouillon, publié, archivé)
- ❌ Partage/permissions (rôles, droits d'accès)

---

## 3. CYCLE DE VIE : CRÉATION, MODIFICATION, RÉSOLUTION

### 3.1 Cycle actuel

#### Création

1. **Frontend** : Utilisateur complète le wizard (6 étapes)
   - Les données sont dans le state React `data: PlanningData`
2. **Frontend** : Clic "Planifier/Résoudre"
   - `handleSolve()` → POST `/api/solve` avec JSON `data`
3. **Backend** : 
   - Reçoit JSON brut
   - `normalizeSource()` → transforme en string JSON
   - Écrit dans fichier temporaire `.planning`
4. **Backend** : Création document Langium
   - `URI.file()` + `LangiumDocumentFactory.fromString()`
   - Parsing + validation
5. **Backend** : Génération MiniZinc
   - `generator.generateToFile()` → crée `.mzn`
6. **Backend** : Exécution solver
   - `execFile('minizinc', ['--solver', solver, mznPath])`
   - Capture stdout
7. **Backend** : Cleanup
   - `rmSync(tmpDir, { recursive: true })`
8. **Frontend** : Affichage résultat
   - stdout dans `<pre>` ou message d'erreur

**Aucune persistance** ❌

#### Modification

**N'existe pas actuellement** ❌

- Pas d'identifiant de planning
- Chaque résolution est stateless
- Impossible de revenir à une version antérieure

#### Résolution

Voir étapes 3-7 de la création. Le planificateur est immédiatement résolu (stateless).

### 3.2 Problèmes d'architecture actuels

| Problème | Impact |
|----------|--------|
| **Pas de persistance** | Chaque planning est perdu après fermeture navigateur |
| **Pas d'historique** | Impossible de comparer versions |
| **Pas d'utilisateur** | Chacun peut voir/modifier les plannings de tous |
| **Pas d'authentification** | N'importe qui peut accéder l'API |
| **État temporaire** | Fichiers `.mzn` + `.json` créés/supprimés à chaque fois |
| **Pas d'audit** | Impossible de tracker qui a fait quoi quand |

---

## 4. OÙ AJOUTER LA PERSISTANCE EN BASE

### 4.1 Proposition d'architecture BD

**Technologie recommandée** : PostgreSQL 14+ (robuste, mature, transactions ACID)

**Tables principales** :

```sql
-- Utilisateurs
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP -- soft delete
);

-- Planifications
CREATE TABLE plannings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR NOT NULL,
  description TEXT,
  status VARCHAR DEFAULT 'draft', -- draft, published, archived
  data JSONB NOT NULL, -- contient PlanningData complet
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP, -- soft delete
  UNIQUE(user_id, title) -- le titre est unique par utilisateur
);

-- Historique des planifications
CREATE TABLE planning_versions (
  id UUID PRIMARY KEY,
  planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
  data JSONB NOT NULL, -- snapshot de la version
  message VARCHAR, -- "résolu avec succès", "erreur validation", etc.
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- Résolutions (exécutions du solver)
CREATE TABLE planning_solutions (
  id UUID PRIMARY KEY,
  planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
  minizinc_input TEXT, -- le fichier .mzn généré
  minizinc_output TEXT, -- stdout du solver
  solver_used VARCHAR DEFAULT 'Highs',
  status VARCHAR DEFAULT 'success', -- success, validation_error, solver_error
  error_details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Partage/permissions
CREATE TABLE planning_shares (
  id UUID PRIMARY KEY,
  planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR DEFAULT 'view', -- view, edit, admin
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(planning_id, shared_with_user_id)
);

-- Audit logs (optionnel mais recommandé)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  resource_type VARCHAR, -- 'planning', 'user'
  resource_id VARCHAR,
  action VARCHAR, -- 'create', 'update', 'delete', 'solve'
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR,
  user_agent VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX idx_plannings_user_id ON plannings(user_id);
CREATE INDEX idx_plannings_status ON plannings(status);
CREATE INDEX idx_planning_versions_planning_id ON planning_versions(planning_id);
CREATE INDEX idx_planning_solutions_planning_id ON planning_solutions(planning_id);
CREATE INDEX idx_planning_shares_shared_with ON planning_shares(shared_with_user_id);
```

### 4.2 Emplacement du code backend pour BD

**À créer** : `backend/packages/server/src/`

```
src/
├── server.ts (existant)
├── database/
│   ├── connection.ts      # Pool PostgreSQL, migrations
│   ├── schema.sql         # Création tables
│   └── migrations/        # Migrations Prisma ou Liquibase
├── models/
│   ├── User.ts           # Types + queries
│   ├── Planning.ts       # Types + queries
│   └── Solution.ts       # Types + queries
├── routes/
│   ├── auth.ts           # POST /auth/register, /auth/login
│   ├── plannings.ts      # CRUD planifications
│   └── solutions.ts      # Résolutions
├── middleware/
│   ├── auth.ts           # Vérifier JWT
│   └── errorHandler.ts   # Gestion erreurs globales
└── services/
    ├── authService.ts    # Logique authentification
    └── planningService.ts # Logique métier planifications
```

### 4.3 Dépendances NPM à ajouter

Pour `backend/packages/server/package.json` :

```json
{
  "dependencies": {
    "pg": "^8.11.0",           // Pilote PostgreSQL
    "jsonwebtoken": "^9.1.0",   // JWT pour auth
    "bcryptjs": "^2.4.3",       // Hash mot de passe
    "dotenv": "^16.4.1"         // Variables env
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "prisma": "^5.8.0"          // Optionnel: ORM pour migrations
  }
}
```

---

## 5. AUTHENTIFICATION EMAIL/MOT DE PASSE

### 5.1 Flux proposé

```
[Frontend]
  1. POST /auth/register { email, password, name }
       ↓
  2. Backend valide email + crée user (hash pwd avec bcryptjs)
       ↓
  3. POST /auth/login { email, password }
       ↓
  4. Backend vérifie password + génère JWT (jsonwebtoken)
       ↓
  5. Frontend stocke JWT dans localStorage
       ↓
  6. Chaque requête inclut Authorization: Bearer <JWT>
       ↓
  7. Middleware backend vérifie JWT, extrait user_id
```

### 5.2 Emplacement du code frontend pour authentification

**À créer** : `frontend/src/`

```
src/
├── services/
│   ├── api.ts              # Axios instance + interceptors
│   ├── authService.ts      # Calls POST /auth/register, login
│   ├── planningService.ts  # Calls CRUD /api/plannings
│   └── solutionService.ts  # Calls POST /api/solve
├── context/
│   └── AuthContext.tsx     # useAuth hook + Provider
├── hooks/
│   ├── useAuth.ts          # useAuth custom hook
│   └── useLocalStorage.ts  # Persist token
├── pages/
│   ├── LoginPage.tsx       # Form login
│   ├── RegisterPage.tsx    # Form register
│   └── Dashboard.tsx       # Liste planifications (après login)
└── components/
    └── ProtectedRoute.tsx  # Wrapper pour routes privées
```

### 5.3 Endpoints authentification backend

**À implémenter** : `backend/packages/server/src/routes/auth.ts`

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/register` | `{ email, password, firstName, lastName }` → crée user + JWT |
| POST | `/auth/login` | `{ email, password }` → vérifie + JWT |
| POST | `/auth/logout` | Invalide JWT (blacklist ou stateless) |
| GET | `/auth/me` | Retourne profil utilisateur courant (requiert JWT) |
| POST | `/auth/refresh` | Renouvelle JWT expiré |

### 5.4 Middleware authentification

**À créer** : `backend/packages/server/src/middleware/auth.ts`

```typescript
// Pseudocode
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.userId, email: payload.email };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 5.5 Variables d'environnement à ajouter

**Backend** (`.env`) :

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/planning_spec
JWT_SECRET=my_super_secret_key_min_32_chars_long_plz
JWT_EXPIRY=7d
NODE_ENV=development
```

**Frontend** (`.env.local`) :

```bash
REACT_APP_API_BASE_URL=http://localhost:4000
REACT_APP_JWT_STORAGE_KEY=planning_spec_jwt
```

---

## 6. FICHIERS À MODIFIER / CRÉER

### 6.1 Backend — À créer

| Chemin | Type | Raison |
|--------|------|--------|
| `backend/packages/server/src/database/connection.ts` | Nouveau | Connexion PostgreSQL + pool |
| `backend/packages/server/src/database/schema.sql` | Nouveau | Définition tables |
| `backend/packages/server/src/models/User.ts` | Nouveau | Types + requêtes user |
| `backend/packages/server/src/models/Planning.ts` | Nouveau | Types + requêtes planning |
| `backend/packages/server/src/routes/auth.ts` | Nouveau | Endpoints register/login/logout |
| `backend/packages/server/src/routes/plannings.ts` | Nouveau | CRUD planifications |
| `backend/packages/server/src/routes/solutions.ts` | Nouveau | Exécution solver |
| `backend/packages/server/src/middleware/auth.ts` | Nouveau | Vérification JWT |
| `backend/packages/server/src/services/authService.ts` | Nouveau | Logique hash/JWT |
| `backend/packages/server/src/services/planningService.ts` | Nouveau | Logique métier planning |
| `backend/packages/server/.env.example` | Nouveau | Modèle variables env |

### 6.2 Backend — À modifier

| Chemin | Changement |
|--------|-----------|
| `backend/packages/server/src/server.ts` | Remplacer `/api/solve` POST direct par routes structurées + middlewares |
| `backend/packages/server/package.json` | Ajouter dépendances (pg, jwt, bcryptjs, dotenv) |
| `backend/packages/server/tsconfig.json` | Ajouter paths `@/models`, `@/services`, etc. (optionnel) |

### 6.3 Frontend — À créer

| Chemin | Type | Raison |
|--------|------|--------|
| `frontend/src/services/api.ts` | Nouveau | Axios instance + interceptors JWT |
| `frontend/src/services/authService.ts` | Nouveau | Appels register/login/logout |
| `frontend/src/services/planningService.ts` | Nouveau | Appels CRUD planifications |
| `frontend/src/context/AuthContext.tsx` | Nouveau | State authentification global |
| `frontend/src/hooks/useAuth.ts` | Nouveau | Custom hook pour accéder auth context |
| `frontend/src/pages/LoginPage.tsx` | Nouveau | Formulaire login |
| `frontend/src/pages/RegisterPage.tsx` | Nouveau | Formulaire register |
| `frontend/src/pages/DashboardPage.tsx` | Nouveau | Liste + CRUD planifications |
| `frontend/src/components/ProtectedRoute.tsx` | Nouveau | Wrapper routes privées |
| `frontend/.env.local` | Nouveau | Variables env frontend |

### 6.4 Frontend — À modifier

| Chemin | Changement |
|--------|-----------|
| `frontend/src/App.tsx` | Ajouter routes Auth + Dashboard + ProtectedRoute |
| `frontend/src/views/Home.tsx` | Adapter pour afficher "Connectez-vous d'abord" ou "Créer planning" (si connected) |
| `frontend/src/views/pages/Planification.tsx` | Ajouter persistance : sauvegarder/charger planning de BD |
| `frontend/src/components/PlanningWizard.tsx` | Intégrer save + API calls avec JWT |
| `frontend/src/index.tsx` | Wrapper `<AuthProvider>` |
| `frontend/package.json` | Ajouter dépendances (optionnel: zustand, react-query) |

### 6.5 Docker/Déploiement (optionnel mais recommandé)

| Chemin | Type | Raison |
|--------|------|--------|
| `Dockerfile.backend` | Nouveau | Build backend |
| `Dockerfile.frontend` | Nouveau | Build frontend (nginx) |
| `docker-compose.yml` | Nouveau | Orchestration postgres + backend + frontend |
| `.dockerignore` | Nouveau | Exclure node_modules, .git |

---

## 7. PLAN D'IMPLÉMENTATION EN ÉTAPES

### Phase 1 : Infrastructure et persistance (3-4 jours)

#### Étape 1.1 : Configuration PostgreSQL et migrations
**Dépendances** : Aucune  
**Risques** :
- Connexion BD instable en développement
- Migrations mal versionnées

**Actions** :
1. Créer `backend/packages/server/src/database/schema.sql` avec tables users, plannings, planning_versions, planning_solutions
2. Ajouter `backend/packages/server/src/database/connection.ts` (Pool pg)
3. Tester connexion en dev (docker-compose ou BD locale)

**Fichiers** : `connection.ts`, `schema.sql`, `docker-compose.yml`

---

#### Étape 1.2 : Modèles et requêtes de base
**Dépendances** : 1.1  
**Risques** :
- Typage TypeScript incomplet
- N+1 queries en BD

**Actions** :
1. Créer `backend/packages/server/src/models/User.ts` avec CRUD de base
2. Créer `backend/packages/server/src/models/Planning.ts` avec CRUD de base
3. Tests unitaires simples

**Fichiers** : `User.ts`, `Planning.ts`

---

### Phase 2 : Authentification (2-3 jours)

#### Étape 2.1 : Services d'authentification backend
**Dépendances** : 1.2  
**Risques** :
- Mots de passe non hashés (CRITIQUE)
- JWT secret faible

**Actions** :
1. Créer `backend/packages/server/src/services/authService.ts`
   - Hash passwords avec bcryptjs
   - Génération JWT avec jsonwebtoken
   - Vérification signatures
2. Tester hashs + JWTs
3. Créer `.env.example` avec JWT_SECRET, DATABASE_URL

**Fichiers** : `authService.ts`, `.env.example`, `package.json` (dépendances)

---

#### Étape 2.2 : Endpoints authentification backend
**Dépendances** : 2.1  
**Risques** :
- Erreurs exposent trop d'infos (email existe/pas)
- Rate limiting absent

**Actions** :
1. Créer `backend/packages/server/src/routes/auth.ts`
   - POST /auth/register
   - POST /auth/login
   - POST /auth/logout (optionnel initial)
   - GET /auth/me
2. Tests (Postman, curl)
3. Ajouter à `server.ts` : `app.use('/auth', authRouter);`

**Fichiers** : `auth.ts`, `server.ts` (modifié)

---

#### Étape 2.3 : Middleware JWT
**Dépendances** : 2.2  
**Risques** :
- Token expiré mal géré
- Bypass du middleware possible

**Actions** :
1. Créer `backend/packages/server/src/middleware/auth.ts`
2. Appliquer à toutes routes `/api/*` sauf `/auth/*`
3. Tester JWT valide/invalide/expiré

**Fichiers** : `auth.ts` (middleware), `server.ts` (modifié)

---

#### Étape 2.4 : Authentification frontend
**Dépendances** : 2.3  
**Risques** :
- JWT stocké en localStorage (vulnérable XSS)
- Pas de refresh token

**Actions** :
1. Créer `frontend/src/services/api.ts` (Axios + interceptors)
2. Créer `frontend/src/services/authService.ts`
3. Créer `frontend/src/context/AuthContext.tsx`
4. Créer `frontend/src/pages/LoginPage.tsx` + `RegisterPage.tsx`
5. Créer `frontend/src/components/ProtectedRoute.tsx`
6. Modifier `frontend/src/App.tsx` : ajouter routes Auth
7. Modifier `frontend/src/index.tsx` : wrapper AuthProvider

**Fichiers** : `api.ts`, `authService.ts`, `AuthContext.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `ProtectedRoute.tsx`, `App.tsx` (modifié), `index.tsx` (modifié)

---

### Phase 3 : Persistance des planifications (3-4 jours)

#### Étape 3.1 : Routes CRUD planifications backend
**Dépendances** : 2.3  
**Risques** :
- Droits d'accès mal vérifiés (utilisateur modifie planning d'autrui)
- Validation JSONB du schéma planning manquante

**Actions** :
1. Créer `backend/packages/server/src/routes/plannings.ts`
   - GET /api/plannings (liste planifications utilisateur)
   - GET /api/plannings/:id
   - POST /api/plannings (créer)
   - PUT /api/plannings/:id (modifier)
   - DELETE /api/plannings/:id
2. Implémenter authorization (req.user.id vs planning.user_id)
3. Tester CRUD + droits

**Fichiers** : `plannings.ts`, `server.ts` (modifié)

---

#### Étape 3.2 : Services métier planning backend
**Dépendances** : 3.1  
**Risques** :
- Validation Langium + BD désynchronisée
- Transactions longues bloquent connexions

**Actions** :
1. Créer `backend/packages/server/src/services/planningService.ts`
   - Valider planning avec Langium avant sauvegarde
   - Créer version (planning_versions table)
   - Snapshot JSONB dans plannings.data
2. Intégrer à routes CRUD

**Fichiers** : `planningService.ts`, `plannings.ts` (modifié)

---

#### Étape 3.3 : Endpoint résolution + persistance
**Dépendances** : 3.2  
**Risques** :
- Résolution MiniZinc longue (timeout)
- Fichiers `.mzn` temporaires orphelins

**Actions** :
1. Créer `backend/packages/server/src/routes/solutions.ts`
   - POST /api/plannings/:id/solve
   - Reuse `/api/solve` logic but add planning_id + user_id check
2. Implémenter timeout (5-30s selon complexity)
3. Sauvegarder solution dans planning_solutions table

**Fichiers** : `solutions.ts`, `server.ts` (modifié)

---

#### Étape 3.4 : Frontend persistance et CRUD
**Dépendances** : 3.3  
**Risques** :
- UX confusion : sauvegarder vs résoudre
- Perte données si refresh accidental

**Actions** :
1. Créer `frontend/src/services/planningService.ts`
2. Créer `frontend/src/pages/DashboardPage.tsx` (liste planifications)
3. Modifier `frontend/src/views/pages/Planification.tsx`
   - Charger planning depuis URL (edit mode)
   - Ajouter boutons Save + Resolve
4. Modifier `frontend/src/components/PlanningWizard.tsx`
   - Auto-save après chaque étape (optionnel)
   - Désactiver navigation sans save
5. Modifier `frontend/src/App.tsx` : ajouter /dashboard, /planning/:id routes

**Fichiers** : `planningService.ts`, `DashboardPage.tsx`, `Planification.tsx` (modifié), `PlanningWizard.tsx` (modifié), `App.tsx` (modifié)

---

### Phase 4 : Polissage et fonctionnalités optionnelles (2-3 jours)

#### Étape 4.1 : Gestion erreurs et validation
**Dépendances** : 3.4  
**Actions** :
1. Ajouter ErrorBoundary en frontend
2. Formatter messages erreurs BD vs MiniZinc
3. Ajouter @/model directory pour types partagés (optionnel)
4. Tests e2e : créer → modifier → résoudre → archiver

**Fichiers** : `ErrorBoundary.tsx`, tests e2e

---

#### Étape 4.2 : Historique et versioning
**Dépendances** : 3.4  
**Actions** :
1. Interface "Voir l'historique" pour planning_versions
2. Comparer deux versions (diff)
3. Restore version antérieure

**Fichiers** : `VersionsPage.tsx`, `solutions.ts` (modifié)

---

#### Étape 4.3 : Partage et permissions (optionnel initial)
**Dépendances** : 3.4  
**Actions** :
1. Table planning_shares (fait en 4.1)
2. Routes CRUD pour /api/plannings/:id/shares
3. UI pour inviter utilisateurs

**Fichiers** : `shares.ts` (route), `ShareDialog.tsx`

---

#### Étape 4.4 : Audit et observabilité
**Dépendances** : 3.4  
**Actions** :
1. Implémenter audit_logs table
2. Logger tous changements (create/update/delete/solve)
3. Dashboard admin (optionnel)

**Fichiers** : `auditLog.ts` (service), `AdminDashboard.tsx`

---

### Phase 5 : Déploiement et CI/CD (2 jours)

#### Étape 5.1 : Docker et orchestration
**Actions** :
1. Créer Dockerfile backend + frontend
2. Créer docker-compose.yml (postgres + backend + frontend)
3. Tester en conteneurs localement

**Fichiers** : `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`, `.dockerignore`

---

#### Étape 5.2 : CI/CD pipeline (optionnel)
**Actions** :
1. GitHub Actions (test + build + push registry)
2. Déploiement vers Azure App Service / Heroku

**Fichiers** : `.github/workflows/` (CI/CD config)

---

## 8. DÉPENDANCES ENTRE ÉTAPES (DAG)

```
┌─────────────────────────────────────────────────┐
│            1.1 PostgreSQL Setup                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         1.2 Models & CRUD Basics                │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┬───────────────┐
        │                 │               │
        ▼                 ▼               ▼
    ┌────────┐      ┌──────────┐    ┌─────────────┐
    │ 2.1    │      │ 3.1      │    │ 4.1, 4.2    │
    │Auth    │      │Planni    │    │(Future)     │
    │Service │      │ngs CRUD  │    └─────────────┘
    └────┬───┘      └────┬─────┘
         │               │
         ▼               ▼
    ┌────────┐      ┌──────────┐
    │ 2.2    │      │ 3.2      │
    │Auth EP │      │Planning  │
    │        │      │Services  │
    └────┬───┘      └────┬─────┘
         │               │
         ▼               ▼
    ┌────────┐      ┌──────────┐
    │ 2.3    │      │ 3.3      │
    │JWT MW  │      │Solutions │
    │        │      │Endpoint  │
    └────┬───┘      └────┬─────┘
         │               │
         ▼               ▼
    ┌────────────────────────┐
    │ 2.4 Frontend Auth      │
    └────┬───────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 3.4 Frontend CRUD      │
    └────┬───────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 4.1 Testing & Polish   │
    └────┬───────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 5 Deployment           │
    └────────────────────────┘
```

---

## 9. RISQUES IDENTIFIÉS ET MITIGATION

| # | Risque | Sévérité | Mitigation |
|----|--------|----------|-----------|
| 1 | **Données sensibles en localStorage** | HAUTE | Implémenter HttpOnly cookies + Refresh token flow (plus tard) |
| 2 | **Password non hashé** | CRITIQUE | bcryptjs obligatoire en 2.1, tests unitaires |
| 3 | **JWT secret faible** | HAUTE | Générer secret 32+ chars, variable env non commitée |
| 4 | **N+1 queries en BD** | MOYENNE | Tester avec PostgreSQL EXPLAIN, optimiser en 3.1 |
| 5 | **Validation Langium ≠ BD** | MOYENNE | Dupliquer validation en services/models ou créer shared validators |
| 6 | **Timeout MiniZinc long** | MOYENNE | Implémenter timeout 30s + queue job async (celery/bull) |
| 7 | **Autorisation : user A accède planning user B** | CRITIQUE | Check req.user.id == planning.user_id en tous endpoints |
| 8 | **CORS overly permissive** | HAUTE | Garder ALLOWED_ORIGINS strict en prod |
| 9 | **Migrations BD mal appliquées** | MOYENNE | Tester migrations en Docker avant prod |
| 10 | **UX confusion : save vs solve** | BASSE | Clear UI labels + confirmation dialogs |

---

## 10. ORDRE RECOMMANDÉ (CHEMIN CRITIQUE)

**Chemin critique pour MVP en 2-3 semaines** :

1. **Jour 1-2** : Phase 1.1 (PostgreSQL) + 1.2 (Models)
2. **Jour 3-5** : Phase 2.1-2.2 (Auth backend)
3. **Jour 5-6** : Phase 2.3 (JWT middleware)
4. **Jour 7-9** : Phase 2.4 (Auth frontend) + tester end-to-end login/register
5. **Jour 10-12** : Phase 3.1 (CRUD plannings backend)
6. **Jour 13-15** : Phase 3.2-3.3 (Services + solutions)
7. **Jour 16-18** : Phase 3.4 (Frontend CRUD + persist)
8. **Jour 19-20** : Phase 4.1 (Testing + polish)
9. **Jour 21** : Phase 5.1 (Docker)

**Parallélisation possible** :
- Frontend auth (2.4) et backend CRUD planning (3.1) peuvent commencer jour 7
- Phase 4 peut démarrer dès jour 16 en parallèle avec 3.4

---

## 11. QUICK CHECKLIST D'IMPLÉMENTATION

### ✅ Avant de commencer
- [ ] Cloner repo et installer dépendances
- [ ] PostgreSQL en local ou Docker
- [ ] Vérifier que `/api/solve` fonctionne actuellement
- [ ] Backup repo entier (git)

### ✅ Phase 1 (Infra)
- [ ] `schema.sql` créé et tables générées
- [ ] `connection.ts` connecte à PostgreSQL
- [ ] `User.ts` + `Planning.ts` modèles OK
- [ ] Tests simples queries (SELECT, INSERT)

### ✅ Phase 2 (Auth)
- [ ] `authService.ts` hash+JWT OK
- [ ] `/auth/register` crée user en BD
- [ ] `/auth/login` retourne JWT valide
- [ ] Middleware JWT valide/refuse tokens
- [ ] Frontend login form appelle backend
- [ ] JWT stocké en localStorage
- [ ] Axios interceptors ajoute Authorization header

### ✅ Phase 3 (Persistance)
- [ ] GET /api/plannings liste planifications
- [ ] POST /api/plannings crée planning en BD
- [ ] PUT /api/plannings/:id modifie
- [ ] DELETE /api/plannings/:id supprime (soft delete optionnel)
- [ ] POST /api/plannings/:id/solve exécute + stocke solution
- [ ] Frontend DashboardPage affiche liste utilisateur
- [ ] Frontend Planification charge/sauvegarde planning

### ✅ Phase 4 (Polish)
- [ ] Tous endpoints retournent errors structurées
- [ ] Frontend affiche messages erreur clairs
- [ ] Tests CRUD + authorization
- [ ] Historique versions accessible

### ✅ Phase 5 (Déploiement)
- [ ] Dockerfile builds sans erreur
- [ ] docker-compose.yml démarre 3 services
- [ ] Test end-to-end en conteneurs

---

## CONCLUSION

**État actuel** :
- ✅ DSL + générateur MiniZinc mature
- ✅ Frontend UI complète
- ❌ Aucune persistance
- ❌ Aucune authentification
- ❌ Stateless, données perdues après F5

**Plan** :
- 5 phases cohérentes et dépendantes
- ~21 jours de travail pour MVP complet
- Risques identifiés et mitigés
- Architecture extensible pour partage/audit/versioning

**Pas de modifications appliquées** (comme demandé). Prêt à commencer implémentation dès validation du plan.

