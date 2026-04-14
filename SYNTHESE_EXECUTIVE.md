# SYNTHÈSE EXÉCUTIVE ET TABLEAU RÉCAPITULATIF
## Planning Spec — Analyse d'architecture complète

---

## RÉSUMÉ EXÉCUTIF

### État actuel (✅ = existant, ❌ = absent)

| Aspect | Statut | Détails |
|--------|--------|---------|
| **DSL Langium** | ✅ Mature | Grammar planning-spec.langium, 119 lignes, validations intégrées |
| **Générateur MiniZinc** | ✅ Complet | 441 lignes, génère contraintes complètes, trésorier exécutables |
| **API Express** | ✅ Basique | 3 endpoints (health, solve, root), CORS configurable |
| **Interface React** | ✅ Complète | 6 étapes wizard, Material-UI, responsive |
| **Persistance BD** | ❌ **MANQUANTE** | Données perdues après chaque session |
| **Authentification** | ❌ **MANQUANTE** | Aucun utilisateur, API ouverte à tous |
| **Autorisation** | ❌ **MANQUANTE** | Pas de contrôle d'accès |
| **Versioning** | ❌ **MANQUANTE** | Pas d'historique de planifications |
| **Audit trail** | ❌ **MANQUANTE** | Impossible de tracker qui a fait quoi |

### Impact pour utilisateurs finaux

**Actuellement** :
- ✅ Peuvent créer des planifications complexes
- ✅ Peuvent résoudre instantanément avec MiniZinc
- ❌ Doivent partager écran ou exporter JSON manuellement
- ❌ Perdent leur travail en fermant le navigateur
- ❌ N'ont aucune trace d'audit
- ❌ Tout le monde partage la même session (pas de multi-utilisateurs)

**Après implémentation proposée** :
- ✅ Authentification sécurisée
- ✅ Persistance complète
- ✅ Historique et versioning
- ✅ Partage sécurisé entre utilisateurs
- ✅ Audit trail complet
- ✅ Gestion de permissions

---

## TABLEAU COMPARATIF : AVANT vs APRÈS

```
┌──────────────────────┬─────────────────┬──────────────────────┐
│      Aspect          │      AVANT      │       APRÈS          │
├──────────────────────┼─────────────────┼──────────────────────┤
│ Données              │ Volatiles (RAM) │ Persistentes (PG)    │
│ Authentification     │ Aucune          │ JWT + Password Hash  │
│ Utilisateurs         │ 0               │ Illimités            │
│ Planifications       │ Perdue après F5 │ Sauvegardées avec    │
│                      │                 │ timestamp + version  │
│ Historique          │ Aucun           │ planning_versions    │
│ Solutions (solver)  │ Affichage temp. │ Enregistrées en BD   │
│ Partage             │ N/A             │ Permissions granules │
│ Audit               │ Aucun           │ audit_logs complets  │
│ API Security        │ CORS basique    │ JWT + authorization  │
│ Scalabilité         │ 1 utilisateur   │ Multi-utilisateurs   │
└──────────────────────┴─────────────────┴──────────────────────┘
```

---

## ARBORESCENCE FINALE (APRÈS IMPLÉMENTATION)

