# DOCUMENTATION TECHNIQUE COMPLÉMENTAIRE
## Diagrammes, schémas et checklist détaillée

---

## DIAGRAMME 1 : ARCHITECTURE ACTUELLE (SANS PERSISTANCE)

```
┌─────────────────────────────────────────────────────────────────┐
│                       UTILISATEUR (Navigateur)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                  ┌────────▼─────────┐
                  │  React 18 Frontend│
                  │  (Port 3000)      │
                  │ ┌───────────────┐ │
                  │ │ Home.tsx      │ │
                  │ │ Planification │ │
                  │ │ PlanningWizar │ │
                  │ │   (6 steps)   │ │
                  │ └───────────────┘ │
                  └────────┬──────────┘
                           │ POST /api/solve
                           │ JSON PlanningData
                           │
        ┌──────────────────▼──────────────────┐
        │    Express Server (Port 4000)       │
        │ ┌──────────────────────────────────┐│
        │ │ Endpoints:                       ││
        │ │ - GET /api/health               ││
        │ │ - POST /api/solve               ││
        │ │   (parse → validate → generate) ││
        │ │   (minizinc execution)          ││
        │ │   → cleanup temp files          ││
        │ └──────────────────────────────────┘│
        │ ┌──────────────────────────────────┐│
        │ │ Langium Pipeline:                ││
        │ │ 1. Validate DSL (planning-spec) ││
        │ │ 2. Generate MiniZinc code       ││
        │ │ 3. Write temp .mzn file        ││
        │ └──────────────────────────────────┘│
        └──────┬───────────────────────────────┘
               │ Shell: minizinc --solver Highs
               │
        ┌──────▼──────────────────┐
        │  MiniZinc Solver        │
        │  (External process)     │
        └──────┬───────────────────┘
               │ stdout (solution)
               │
        ┌──────▼──────────────────┐
        │ Return to Frontend      │
        │ Display in <pre>        │
        └─────────────────────────┘

❌ PROBLÈMES CRITIQUES :
   • Pas de BD (données perdues)
   • Pas d'utilisateur (pas d'authentification)
   • Pas de versioning (impossible revenir en arrière)
   • Pas d'historique (qui a fait quoi ?)
```

---

## DIAGRAMME 2 : ARCHITECTURE AVEC PERSISTANCE + AUTH

