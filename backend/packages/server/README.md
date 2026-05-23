# planning-spec-server

Serveur Express dédié au backend HTTP.

## Fonctionnement

1. réception du modèle JSON/DSL via `POST /api/solve`,
2. création d'un document Langium en mémoire,
3. validation du document,
4. génération du fichier MiniZinc,
5. exécution de MiniZinc ou délégation à OptaPlanner (si solveur `OptaPlanner` choisi), puis retour du résultat.

Lors d'un appel `POST /api/plannings/:id/solve` ou `POST /api/solve`, vous pouvez fournir
`solverTimeLimitSeconds` dans le body pour fixer le timeout demandé au solveur (notamment OptaPlanner).

## Variables d'environnement

- `PORT` : port HTTP, défaut `4000`
- `ALLOWED_ORIGINS` : origines CORS séparées par des virgules
- `MINIZINC_SOLVER` : solveur MiniZinc, défaut `Highs`
- `MINIZINC_TIMEOUT_MS` : timeout solveur en millisecondes, défaut `72000000` (20h)
- `OPTAPLANNER_URL` : URL du backend Spring Boot OptaPlanner, défaut `http://localhost:8084`
- `OPTAPLANNER_TIMEOUT_MS` : timeout OptaPlanner en millisecondes, défaut `72000000` (20h)