```
IMPLEMENTATION_MONO_REPO_V1/
├── RAPPORT_TECHNIQUE_ANALYSE.md (📋 CE DOCUMENT)
├── DOCUMENTATION_COMPLEMENTAIRE.md (📊 DIAGRAMMES)
├── package.json (root)
├── pnpm-workspace.yaml
├── docker-compose.yml (NOUVEAU)
├── .dockerignore (NOUVEAU)
│
├── backend/
│   ├── package.json
│   └── packages/
│       ├── language/ (inchangé)
│       │   └── src/
│       │       ├── planning-spec.langium
│       │       ├── planning-spec-minizinc-generator.ts
│       │       ├── planning-spec-validator.ts
│       │       ├── planning-spec-module.ts
│       │       └── index.ts
│       │
│       └── server/ (MAJORITÉ DES CHANGEMENTS)
│           ├── package.json (dépendances +pg, jwt, bcryptjs)
│           ├── .env.example (NOUVEAU)
│           ├── src/
│           │   ├── server.ts (modifié: middleware + routes)
│           │   │
│           │   ├── database/ (NOUVEAU)
│           │   │   ├── connection.ts
│           │   │   └── schema.sql
│           │   │
│           │   ├── models/ (NOUVEAU)
│           │   │   ├── User.ts
│           │   │   ├── Planning.ts
│           │   │   └── Solution.ts
│           │   │
│           │   ├── routes/ (NOUVEAU)
│           │   │   ├── auth.ts
│           │   │   ├── plannings.ts
│           │   │   └── solutions.ts
│           │   │
│           │   ├── middleware/ (NOUVEAU)
│           │   │   ├── auth.ts
│           │   │   └── errorHandler.ts
│           │   │
│           │   └── services/ (NOUVEAU)
│           │       ├── authService.ts
│           │       ├── planningService.ts
│           │       └── solutionService.ts
│           │
│           └── dist/ (compilé)
│
├── frontend/
│   ├── package.json
│   ├── .env.local (NOUVEAU: REACT_APP_API_BASE_URL)
│   ├── public/
│   └── src/
│       ├── index.tsx (modifié: <AuthProvider>)
│       ├── App.tsx (modifié: auth routes)
│       │
│       ├── services/ (NOUVEAU)
│       │   ├── api.ts
│       │   ├── authService.ts
│       │   └── planningService.ts
│       │
│       ├── context/ (NOUVEAU)
│       │   └── AuthContext.tsx
│       │
│       ├── hooks/ (NOUVEAU)
│       │   ├── useAuth.ts
│       │   └── useLocalStorage.ts
│       │
│       ├── components/
│       │   ├── PlanningWizard.tsx (modifié: save button)
│       │   ├── ProtectedRoute.tsx (NOUVEAU)
│       │   ├── ErrorBoundary.tsx (NOUVEAU)
│       │   └── steps/ (inchangé)
│       │
│       ├── views/
│       │   ├── Home.tsx (modifié: login prompt si pas connecté)
│       │   └── pages/
│       │       └── Planification.tsx (modifié: load/save)
│       │
│       ├── pages/ (NOUVEAU)
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   └── DashboardPage.tsx
│       │
│       └── model/
│           └── Planning.ts (inchangé)
│
└── Dockerfile.backend (NOUVEAU)
└── Dockerfile.frontend (NOUVEAU)
```

---

## MATRICE DE RESPONSABILITÉ (RACI)

| Tâche | Backend | Frontend | DevOps | QA |
|-------|---------|----------|--------|----
| PostgreSQL setup | R | — | A | V |
| Models + CRUD | R | — | — | V |
| Auth service | R | — | — | V |
| JWT validation | R | C | — | V |
| Auth endpoints | R | — | — | V |
| Auth middleware | R | — | — | V |
| Auth context | — | R | — | V |
| Login form | — | R | — | V |
| Planning CRUD | R | — | — | V |
| Frontend CRUD | — | R | — | V |
| Error handling | R | R | — | V |
| Docker setup | C | C | R | V |
| CI/CD pipeline | — | — | R | V |
| Load testing | — | — | R | A |

**Légende** : R=Responsible (faire), A=Accountable (décider), C=Consulted (avis), I=Informed (info), V=Verified (valider)

---

## LISTE COMPLÈTE DES FICHIERS À CRÉER/MODIFIER

### 🟢 À CRÉER (46 fichiers)

#### Backend (15 fichiers)