```
┌─────────────────────────────────────────────────────────────────┐
│                  UTILISATEUR (Navigateur)                       │
│              Non authentifié → Page Login/Register              │
│                 Authentifié → Dashboard                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │   React 18 Frontend (Port 3000)     │
        │ ┌──────────────────────────────────┐│
        │ │ ROUTING:                         ││
        │ │ / → Home (redirect /auth/login)  ││
        │ │ /auth/login → LoginPage          ││
        │ │ /auth/register → RegisterPage    ││
        │ │ /dashboard → DashboardPage       ││ ◄─ LIST plannings
        │ │ /planning/:id → Planification    ││ ◄─ EDIT planning
        │ │ /planning/new → Planification    ││ ◄─ CREATE planning
        │ └──────────────────────────────────┘│
        │ ┌──────────────────────────────────┐│
        │ │ STATE MANAGEMENT:                ││
        │ │ • AuthContext (user, JWT, login) ││
        │ │ • useAuth() hook                 ││
        │ │ • ProtectedRoute wrapper         ││
        │ └──────────────────────────────────┘│
        │ ┌──────────────────────────────────┐│
        │ │ SERVICES:                        ││
        │ │ • api.ts (Axios + JWT intercept) ││
        │ │ • authService.ts (login/register)││
        │ │ • planningService.ts (CRUD)      ││
        │ └──────────────────────────────────┘│
        └────────┬──────────┬──────────┬───────┘
                 │          │          │
        ┌────────▼──┐ ┌─────▼────┐  ┌─▼────────────┐
        │ POST       │ │ GET/POST │  │ POST         │
        │ /auth/*    │ │ /api/*   │  │ /api/solve   │
        │ (Login)    │ │ (CRUD)   │  │ (Resolve)    │
        └────────┬──┘ └─────┬────┘  └─┬────────────┘
                 │          │         │
        ┌────────┴──────────┴─────────▼──────────────┐
        │    Express Server (Port 4000)              │
        │ ┌────────────────────────────────────────┐ │
        │ │ MIDDLEWARE:                            │ │
        │ │ • cors()                               │ │
        │ │ • express.json()                       │ │
        │ │ • authMiddleware (JWT check)           │ │
        │ │ • errorHandler (global)                │ │
        │ └────────────────────────────────────────┘ │
        │ ┌────────────────────────────────────────┐ │
        │ │ ROUTES:                                │ │
        │ │ POST /auth/register                    │ │
        │ │   → authService.register()             │ │
        │ │   → hash password (bcryptjs)           │ │
        │ │   → create user in DB                  │ │
        │ │   → return JWT                         │ │
        │ │                                        │ │
        │ │ POST /auth/login                       │ │
        │ │   → authService.login()                │ │
        │ │   → verify password                    │ │
        │ │   → return JWT                         │ │
        │ │                                        │ │
        │ │ GET /api/plannings (requires JWT)      │ │
        │ │   → planningService.listByUser()       │ │
        │ │   → query DB where user_id=...         │ │
        │ │                                        │ │
        │ │ POST /api/plannings (requires JWT)     │ │
        │ │   → planningService.create()           │ │
        │ │   → validate with Langium              │ │
        │ │   → save to planning_versions          │ │
        │ │   → return planning_id                 │ │
        │ │                                        │ │
        │ │ PUT /api/plannings/:id (requires JWT)  │ │
        │ │   → planningService.update()           │ │
        │ │   → check authorization                │ │
        │ │   → update & create version            │ │
        │ │                                        │ │
        │ │ POST /api/plannings/:id/solve          │ │
        │ │   → planningService.solve()            │ │
        │ │   → generate MiniZinc                  │ │
        │ │   → execute solver                     │ │
        │ │   → save to planning_solutions         │ │
        │ │                                        │ │
        │ │ DELETE /api/plannings/:id              │ │
        │ │   → soft delete (deleted_at)           │ │
        │ └────────────────────────────────────────┘ │
        │ ┌────────────────────────────────────────┐ │
        │ │ SERVICES (Business Logic):             │ │
        │ │ • authService                          │ │
        │ │ • planningService                      │ │
        │ │ • (future: solutionService)            │ │
        │ └────────────────────────────────────────┘ │
        └────────┬──────────────────────────────────┘
                 │ SQL Queries
                 │
        ┌────────▼──────────────────────────────┐
        │    PostgreSQL Database (Port 5432)    │
        │ ┌──────────────────────────────────┐  │
        │ │ TABLES:                          │  │
        │ │ • users                          │  │ ◄─ id, email, username, password_hash, ...
        │ │ • plannings                      │  │ ◄─ id, user_id, title, data (JSONB)
        │ │ • planning_versions              │  │ ◄─ id, planning_id, data, created_by
        │ │ • planning_solutions             │  │ ◄─ id, planning_id, minizinc_input/output
        │ │ • planning_shares (optionnel)    │  │ ◄─ Partage entre utilisateurs
        │ │ • audit_logs (optionnel)         │  │ ◄─ Traçabilité
        │ └──────────────────────────────────┘  │
        │ ┌──────────────────────────────────┐  │
        │ │ INDEXES:                         │  │
        │ │ • idx_plannings_user_id          │  │
        │ │ • idx_plannings_status           │  │
        │ │ • idx_planning_versions_id       │  │
        │ └──────────────────────────────────┘  │
        └────────────────────────────────────────┘

✅ AMÉLIORATIONS :
   • Authentification (JWT)
   • Persistance (PostgreSQL)
   • Autorisation (user_id check)
   • Versioning (planning_versions)
   • Historique solutions (planning_solutions)
   • Audit trail (planning_versions.created_by)
   • Partage sécurisé (optionnel)
```

---

## DIAGRAMME 3 : FLUX AUTHENTIFICATION

