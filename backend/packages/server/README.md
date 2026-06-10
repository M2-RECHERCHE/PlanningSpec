# planning-spec-server

Serveur Express dédié au backend HTTP.

## Fonctionnement

1. réception du modèle JSON/DSL via `POST /api/solve` ou lancement persistant via `POST /api/plannings/:id/execute`,
2. création d'un document Langium en mémoire,
3. validation du document,
4. génération du fichier MiniZinc,
5. exécution de MiniZinc en streaming (`spawn`) ou délégation à OptaPlanner (si solveur `OptaPlanner` choisi).

Pour MiniZinc, aucune limite de temps n'est appliquée par défaut. Vous pouvez fournir
`solverTimeLimitSeconds` dans le body pour passer explicitement `--time-limit`.

Routes MiniZinc asynchrones principales:

- `POST /api/plannings/:id/execute` démarre une exécution et retourne immédiatement `executionId`.
- `GET /api/plannings/:id/executions/:executionId/events` diffuse les logs et solutions en SSE.
- `GET /api/plannings/:id/executions/:executionId/logs` relit les logs persistés.
- `POST /api/plannings/:id/executions/:executionId/stop` demande l'arrêt manuel.
- `GET /api/plannings/:id/solutions` liste les solutions sauvegardées.

## Variables d'environnement

- `PORT` : port HTTP, défaut `4000`
- `ALLOWED_ORIGINS` : origines CORS séparées par des virgules
- `MINIZINC_SOLVER` : solveur MiniZinc, défaut `Highs`
- MiniZinc n'a pas de timeout automatique par défaut. `--time-limit` est transmis uniquement si une limite est demandée explicitement dans le body.
- `OPTAPLANNER_URL` : URL du backend Spring Boot OptaPlanner, défaut `http://localhost:8084`
- `OPTAPLANNER_TIMEOUT_MS` : timeout OptaPlanner en millisecondes, défaut `72000000` (20h)
- `MYSQL_HOST` : hôte MySQL, défaut `127.0.0.1`
- `MYSQL_PORT` : port MySQL, défaut `3306`
- `MYSQL_USER` : utilisateur MySQL, défaut `root`
- `MYSQL_PASSWORD` : mot de passe MySQL, défaut vide
- `MYSQL_DATABASE` : base applicative, défaut `planning_spec`
- `MYSQL_CONNECTION_LIMIT` : nombre maximum de connexions du pool, défaut `10`

Les valeurs sont chargées depuis `backend/packages/server/.env` au démarrage, puis peuvent être surchargées par les variables d'environnement du processus.

Au lancement du serveur, `initializeDatabase()` exécute `CREATE DATABASE IF NOT EXISTS MYSQL_DATABASE`, puis crée ou migre les tables nécessaires avant d'ouvrir le port HTTP. L'utilisateur MySQL configuré doit donc avoir le droit `CREATE` sur le serveur, ou la base doit être créée manuellement au préalable.