```
backend/packages/server/src/database/
  ├── connection.ts ..................... PostgreSQL pool + helpers
  └── schema.sql ........................ DDL tables + indexes

backend/packages/server/src/models/
  ├── User.ts ........................... Types + queries utilisateur
  ├── Planning.ts ....................... Types + queries planning
  └── Solution.ts ....................... Types + queries solution

backend/packages/server/src/routes/
  ├── auth.ts ........................... POST register, login, logout, GET me
  ├── plannings.ts ...................... CRUD GET/POST/PUT/DELETE /api/plannings
  └── solutions.ts ...................... POST /api/plannings/:id/solve

backend/packages/server/src/middleware/
  ├── auth.ts ........................... Vérification JWT
  └── errorHandler.ts .................. Gestion erreurs globales

backend/packages/server/src/services/
  ├── authService.ts .................... Hash, verify, JWT generation
  ├── planningService.ts ................ Logique métier planning
  └── solutionService.ts ................ Logique exécution solver

backend/packages/server/
  ├── .env.example ...................... Template variables d'env
```

#### Frontend (24 fichiers)

```
frontend/src/services/
  ├── api.ts ............................ Axios instance + interceptors
  ├── authService.ts .................... Appels auth endpoints
  └── planningService.ts ................ Appels CRUD plannings

frontend/src/context/
  └── AuthContext.tsx ................... Context + Provider

frontend/src/hooks/
  ├── useAuth.ts ........................ Custom hook
  └── useLocalStorage.ts ................ Persistence token

frontend/src/pages/
  ├── LoginPage.tsx ..................... Form login
  ├── RegisterPage.tsx .................. Form register
  └── DashboardPage.tsx ................. Liste planifications

frontend/src/components/
  ├── ProtectedRoute.tsx ................ Route guard
  ├── ErrorBoundary.tsx ................. Error fallback
  └── SolutionViewer.tsx ................ Affichage solutions (optionnel)

frontend/
  ├── .env.local ........................ Variables env frontend
```

#### Docker & Config (7 fichiers)

```
Dockerfile.backend
Dockerfile.frontend
docker-compose.yml
docker-compose.prod.yml (optionnel)
.dockerignore
.github/workflows/ci.yml (optionnel)
.github/workflows/deploy.yml (optionnel)
```

---

### 🟡 À MODIFIER (13 fichiers)

#### Backend (3 fichiers)

```
backend/packages/server/src/server.ts
  • Ajouter middlewares (authMiddleware, errorHandler)
  • Ajouter routes (auth, plannings, solutions)
  • Supprimer /api/solve direct (remplacer par /api/plannings/:id/solve)

backend/packages/server/package.json
  • Ajouter dépendances : pg, jsonwebtoken, bcryptjs, dotenv

backend/packages/server/tsconfig.json (optionnel)
  • Ajouter paths pour imports (ex: @/models)
```

#### Frontend (10 fichiers)

```
frontend/src/index.tsx
  • Wrapper avec <AuthProvider>

frontend/src/App.tsx
  • Ajouter routes : /auth/login, /auth/register, /dashboard, /planning/:id
  • Ajouter ProtectedRoute wrapper
  • Redirection /  → /dashboard (si logged) ou /auth/login

frontend/src/views/Home.tsx
  • Afficher "Login first" ou bouton "Create planning" selon auth state

frontend/src/views/pages/Planification.tsx
  • Charger planning si URL /planning/:id (edit mode)
  • Ajouter bouton "Save Draft"
  • Ajouter bouton "Resolve" distinct de "Save"

frontend/src/components/PlanningWizard.tsx
  • Scinder handleSolve en 2 : handleSave + handleSolve
  • Ajouter état "saving" / "solving"
  • Afficher planning_id après création

frontend/package.json
  • Optionnel : ajouter zustand ou react-query

frontend/.env.example (optionnel)
  • Template REACT_APP_API_BASE_URL
```

---

## DÉPENDANCES NPM DÉTAILLÉES

### À ajouter au backend

```json
{
  "dependencies": {
    "pg": "^8.11.0",                 // PostgreSQL client
    "jsonwebtoken": "^9.1.0",        // JWT signing/verification
    "bcryptjs": "^2.4.3",            // Password hashing
    "dotenv": "^16.4.1"              // Environment variables
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",          // TypeScript definitions
    "prisma": "^5.8.0"               // Optional: ORM for migrations
  }
}
```