```
┌──────────────────────────────────────────────────────────────────┐
│                        REGISTRATION FLOW                         │
└──────────────────────────────────────────────────────────────────┘

User (Frontend)                    Backend
   │                                 │
   ├─ Click "Register" ────────────►│
   │                                 │
   │                          ┌──────▼──────┐
   │                          │ POST         │
   │                          │ /auth/       │
   │                          │ register     │
   │                          └──────┬───────┘
   │                                 │
   │                          ┌──────▼──────────────────┐
   │                          │ 1. Validate email       │
   │                          │    (not exists in DB)   │
   │                          │ 2. Hash password        │
   │                          │    (bcryptjs)           │
   │                          │ 3. Create user in DB    │
   │                          │ 4. Generate JWT         │
   │                          │    (jsonwebtoken)       │
   │                          │ 5. Return { user, JWT } │
   │                          └──────┬──────────────────┘
   │                                 │
   │ ◄────── { email, JWT } ────────┤
   │                                 │
   ├─ Store JWT in localStorage ────┤
   │                                 │
   └─ Redirect to /dashboard ───────►│


┌──────────────────────────────────────────────────────────────────┐
│                         LOGIN FLOW                               │
└──────────────────────────────────────────────────────────────────┘

User (Frontend)                    Backend
   │                                 │
   ├─ Click "Login" ───────────────►│
   │                                 │
   │                          ┌──────▼──────┐
   │                          │ POST         │
   │                          │ /auth/       │
   │                          │ login        │
   │                          └──────┬───────┘
   │                                 │
   │                          ┌──────▼──────────────────┐
   │                          │ 1. Find user by email   │
   │                          │ 2. Verify password      │
   │                          │    (bcryptjs.compare)   │
   │                          │ 3. Generate JWT         │
   │                          │ 4. Return { user, JWT } │
   │                          └──────┬──────────────────┘
   │                                 │
   │ ◄────── { email, JWT } ────────┤
   │                                 │
   ├─ Store JWT in localStorage ────┤
   │                                 │
   └─ Redirect to /dashboard ───────►│


┌──────────────────────────────────────────────────────────────────┐
│                   PROTECTED ENDPOINT FLOW                        │
└──────────────────────────────────────────────────────────────────┘

User (Frontend)                    Backend
   │                                 │
   ├─ GET /api/plannings ──────────►│
   │   + Authorization: Bearer JWT   │
   │                                 │
   │                          ┌──────▼──────────────────┐
   │                          │ authMiddleware:         │
   │                          │ 1. Extract JWT from     │
   │                          │    Authorization header │
   │                          │ 2. Verify JWT signature │
   │                          │    (jwt.verify)         │
   │                          │ 3. Extract user_id      │
   │                          │ 4. Attach to req.user   │
   │                          └──────┬──────────────────┘
   │                                 │
   │                          ┌──────▼──────────────────┐
   │                          │ GET /api/plannings      │
   │                          │ Handler:                │
   │                          │ 1. Query DB:            │
   │                          │    SELECT * FROM        │
   │                          │    plannings WHERE      │
   │                          │    user_id = req.user.id│
   │                          │ 2. Return list          │
   │                          └──────┬──────────────────┘
   │                                 │
   │ ◄───────────── Plannings ──────┤
   │                                 │

❌ INVALID JWT:
   ├─ GET /api/plannings ──────────►│
   │   + Authorization: Bearer <invalid> │
   │                                 │
   │                          ┌──────▼──────────────────┐
   │                          │ authMiddleware:         │
   │                          │ 1. jwt.verify fails     │
   │                          │ 2. throw Error          │
   │                          └──────┬──────────────────┘
   │                                 │
   │ ◄──────── 401 Unauthorized ────┤
   │                                 │
```

---

## DIAGRAMME 4 : FLUX PLANIFICATION (CRÉER → MODIFIER → RÉSOUDRE)

