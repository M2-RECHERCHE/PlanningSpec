# Déploiement Docker Planify

Ce document décrit la configuration Docker pour la plateforme de planification DSL/Langium/MiniZinc/Node/React/MySQL.

## Architecture

Services principaux:

- `frontend`: React servi par nginx non-root en release/production, ou `react-scripts start` en développement.
- `backend`: API Express Node.js. MiniZinc est installé dans ce conteneur, car l'API possède déjà le registre des processus, les logs SSE, l'arrêt manuel et la persistance des solutions.
- `planning-solver`: backend Spring Boot OptaPlanner optionnel, activé avec le profile Docker Compose `optaplanner`.
- `mysql`: base de données persistante. Le service est déclaré dans `docker-compose.yml`; les fichiers `docker-compose.dev.yml`, `docker-compose.release.yml` et `docker-compose.prod.yml` ne font qu'ajuster son exposition, son redémarrage et ses options.
- `adminer`: outil de debug MySQL uniquement en développement.
- `phpmyadmin`: outil MySQL disponible en développement, et optionnel en release via le profile `db-admin`.
- `vault`: Vault local de développement, et optionnel en release via profile Docker Compose.

MiniZinc est exécuté de manière asynchrone par le backend. Les logs et solutions intermédiaires sont sauvegardés en base MySQL. Une requête HTTP longue n'est pas nécessaire pour garder une optimisation active.

## Fichiers

- `docker-compose.yml`: base commune.
- `docker-compose.dev.yml`: développement avec hot reload, ports exposés, Adminer et Vault local.
- `docker-compose.release.yml`: staging/release proche production.
- `docker-compose.prod.yml`: production avec ports réduits, redémarrage automatique et limites de ressources.
- `docker/backend.Dockerfile`: image API + MiniZinc.
- `docker/frontend.Dockerfile`: image React/nginx.
- `docker/nginx-frontend.conf`: nginx statique + proxy `/api` vers le backend.
- `backend/planning-solver-springboot/Dockerfile`: image du backend OptaPlanner.

## Préparation

Copier un fichier d'environnement exemple vers `.env`:

```bash
cp .env.dev.example .env
```

Pour release:

```bash
cp .env.release.example .env
```

Pour production:

```bash
cp .env.prod.example .env
```

Remplacer toutes les valeurs `change-me` ou `replace-with-*`. Ne pas commiter `.env`.

## Lancement

Le script racine [planify-docker.sh](./planify-docker.sh) encapsule les commandes Compose par environnement.
Le script [project.sh](./project.sh) fournit aussi une interface courte compatible avec `start dev`, `logs backend` et `start optaplanner`.

Développement avec build et logs attachés:

```bash
./planify-docker.sh dev
```

Release/staging avec build en arrière-plan:

```bash
./planify-docker.sh release
```

Par défaut, la release écoute sur la machine de déploiement via `http://localhost:8080`. Si vous y accédez depuis une autre machine avant de configurer le nom de domaine, ajoutez aussi l'origine avec l'IP du serveur dans `ALLOWED_ORIGINS`, par exemple `http://192.168.1.10:8080`.

Production avec build en arrière-plan:

```bash
./planify-docker.sh prod
```

Commandes utiles avec le script:

```bash
./project.sh start dev
./project.sh stop dev
./project.sh restart dev
./project.sh logs backend
./project.sh logs mysql
./project.sh solvers
./project.sh start optaplanner
./project.sh logs optaplanner
./project.sh stop optaplanner

./planify-docker.sh dev config
./planify-docker.sh dev logs backend
./planify-docker.sh prod ps
./planify-docker.sh prod minizinc
./planify-docker.sh prod solvers
./planify-docker.sh dev opta-up
./planify-docker.sh dev opta-logs
./planify-docker.sh dev opta-stop
./planify-docker.sh prod mysql-ping
./planify-docker.sh dev phpmyadmin
./planify-docker.sh release phpmyadmin
./planify-docker.sh prod backup ./backup.sql
./planify-docker.sh prod restore ./backup.sql
./planify-docker.sh prod down
```

