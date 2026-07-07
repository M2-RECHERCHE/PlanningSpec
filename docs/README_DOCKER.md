# Déploiement Docker Planify

Ce document décrit la configuration Docker pour la plateforme de planification DSL/Langium/MiniZinc/Node/React/MySQL.

## Architecture

Services principaux:

- `frontend`: React servi par nginx non-root en release/production, ou `react-scripts start` en développement.
- `backend`: API Express Node.js. MiniZinc est installé dans ce conteneur, car l'API possède déjà le registre des processus, les logs SSE, l'arrêt manuel et la persistance des solutions.
- `planning-solver`: backend Spring Boot OptaPlanner optionnel, activé avec le profile Docker Compose `optaplanner`.
- `mysql`: base de données persistante. Le service est déclaré dans `deployment/docker-compose.yml`; les fichiers `deployment/docker-compose.dev.yml`, `deployment/docker-compose.release.yml` et `deployment/docker-compose.prod.yml` ne font qu'ajuster son exposition, son redémarrage et ses options.
- `adminer`: outil de debug MySQL uniquement en développement.
- `phpmyadmin`: outil MySQL disponible en développement, et optionnel en release via le profile `db-admin`.
- `vault`: Vault local de développement, et optionnel en release via profile Docker Compose.

MiniZinc est exécuté de manière asynchrone par le backend. Les logs et solutions intermédiaires sont sauvegardés en base MySQL. Une requête HTTP longue n'est pas nécessaire pour garder une optimisation active.

## Fichiers

- `deployment/docker-compose.yml`: base commune.
- `deployment/docker-compose.dev.yml`: développement avec hot reload, ports exposés, Adminer et Vault local.
- `deployment/docker-compose.release.yml`: staging/release proche production.
- `deployment/docker-compose.prod.yml`: production avec ports réduits, redémarrage automatique et limites de ressources.
- `deployment/docker/backend.Dockerfile`: image API + MiniZinc.
- `deployment/docker/frontend.Dockerfile`: image React/nginx.
- `deployment/docker/nginx-frontend.conf`: nginx statique + proxy `/api` vers le backend.
- `src/backend/planning-solver-springboot/Dockerfile`: image du backend OptaPlanner.

## Préparation

Le script `run.sh` crée automatiquement le fichier `.env.<env>` depuis `.env.<env>.example` si le fichier réel n'existe pas encore:

```bash
./run.sh env dev
./run.sh env release
./run.sh env prod
```

Il reste possible de le faire manuellement:

```bash
cp .env.dev.example .env.dev
cp .env.release.example .env.release
cp .env.prod.example .env.prod
```

Remplacer toutes les valeurs `planning_spec` ou `planning_spec-*`. Ne pas commiter `.env`, `.env.dev`, `.env.release` ou `.env.prod`.

## Lancement

Le script racine [run.sh](./run.sh) est le seul point d'entrée de lancement et d'exploitation Docker.

Développement avec build et logs attachés:

```bash
./run.sh dev
```

Release/staging avec build en arrière-plan:

```bash
./run.sh release
```

Par défaut, la release écoute sur la machine de déploiement via `http://localhost:8080`. Si vous y accédez depuis une autre machine avant de configurer le nom de domaine, ajoutez aussi l'origine avec l'IP du serveur dans `ALLOWED_ORIGINS`, par exemple `http://192.168.1.10:8080`.

Production avec build en arrière-plan:

```bash
./run.sh prod
```

Commandes utiles avec le script:

```bash
./run.sh start dev
./run.sh start all dev
./run.sh start all dev --with-optaplanner
./run.sh stop dev
./run.sh restart dev
./run.sh logs backend
./run.sh logs mysql
./run.sh solvers
./run.sh start optaplanner
./run.sh logs optaplanner
./run.sh stop optaplanner

./run.sh dev config
./run.sh dev logs backend
./run.sh prod ps
./run.sh prod minizinc
./run.sh prod solvers
./run.sh dev opta-up
./run.sh dev opta-logs
./run.sh dev opta-stop
./run.sh prod mysql-ping
./run.sh dev phpmyadmin
./run.sh release phpmyadmin
./run.sh prod backup ./backup.sql
./run.sh prod restore ./backup.sql
./run.sh prod down
```

Le script utilise `.env.dev`, `.env.release` ou `.env.prod`. Si le fichier n'existe pas, il le crée depuis `.env.<env>.example`.

Commandes Docker Compose directes équivalentes:

Développement:

```bash
docker compose --env-file .env.dev -f deployment/docker-compose.yml -f deployment/docker-compose.dev.yml up --build
```

Release/staging:

```bash
docker compose --env-file .env.release -f deployment/docker-compose.yml -f deployment/docker-compose.release.yml up --build -d
```

Production:

```bash
docker compose --env-file .env.prod -f deployment/docker-compose.yml -f deployment/docker-compose.prod.yml up --build -d
```

Ports par défaut:

- dev frontend: `http://localhost:3000`
- dev backend: `http://localhost:4000`
- dev Adminer: `http://localhost:8081`
- dev phpMyAdmin: `http://localhost:8082`
- dev Vault: `http://localhost:8200`
- release frontend: `http://localhost:8080`
- production frontend: `http://localhost`

phpMyAdmin en release est désactivé par défaut. Pour l'activer ponctuellement sur la machine de déploiement:

```bash
./run.sh release phpmyadmin
```

Commande Docker Compose équivalente:

```bash
docker compose --env-file .env.release --profile db-admin -f deployment/docker-compose.yml -f deployment/docker-compose.release.yml up -d phpmyadmin
```

Par défaut, il est lié à `127.0.0.1:8082` en release via `PHPMYADMIN_BIND=127.0.0.1`, donc non exposé publiquement.

## OptaPlanner

OptaPlanner est séparé de MiniZinc. Il ne démarre que si le profile Compose `optaplanner` est activé.

Pour lancer toute la plateforme avec OptaPlanner disponible avant le démarrage du backend Node:

```bash
./run.sh start all dev --with-optaplanner
```

Démarrage avec le script court:

```bash
./run.sh start optaplanner
./run.sh logs optaplanner
./run.sh stop optaplanner
```

Démarrage avec le script détaillé:

```bash
./run.sh dev opta-up
./run.sh dev opta-logs
./run.sh dev opta-stop
```

Commande Compose équivalente:

```bash
docker compose --env-file .env.dev --profile optaplanner -f deployment/docker-compose.yml -f deployment/docker-compose.dev.yml up --build -d planning-solver
```

En développement, le service écoute aussi sur `http://localhost:8084`. En release/production, il reste uniquement sur le réseau interne Docker sauf configuration volontaire.

## Vérifications

Valider la configuration:

```bash
docker compose --env-file .env.dev -f deployment/docker-compose.yml -f deployment/docker-compose.dev.yml config
docker compose --env-file .env.release -f deployment/docker-compose.yml -f deployment/docker-compose.release.yml config
docker compose --env-file .env.prod -f deployment/docker-compose.yml -f deployment/docker-compose.prod.yml config
```

Vérifier les services:

```bash
./run.sh dev ps
./run.sh dev logs backend
./run.sh dev minizinc
./run.sh dev solvers
./run.sh dev mysql-ping
```

Les solveurs MiniZinc attendus dans le conteneur backend sont au minimum:

```text
Gecode
Chuffed
HiGHS
```

Tester un solveur dans le conteneur avec un modèle MiniZinc existant:

```bash
docker compose --env-file .env.dev -f deployment/docker-compose.yml -f deployment/docker-compose.dev.yml exec backend minizinc --solver gecode /var/lib/planify/minizinc/model.mzn
docker compose --env-file .env.dev -f deployment/docker-compose.yml -f deployment/docker-compose.dev.yml exec backend minizinc --solver chuffed /var/lib/planify/minizinc/model.mzn
docker compose --env-file .env.dev -f deployment/docker-compose.yml -f deployment/docker-compose.dev.yml exec backend minizinc --solver highs /var/lib/planify/minizinc/model.mzn
```

Si le build échoue sur `REQUIRE_MINIZINC_SOLVERS`, inspecter la sortie `MiniZinc solvers detected`. Avec la configuration par défaut, cela signifie généralement que le téléchargement du bundle officiel a changé, que le hash ne correspond plus, ou qu'une variable `MINIZINC_VERSION`/`MINIZINC_BUNDLE_SHA256` locale pointe vers une archive différente.

Vérifier les solveurs via l'API backend:

```bash
curl http://localhost:4000/api/solvers/minizinc
```

La réponse expose `availableSolvers` avec les clés normalisées, par exemple `gecode`, `chuffed`, `highs`, et `solvers` avec les identifiants exacts MiniZinc.

Choisir explicitement un solveur MiniZinc depuis l'API:

```json
{
  "solver": "gecode"
}
```