```
┌──────────────────────────────────────────────────────────────────┐
│               PLANNING CREATION & RESOLUTION FLOW                │
└──────────────────────────────────────────────────────────────────┘

User (Frontend)              Backend              Database
   │                            │                    │
   ├─ Click "New Planning" ────►│                    │
   │                            │                    │
   │ ┌─ Load Planification.tsx──┤                    │
   │ │  (Step wizard)           │                    │
   │ │                          │                    │
   │ └─ Fill Step 1: Time ──────┤                    │
   │    (days, slotsPerDay)     │                    │
   │                            │                    │
   ├─ Click "Save Draft" ──────►│                    │
   │ (Auto-save per step)       │                    │
   │                            │ POST /api/plannings│
   │                            │ {                  │
   │                            │   title: "...",    │
   │                            │   data: {...}      │
   │                            │ }                  │
   │                            │                    │
   │                            ├─ planningService  │
   │                            │  .create()         │
   │                            │                    │
   │                            ├─ Validate with    │
   │                            │  Langium           │
   │                            │                    │
   │                            ├─ INSERT into      │
   │                            │  plannings table   │
   │                            ├──────────────────►│
   │                            │ planning_id=123   │
   │                            │◄──────────────────┤
   │                            │                    │
   │                            ├─ INSERT into      │
   │                            │  planning_versions│
   │                            │  (snapshot)       │
   │                            ├──────────────────►│
   │ ◄─── 201 + planning_id ────┤                    │
   │                            │                    │
   ├─ Fill Steps 2-6: Activities, │                 │
   │  Resources, Roles,         │                    │
   │  Constraints, Preferences  │                    │
   │  (Optional auto-save)      │                    │
   │                            │                    │
   ├─ Review in Step 7: Summary ┤                    │
   │                            │                    │
   ├─ Click "Solve/Resolve" ───►│                    │
   │                            │ POST               │
   │                            │ /api/plannings/123/│
   │                            │ solve              │
   │                            │ {data: {...}}      │
   │                            │                    │
   │                            ├─ planningService  │
   │                            │  .solve()          │
   │                            │                    │
   │                            ├─ Validate with    │
   │                            │  Langium           │
   │                            │  (parser errors,   │
   │                            │   diagnostics)     │
   │                            │                    │
   │                            ├─ Generate         │
   │                            │  MiniZinc code     │
   │                            │                    │
   │                            ├─ Execute:         │
   │                            │  minizinc          │
   │                            │  --solver Highs    │
   │                            │                    │
   │                            ├─ INSERT into      │
   │                            │  planning_solutions│
   │                            │  (input, output)   │
   │                            ├──────────────────►│
   │                            │                    │
   │                            ├─ UPDATE planning: │
   │                            │  status='solved'   │
   │                            ├──────────────────►│
   │                            │                    │
   │ ◄─ 200 + solution stdout ──┤                    │
   │                            │                    │
   ├─ Display solution in       │                    │
   │  <SolutionViewer> or       │                    │
   │  <pre>                     │                    │
   │                            │                    │

┌──────────────────────────────────────────────────────────────────┐
│               PLANNING MODIFICATION FLOW                         │
└──────────────────────────────────────────────────────────────────┘

User (Frontend)              Backend              Database
   │                            │                    │
   ├─ Click "Edit" on planning──┤                    │
   │                            │ GET /api/          │
   │                            │ plannings/123      │
   │                            │                    │
   │                            ├─ Query DB          │
   │                            │  SELECT * FROM     │
   │                            │  plannings WHERE   │
   │                            │  id=123 AND        │
   │                            │  user_id=...       │
   │                            ├──────────────────►│
   │                            │ planning data      │
   │                            │◄──────────────────┤
   │ ◄─── 200 + data ───────────┤                    │
   │                            │                    │
   ├─ Load Planification.tsx    │                    │
   │  with data pre-filled      │                    │
   │                            │                    │
   ├─ Modify Step 2: Activities │                    │
   │  (add/remove activities)   │                    │
   │                            │                    │
   ├─ Click "Save" ────────────►│                    │
   │                            │ PUT /api/          │
   │                            │ plannings/123      │
   │                            │ {data: {...}}      │
   │                            │                    │
   │                            ├─ planningService  │
   │                            │  .update()         │
   │                            │                    │
   │                            ├─ Check auth:      │
   │                            │  req.user.id ==    │
   │                            │  planning.user_id? │
   │                            │                    │
   │                            ├─ Validate with    │
   │                            │  Langium           │
   │                            │                    │
   │                            ├─ UPDATE planning  │
   │                            ├──────────────────►│
   │                            │                    │
   │                            ├─ INSERT into      │
   │                            │  planning_versions │
   │                            │  (new snapshot)    │
   │                            ├──────────────────►│
   │                            │                    │
   │ ◄──── 200 OK ──────────────┤                    │
   │                            │                    │
   ├─ Show notification         │                    │
   │  "Planning updated"        │                    │
   │                            │                    │

┌──────────────────────────────────────────────────────────────────┐
│                   AUTHORIZATION CHECK                            │
└──────────────────────────────────────────────────────────────────┘

❌ User B tries to edit User A's planning:

User B (Frontend)            Backend              Database
   │                            │                    │
   ├─ Try edit /planning/123────►│ PUT /api/          │
   │  (owned by User A)          │ plannings/123      │
   │                            │                    │
   │                            ├─ authMiddleware:   │
   │                            │  req.user.id = B   │
   │                            │                    │
   │                            ├─ planningService  │
   │                            │  .update()         │
   │                            │                    │
   │                            ├─ Query planning    │
   │                            ├──────────────────►│
   │                            │ planning.user_id=A │
   │                            │◄──────────────────┤
   │                            │                    │
   │                            ├─ Check:           │
   │                            │  B != A?           │
   │                            │  → Authorization   │
   │                            │    error           │
   │ ◄──── 403 Forbidden ───────┤                    │
   │ "Not authorized"           │                    │
   │                            │                    │
```