### Optionnel pour frontend

```json
{
  "dependencies": {
    "zustand": "^4.4.0",             // Lightweight state management
    "@tanstack/react-query": "^5.0"  // Server state management
  }
}
```

---

## PLAN DE TESTS

### Tests unitaires (Backend)

```
✓ authService.hash() → vérifie bcryptjs
✓ authService.verify() → compare passwords
✓ authService.generateJWT() → génère token valide
✓ User.create() → insère en BD
✓ Planning.create() → insère + crée version
✓ Planning.update() → modifie + crée version
✓ Planning.delete() → soft delete
✓ authMiddleware() → vérifie JWT valide/invalide
```

### Tests d'intégration (Backend)

```
✓ POST /auth/register → crée user + retourne JWT
✓ POST /auth/login → authenticate + retourne JWT
✓ GET /auth/me (with JWT) → retourne profil
✓ POST /api/plannings (with JWT) → crée planning
✓ GET /api/plannings (with JWT) → liste user's plannings
✓ PUT /api/plannings/:id (with JWT) → modifie planning
✓ DELETE /api/plannings/:id (with JWT) → supprime planning
✓ POST /api/plannings/:id/solve (with JWT) → exécute solver
```

### Tests e2e (Frontend + Backend)

```
Scénario 1: User complet
✓ Charger page accueil
✓ Cliquer "Register"
✓ Remplir formulaire
✓ POST /auth/register → succès
✓ Redirect /dashboard
✓ JWT en localStorage

Scénario 2: Créer et résoudre planning
✓ POST /api/plannings → créé avec ID
✓ Remplir wizard (6 étapes)
✓ POST /api/plannings/:id/solve → résolu
✓ Afficher solution
✓ Historique visible

Scénario 3: Sécurité
✓ User B ne peut pas accéder planning User A
✓ JWT expiré → 401
✓ Pas de JWT → 401
```

---

## METRIQUES DE SUCCÈS

| Métrique | Cible | Mesure |
|----------|-------|--------|
| **Uptime BD** | > 99.5% | Monitoring PostgreSQL |
| **Auth response time** | < 100ms | Benchmark JWT verify |
| **Solve response time** | < 30s | Timeout solver |
| **API availability** | > 99% | Health check endpoint |
| **Data loss** | 0 events | Transactions ACID |
| **Authorization bypass** | 0 occurrences | Tests de sécurité |
| **Test coverage** | > 80% | Code coverage report |
| **Load capacity** | 100 req/s | Load testing |

---

## DÉPENDANCES CRITIQUES (CHEMIN CRITIQUE)

```
PostgreSQL setup (1.1)
        ↓
  Models CRUD (1.2)
        ↓
  Auth service (2.1)
        ↓ (Parallélisable avec 3.1)
  Auth endpoints (2.2)
        ↓
  JWT middleware (2.3)
        ↓
  Planning CRUD backend (3.1)
        ↓
  Frontend auth (2.4)
        ↓
  Planning CRUD frontend (3.4)
        ↓
  Testing + Polish (4.1)
        ↓
  Docker (5.1)

Chemin critique: 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.1 → 2.4 → 3.4 → 4.1 → 5.1
Durée estimée: 21 jours (avec parallélisation où possible)
```

---

## RISQUES PAR PHASE

### Phase 1 (Infrastructure)
- 🔴 Connexion BD instable : mitigation = docker-compose.yml
- 🟡 Migrations mal versionées : mitigation = schema.sql explicite

### Phase 2 (Auth)
- 🔴 Passwords non hashés : mitigation = tests unitaires bcryptjs
- 🔴 JWT secret faible : mitigation = variable env 32+ chars
- 🟡 Rate limiting absent : mitigation = ajouter express-rate-limit

### Phase 3 (Persistance)
- 🔴 Authorization bypass : mitigation = tests authorization sur tous endpoints
- 🟡 N+1 queries : mitigation = EXPLAIN plans en tests
- 🟡 Timeout solver long : mitigation = async queue (Bull/Celery)