```json
{
  "solver": "chuffed"
}
```
```

```json
{
  "solver": "highs"
}
```

Le backend vérifie le solveur demandé contre la liste réelle de `minizinc --solvers-json`. Si le solveur est absent, il retourne une erreur claire avec les solveurs disponibles.

Tester la santé backend:

```bash
curl http://localhost:4000/api/health
```

En production, passer par le frontend/nginx:

```bash
curl http://localhost/api/health
```

## Variables d'environnement

Variables applicatives:

- `NODE_ENV`: `development` ou `production`.
- `APP_ENV`: `dev`, `release` ou `production`.
- `PORT`: port interne du backend, défaut `4000`.
- `FRONTEND_URL`: URL publique du frontend.
- `ALLOWED_ORIGINS`: origines CORS autorisées.
- `REACT_APP_API_BASE_URL`: URL API utilisée au build React. Vide en release/prod pour utiliser le même domaine via nginx.
- `LOG_LEVEL`: niveau de logs applicatifs.

MySQL:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_CONNECTION_LIMIT`

MiniZinc:

- `MINIZINC_PATH`: chemin du binaire, `/usr/bin/minizinc` dans le conteneur.
- `MINIZINC_DEFAULT_SOLVER`: solveur par défaut, `chuffed` dans les exemples Docker. Le backend accepte aussi les alias `gecode`, `chuffed`, `highs`, `cplex` et les résout vers l'identifiant MiniZinc exact détecté.
- `MINIZINC_VERSION`: version du bundle officiel MiniZinc installée dans l'image backend, par défaut `2.9.7`.
- `MINIZINC_BUNDLE_SHA256`: empreinte SHA-256 attendue de l'archive Linux MiniZinc.
- `MINIZINC_SOLVER_PACKAGES`: paquets apt additionnels facultatifs, vide par défaut. Chuffed et HiGHS viennent du bundle officiel MiniZinc, pas des dépôts Debian bookworm.
- `REQUIRE_MINIZINC_SOLVERS`: solveurs obligatoires vérifiés au build, par défaut `"Gecode Chuffed HiGHS"`. Si l'un manque, l'image backend échoue au build au lieu de démarrer avec une configuration incomplète.
- `MINIZINC_WORKDIR`: dossier de travail des fichiers générés.
- `MINIZINC_ENABLE_TIMEOUT`: `false` par défaut.
- `MINIZINC_DEFAULT_TIME_LIMIT`: `0` par défaut. Aucun timeout n'est appliqué tant que l'utilisateur ne choisit pas explicitement une limite.
- `SSE_HEARTBEAT_INTERVAL`: heartbeat SSE en millisecondes.

OptaPlanner:

- `OPTAPLANNER_URL`: URL interne du backend OptaPlanner, `http://planning-solver:8084` dans Docker.
- `OPTAPLANNER_TIMEOUT_MS`: timeout côté client HTTP Node pour l'ancien appel OptaPlanner synchrone. `0` par défaut signifie aucune coupure automatique; ce n'est pas une limite solveur.
- `OPTAPLANNER_JAVA_OPTS`: options JVM du service OptaPlanner.
- `OPTAPLANNER_PORT_PUBLIC`: port public en développement, par défaut `8084`.

Sessions:

- `AUTH_SESSION_TTL_DAYS`: durée de session opaque en jours, défaut conseillé `90`.
- `AUTH_TOKEN_BYTES`: taille du token opaque, défaut `32`.

Vault:

- `VAULT_ADDR`: adresse Vault.
- `VAULT_DEV_ROOT_TOKEN_ID`: uniquement en dev/release local, jamais en production réelle.

Le projet actuel utilise des tokens opaques stockés dans MySQL, pas des JWT. Les variables `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN` et `JWT_REFRESH_EXPIRES_IN` peuvent être ajoutées plus tard si le modèle d'authentification migre vers JWT. En attendant, la durée longue est portée par `AUTH_SESSION_TTL_DAYS`.

## Secrets et Vault

Ne jamais écrire de vrais secrets dans Git ou dans une image Docker.

Développement:

- le service `vault` démarre en mode dev avec un token factice;
- les secrets peuvent aussi rester dans `.env.dev` local.

Release:

- le service `vault` est disponible uniquement avec le profile `vault`:

```bash
docker compose --env-file .env.release --profile vault -f deployment/docker-compose.yml -f deployment/docker-compose.release.yml up -d vault
```

Production:

- utiliser un Vault externe ou l'orchestrateur de secrets de l'infrastructure;
- injecter les secrets par variables d'environnement ou secret manager;
- ne pas exposer Vault publiquement;
- ne pas utiliser `VAULT_TOKEN` en clair dans Git.

Secrets attendus:

- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `AUTH_SESSION_TTL_DAYS`
- `AUTH_TOKEN_BYTES`
- futurs `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET` si l'auth migre vers JWT.

## Sécurité conteneurs

Mesures appliquées:

- backend et frontend s'exécutent avec des utilisateurs non-root dans les images runtime;
- `security_opt: no-new-privileges:true`;
- capabilities Linux supprimées pour les services applicatifs;
- MySQL n'est pas exposé en release/production;
- réseaux séparés `public` et `internal`;
- volumes nommés pour MySQL et le workdir MiniZinc;
- production sans montage du code source;
- frontend nginx en lecture seule avec `tmpfs` pour les dossiers temporaires;
- backend en lecture seule en release/prod, avec workdir MiniZinc persistant et `/tmp` en `tmpfs`.

Ne pas utiliser `privileged: true`.

## Données persistantes

Volumes:

- `mysql_data`: données MySQL.
- `minizinc_workdir`: fichiers MiniZinc générés et temporaires longs.
- volumes `node_modules` et `pnpm_store`: seulement en dev.

Les logs d'exécution MiniZinc, les statuts et les solutions intermédiaires sont persistés en MySQL. Les fichiers temporaires MiniZinc ne sont pas la source de vérité.

## Exécutions longues et crash recovery

Garanties:

- un job MiniZinc ne dépend pas d'une requête HTTP longue;
- le frontend suit les logs via SSE et peut relire les logs persistés;
- les solutions intermédiaires sont sauvegardées en base au fil de l'eau;
- si le navigateur se déconnecte, il peut récupérer l'exécution et reprendre le flux;
- si le backend redémarre, les exécutions non terminales sont marquées `UNKNOWN` au démarrage;
- les solutions déjà trouvées restent consultables;
- une expiration de session navigateur ne tue pas le processus MiniZinc côté serveur.

Limite importante: si le conteneur backend tombe, le processus MiniZinc enfant tombe aussi. L'architecture conserve les logs et solutions déjà sauvegardés, puis marque l'exécution interrompue. Pour une reprise exacte du processus de solveur après crash, il faudrait externaliser MiniZinc dans un worker durable avec protocole de checkpoint, ce qui n'est pas encore dans le code actuel.

## Sauvegarde MySQL

Sauvegarde:

```bash
./run.sh prod backup ./backup-planning-spec.sql
```

Restauration:

```bash
./run.sh prod restore ./backup-planning-spec.sql
```

Vérifier les volumes:

```bash
docker volume ls | grep planify
```

## Redémarrage propre

Arrêter les services sans supprimer les volumes:

```bash
./run.sh prod down
```

Redémarrer:

```bash
./run.sh start prod
```

Ne pas utiliser `docker compose down -v` en production sauf si vous voulez supprimer les données.

## Procédure après incident

1. Redémarrer les services:

```bash
./run.sh start prod
```

2. Vérifier MySQL et backend:

```bash
./run.sh prod ps
docker compose --env-file .env.prod -f deployment/docker-compose.yml -f deployment/docker-compose.prod.yml logs --tail=200 backend
```

3. Ouvrir l'application et consulter les exécutions. Les exécutions actives avant crash doivent apparaître en `UNKNOWN` si le processus MiniZinc a disparu.

4. Vérifier les solutions intermédiaires déjà enregistrées et ouvrir les rapports disponibles.

## Commandes utiles

Logs backend:

```bash
./run.sh logs backend
```

Logs frontend:

```bash
./run.sh logs frontend
```

Shell backend:

```bash
./run.sh dev shell
```

Version MiniZinc:

```bash
./run.sh dev minizinc
```

Liste des solveurs:

```bash
./run.sh dev solvers
```

## Tests fonctionnels recommandés

- lancer le backend et vérifier `/api/health`;
- vérifier `minizinc --version` dans le conteneur backend;
- créer une planification;
- lancer une exécution MiniZinc longue;
- observer les logs SSE dans l'éditeur;
- vérifier la sauvegarde des solutions intermédiaires;
- ouvrir un rapport pendant que le solveur continue;
- arrêter manuellement l'exécution;
- redémarrer le backend pendant une exécution et vérifier le statut `UNKNOWN`;
- vérifier qu'aucun timeout MiniZinc ou OptaPlanner n'est appliqué par défaut.