---

## TABLEAU DE BORD : ÉTAPES ET FICHIERS

### Phase 1 : Infrastructure

| Étape | Titre | Fichiers créés | Fichiers modifiés | Durée |
|-------|-------|---|---|---|
| 1.1 | PostgreSQL + schema | `schema.sql`, `connection.ts` | `docker-compose.yml` | 1 jour |
| 1.2 | Models + CRUD | `User.ts`, `Planning.ts` | `package.json` | 1 jour |

### Phase 2 : Authentification

| Étape | Titre | Fichiers créés | Fichiers modifiés | Durée |
|-------|-------|---|---|---|
| 2.1 | Auth services | `authService.ts` | `package.json`, `.env.example` | 1 jour |
| 2.2 | Auth endpoints | `auth.ts` (routes) | `server.ts` | 1 jour |
| 2.3 | JWT middleware | `auth.ts` (middleware) | `server.ts` | 0.5 jour |
| 2.4 | Frontend auth | `LoginPage.tsx`, `RegisterPage.tsx`, `AuthContext.tsx`, `api.ts`, `ProtectedRoute.tsx` | `App.tsx`, `index.tsx`, `package.json` | 1.5 jours |

### Phase 3 : Persistance

| Étape | Titre | Fichiers créés | Fichiers modifiés | Durée |
|-------|-------|---|---|---|
| 3.1 | CRUD planning | `plannings.ts` (routes) | `server.ts` | 1 jour |
| 3.2 | Planning services | `planningService.ts` | `plannings.ts` | 1 jour |
| 3.3 | Solutions endpoint | `solutions.ts` | `server.ts` | 1 jour |
| 3.4 | Frontend CRUD | `DashboardPage.tsx`, `planningService.ts` | `Planification.tsx`, `PlanningWizard.tsx`, `App.tsx` | 1.5 jours |

### Phase 4 : Polissage

| Étape | Titre | Fichiers créés | Fichiers modifiés | Durée |
|-------|-------|---|---|---|
| 4.1 | Testing + validation | Tests unitaires + e2e | Tous | 1.5 jours |
| 4.2 | Historique/versions | `VersionsPage.tsx` | `App.tsx` | 1 jour |
| 4.3 | Partage (optionnel) | `shares.ts`, `ShareDialog.tsx` | `App.tsx` | 0.5 jour |
| 4.4 | Audit (optionnel) | `auditLog.ts`, `AdminDashboard.tsx` | — | 0.5 jour |

### Phase 5 : Déploiement

| Étape | Titre | Fichiers créés | Fichiers modifiés | Durée |
|-------|-------|---|---|---|
| 5.1 | Docker | `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.prod.yml` | — | 1 jour |
| 5.2 | CI/CD (optionnel) | `.github/workflows/*` | — | 1 jour |

---

## CHECKLIST PRÉ-IMPLÉMENTATION

### Environnement