### Phase 4 (Polissage)
- 🟢 UX confusion : mitigation = clear labeling + confirmations

### Phase 5 (Déploiement)
- 🟡 Migration production : mitigation = scripts Prisma/Liquibase
- 🟡 Downtime : mitigation = blue-green deployment

---

## COÛTS ESTIMÉS (OPTIONNEL)

| Ressource | Coût | Notes |
|-----------|------|-------|
| **Serveur API (2 vCPU)** | ~$20/mois | AWS EC2, Heroku, DigitalOcean |
| **PostgreSQL (managed)** | ~$15/mois | AWS RDS, Azure, Heroku Postgres |
| **Frontend hosting (CDN)** | ~$5/mois | Vercel, Netlify, AWS S3 |
| **Domain** | ~$12/year | GoDaddy, Namecheap |
| **SSL certificate** | Free | Let's Encrypt |
| **Monitoring** | Free-$10/mth | Sentry, DataDog (free tier ok) |
| **Total** | ~$50-80/mth | MVP acceptable |

---

## PROCHAINES ÉTAPES IMMÉDIATES

### Jour 1 (Validation)
- [ ] Lire ce rapport avec l'équipe
- [ ] Valider architecture proposée
- [ ] Approuver timeline 21 jours
- [ ] Identifier blockers/dépendances externes

### Jour 2 (Setup)
- [ ] Créer branche git `feature/auth-persistence`
- [ ] Créer issues GitHub par phase
- [ ] Setup PostgreSQL (local ou Docker)
- [ ] Valider tous les prérequis (section 4.2)

### Jour 3 (Démarrage Phase 1.1)
- [ ] Créer `schema.sql`
- [ ] Créer `connection.ts`
- [ ] Tester connexion
- [ ] Committer et push

---

## QUESTIONS FRÉQUENTES

**Q: Pourquoi PostgreSQL et pas SQLite ?**  
A: PostgreSQL supporte JSONB, transactions ACID, scalabilité multi-utilisateurs. SQLite = single-writer.

**Q: JWT en localStorage vs cookies ?**  
A: JWT localStorage = simple mais vulnérable XSS. Cookies HttpOnly = meilleur en prod. Implémenter phase 2 initial simple, upgrade cookies + refresh token plus tard.

**Q: Combien de temps pour implémenter ?**  
A: 21 jours pour 1 développeur full-stack. Peut être parallélisé (2 dev: ~14 jours).

**Q: Peut-on déployer sans Phase 4 ?**  
A: Oui, MVP acceptable avec phases 1-3. Phase 4 = polissage (tests, historique, partage).

**Q: Et les migrations BD en production ?**  
A: Utiliser Prisma ou Liquibase. Script migration fourni en phase 1.1.

**Q: Quid du offline support ?**  
A: Hors scope. Implémenter offline via Service Workers + IndexedDB après MVP.

---

## CONTACTS ET ESCALADE

| Rôle | Responsable | Escalade |
|------|-------------|----------|
| **Tech Lead Backend** | ? | CTO |
| **Tech Lead Frontend** | ? | CTO |
| **DevOps** | ? | Infrastructure Manager |
| **QA/Testing** | ? | QA Manager |
| **Product Manager** | ? | Product Director |

---

## DOCUMENT DE SIGNATURE (OPTIONNEL)

```
J'ai lu et compris ce rapport technique.
Je valide l'architecture proposée et le plan d'implémentation.
Je m'engage à respecter les risques identifiés et les mitigations.

Architecture et design approuvés par:
_________________________________  Date: __________

Backend lead approval:
_________________________________  Date: __________

Frontend lead approval:
_________________________________  Date: __________

Product manager approval:
_________________________________  Date: __________
```

---

**RAPPORT FINAL : ANALYSE TECHNIQUE COMPLÈTE**  
**Status** : ✅ Prêt pour implémentation  
**Dernière révision** : 19 mars 2026  
**Durée estimée** : 21 jours (1 dev) ou 14 jours (2 dev en parallèle)

