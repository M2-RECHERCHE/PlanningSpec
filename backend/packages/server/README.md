# planning-spec-server

Serveur Express dédié au backend HTTP.

## Fonctionnement

1. réception du modèle JSON/DSL via `POST /api/solve`,
2. création d'un document Langium en mémoire,
3. validation du document,
4. génération du fichier MiniZinc,
5. exécution de MiniZinc puis retour du résultat.

## Variables d'environnement

- `PORT` : port HTTP, défaut `4000`
- `ALLOWED_ORIGINS` : origines CORS séparées par des virgules
- `MINIZINC_SOLVER` : solveur MiniZinc, défaut `Highs`
- `MINIZINC_TIMEOUT_MS` : timeout solveur en millisecondes, défaut `10800000` (3h)