- [ ] Node.js 20.10+ installé (`node --version`)
- [ ] pnpm 10+ installé (`pnpm --version`)
- [ ] PostgreSQL 14+ installé localement ou prêt en Docker
- [ ] Git branch créée pour ces changements (`git checkout -b feature/auth-persistence`)
- [ ] Tests actuels passent (`pnpm test`)
- [ ] Application lancée et fonctionne (http://localhost:3000, http://localhost:4000)

### Dépendances NPM à valider

**Backend** (`backend/packages/server/package.json`) :
- [ ] express^5.2.1 ✅ (déjà présent)
- [ ] langium~4.2.0 ✅ (déjà présent)
- [ ] cors^2.8.5 ✅ (déjà présent)
- [ ] **À ajouter** : pg^8.11.0
- [ ] **À ajouter** : jsonwebtoken^9.1.0
- [ ] **À ajouter** : bcryptjs^2.4.3
- [ ] **À ajouter** : dotenv^16.4.1

**Frontend** (`frontend/package.json`) :
- [ ] react^18.3.1 ✅ (déjà présent)
- [ ] axios^1.13.5 ✅ (déjà présent)
- [ ] react-router-dom^7.8.2 ✅ (déjà présent)
- [ ] **Optionnel** : zustand (state management)
- [ ] **Optionnel** : react-query (server state)

### Documentation préalable

- [ ] Lire ce rapport technique entièrement
- [ ] Comprendre le flux actuel (sans BD)
- [ ] Valider l'architecture proposée avec équipe
- [ ] Accepter les risques identifiés (section 9)
- [ ] Choisir chemin critique (section 10)

### Déploiement test

- [ ] Tester PostgreSQL en local : `psql --version`
- [ ] Créer user + password test PostgreSQL
- [ ] Créer database test : `createdb planning_spec_dev`
- [ ] Valider connexion : `psql -U user -d planning_spec_dev -c "\dt"`

---

## QUICK REFERENCE : COMMANDES CLÉS

### Installation initiale

```bash
# À la racine
corepack enable
corepack use pnpm@10.31.0
pnpm install

# Backend seul
cd backend/packages/server
pnpm install
```

### Développement

```bash
# Backend + Frontend simultanément
pnpm dev

# Backend seul
pnpm dev:backend

# Frontend seul
pnpm dev:frontend
```

### Tests actuels

```bash
# Tests Langium
pnpm test

# Vérifier builds
pnpm build
pnpm build:backend
pnpm build:frontend
```

### Tests API (Postman/curl)

```bash
# Health check
curl http://localhost:4000/api/health

# POST solve (avant authentification)
curl -X POST http://localhost:4000/api/solve \
  -H "Content-Type: application/json" \
  -d @test_planning.json
```

### Git

```bash
# Créer branche feature
git checkout -b feature/auth-persistence

# Committer progressivement
git add .
git commit -m "Phase 1.1: PostgreSQL schema"

# Push branch
git push origin feature/auth-persistence

# Créer PR
# (via GitHub web)
```

### Docker (optionnel)

```bash
# Lancer PostgreSQL en Docker
docker run --name postgres-planning \
  -e POSTGRES_USER=planning_user \
  -e POSTGRES_PASSWORD=planning_pass \
  -e POSTGRES_DB=planning_spec_dev \
  -p 5432:5432 \
  -d postgres:15

# Vérifier
docker ps
```

---

## RESSOURCES EXTERNES

### Authentification JWT

- [jsonwebtoken docs](https://www.npmjs.com/package/jsonwebtoken)
- [bcryptjs docs](https://www.npmjs.com/package/bcryptjs)
- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Persistance

- [PostgreSQL 14 docs](https://www.postgresql.org/docs/14/index.html)
- [Node.js pg driver](https://www.npmjs.com/package/pg)
- [Prisma ORM](https://www.prisma.io/) (alternative)

### Frontend

- [React Router v7](https://reactrouter.com/)
- [Axios interceptors](https://axios-http.com/docs/interceptors)
- [Context API](https://react.dev/reference/react/useContext)

### Architecture

- [REST API best practices](https://restfulapi.net/)
- [JWT best practices](https://tools.ietf.org/html/rfc8949)
- [Database design](https://en.wikipedia.org/wiki/Database_design)

---

## NOTES IMPORTANTES

### ⚠️ SÉCURITÉ

1. **Ne jamais committer** .env files avec secrets réels
2. **JWT en localStorage** : vulnérable à XSS. Utiliser **HttpOnly cookies** en production
3. **Passwords** : toujours hasher avec bcryptjs ou argon2
4. **CORS** : restreindre à domaines connus en production
5. **Rate limiting** : ajouter en prod (ex: express-rate-limit)

### ⚠️ PERFORMANCE

1. **Indexes BD** : créés sur user_id, status, created_at
2. **Pagination** : ajouter pour listes planifications (limit/offset)
3. **Caching** : Redis optionnel pour sessions JWT
4. **Timeout solver** : 30s max pour MiniZinc (peut être long)

### ⚠️ COMPATIBILITÉ

1. **Langium 4.2** : pas de breaking changes attendus
2. **React 18** : compatible avec Router v7
3. **PostgreSQL 14+** : JSONB, transactions ACID supportées
4. **Node 20.10+** : toutes dépendances modernes supportées

### ⚠️ TESTING

1. Créer utilisateurs test avant validations
2. Tester authorization à chaque étape
3. Tests e2e : login → create → solve → view history
4. Load testing : combien de requêtes /solve simultanées ?

---

## PROCHAINES ÉTAPES

1. **Valider ce rapport** avec stakeholders
2. **Ajuster timeline** si besoin
3. **Démarrer Phase 1.1** : PostgreSQL
4. **Créer issue/tasks** GitHub avec checklist
5. **Commencer implémentation** selon ordre

**Document d'analyse complété le 19 mars 2026**  
**Prêt pour implémentation dès approbation**