Le script utilise `.env.dev`, `.env.release` ou `.env.prod` si le fichier existe, sinon `.env`, sinon le fichier `.env.<env>.example`.

Commandes Docker Compose directes équivalentes:

Développement:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Release/staging:

```bash
docker compose -f docker-compose.yml -f docker-compose.release.yml up --build -d
```

Production:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
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
./planify-docker.sh release phpmyadmin
```

Commande Docker Compose équivalente:

```bash
docker compose --profile db-admin -f docker-compose.yml -f docker-compose.release.yml up -d phpmyadmin
```

Par défaut, il est lié à `127.0.0.1:8082` en release via `PHPMYADMIN_BIND=127.0.0.1`, donc non exposé publiquement.

## OptaPlanner

OptaPlanner est séparé de MiniZinc. Il ne démarre que si le profile Compose `optaplanner` est activé.

Démarrage avec le script court:

```bash
./project.sh start optaplanner
./project.sh logs optaplanner
./project.sh stop optaplanner
```

Démarrage avec le script détaillé:

```bash
./planify-docker.sh dev opta-up
./planify-docker.sh dev opta-logs
./planify-docker.sh dev opta-stop
```

Commande Compose équivalente:

```bash
docker compose --profile optaplanner -f docker-compose.yml -f docker-compose.dev.yml up --build -d planning-solver
```

En développement, le service écoute aussi sur `http://localhost:8084`. En release/production, il reste uniquement sur le réseau interne Docker sauf configuration volontaire.

## Vérifications

Valider la configuration:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
docker compose -f docker-compose.yml -f docker-compose.release.yml config
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

Vérifier les services:

```bash
docker compose ps
docker compose logs -f backend
docker compose exec backend minizinc --version
docker compose exec backend minizinc --solvers
docker compose exec mysql mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD"
```

Les solveurs MiniZinc attendus dans le conteneur backend sont au minimum:

```text
Gecode
Chuffed
HiGHS
```

Tester un solveur dans le conteneur avec un modèle MiniZinc existant:

```bash
docker compose exec backend minizinc --solver gecode /var/lib/planify/minizinc/model.mzn
docker compose exec backend minizinc --solver chuffed /var/lib/planify/minizinc/model.mzn
docker compose exec backend minizinc --solver highs /var/lib/planify/minizinc/model.mzn
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
- `OPTAPLANNER_TIMEOUT_MS`: timeout côté client HTTP Node lors des appels OptaPlanner.
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
- les secrets peuvent aussi rester dans `.env` local.

Release:

- le service `vault` est disponible uniquement avec le profile `vault`:

```bash
docker compose --profile vault -f docker-compose.yml -f docker-compose.release.yml up -d vault
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
docker compose exec mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup-planning-spec.sql
```

Restauration:

```bash
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < backup-planning-spec.sql
```

Vérifier les volumes:

```bash
docker volume ls | grep planify
```

## Redémarrage propre

Arrêter les services sans supprimer les volumes:

```bash
docker compose down
```

Redémarrer:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Ne pas utiliser `docker compose down -v` en production sauf si vous voulez supprimer les données.

## Procédure après incident

1. Redémarrer les services:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

2. Vérifier MySQL et backend:

```bash
docker compose ps
docker compose logs --tail=200 backend
```

3. Ouvrir l'application et consulter les exécutions. Les exécutions actives avant crash doivent apparaître en `UNKNOWN` si le processus MiniZinc a disparu.

4. Vérifier les solutions intermédiaires déjà enregistrées et ouvrir les rapports disponibles.

## Commandes utiles

Logs backend:

```bash
docker compose logs -f backend
```

Logs frontend:

```bash
docker compose logs -f frontend
```

Shell backend:

```bash
docker compose exec backend sh
```

Version MiniZinc:

```bash
docker compose exec backend minizinc --version
```

Liste des solveurs:

```bash
docker compose exec backend minizinc --solvers
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
- vérifier qu'aucun timeout MiniZinc n'est appliqué par défaut.
