#!/usr/bin/env sh
set -eu

PROJECT_NAME="planify"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./planify-docker.sh <env> [command] [options]

Environments:
  dev        docker-compose.yml + docker-compose.dev.yml
  release    docker-compose.yml + docker-compose.release.yml
  prod       docker-compose.yml + docker-compose.prod.yml

Commands:
  up         Build images and start services. Default command.
  start      Alias of up.
  build      Build images only.
  rebuild    Pull base images, rebuild without cache, then start.
  down       Stop containers without deleting volumes.
  stop       Stop containers.
  restart    Restart containers.
  ps         Show services state.
  logs       Follow logs. Pass a service name after logs if needed.
  config     Render and validate Docker Compose config.
  pull       Pull base images.
  minizinc   Run minizinc --version in backend container.
  solvers    Show MiniZinc version and available solvers in backend container.
  mysql-ping Ping MySQL from mysql container.
  phpmyadmin Start phpMyAdmin. In release, enables the db-admin profile.
  opta-up    Build and start the OptaPlanner backend.
  opta-stop  Stop the OptaPlanner backend.
  opta-restart Restart the OptaPlanner backend.
  opta-logs  Follow OptaPlanner backend logs.
  backup     Dump MySQL to a SQL file. Optional path argument.
  restore    Restore MySQL from a SQL file. Requires path argument.
  shell      Open a shell in backend container.

Examples:
  ./planify-docker.sh dev
  ./planify-docker.sh dev logs backend
  ./planify-docker.sh release up -d
  ./planify-docker.sh prod rebuild -d
  ./planify-docker.sh prod solvers
  ./planify-docker.sh dev opta-up
  ./planify-docker.sh dev opta-stop
  ./planify-docker.sh dev phpmyadmin
  ./planify-docker.sh release phpmyadmin
  ./planify-docker.sh prod backup ./backup.sql
  ./planify-docker.sh prod restore ./backup.sql

Environment file:
  The script uses .env.<env> if it exists, otherwise .env.
  If neither exists, it uses .env.<env>.example for safe local defaults.
EOF
}

die() {
  printf '%s\n' "Error: $*" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || die "Required file not found: $1"
}

compose_file_for_env() {
  case "$1" in
    dev) printf '%s\n' "docker-compose.dev.yml" ;;
    release) printf '%s\n' "docker-compose.release.yml" ;;
    prod|production) printf '%s\n' "docker-compose.prod.yml" ;;
    *) die "Unknown environment '$1'. Expected dev, release or prod." ;;
  esac
}

env_name_for_env() {
  case "$1" in
    dev) printf '%s\n' "dev" ;;
    release) printf '%s\n' "release" ;;
    prod|production) printf '%s\n' "prod" ;;
    *) die "Unknown environment '$1'." ;;
  esac
}

select_env_file() {
  env_name="$1"

  if [ -f "$ROOT_DIR/.env.$env_name" ]; then
    printf '%s\n' "$ROOT_DIR/.env.$env_name"
    return
  fi

  if [ -f "$ROOT_DIR/.env" ]; then
    printf '%s\n' "$ROOT_DIR/.env"
    return
  fi

  if [ -f "$ROOT_DIR/.env.$env_name.example" ]; then
    printf '%s\n' "$ROOT_DIR/.env.$env_name.example"
    return
  fi

  die "No env file found. Copy .env.$env_name.example to .env or .env.$env_name first."
}

load_env_file() {
  env_file="$1"
  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
}

compose() {
  docker compose \
    --project-name "${COMPOSE_PROJECT_NAME:-$PROJECT_NAME-$ENV_NAME}" \
    --env-file "$ENV_FILE" \
    -f "$ROOT_DIR/docker-compose.yml" \
    -f "$ROOT_DIR/$ENV_COMPOSE_FILE" \
    "$@"
}

enable_profile() {
  profile="$1"
  case ",${COMPOSE_PROFILES:-}," in
    *,"$profile",*) ;;
    *)
      COMPOSE_PROFILES="${COMPOSE_PROFILES:+$COMPOSE_PROFILES,}$profile"
      export COMPOSE_PROFILES
      ;;
  esac
}

backup_mysql() {
  output_path="${1:-$ROOT_DIR/backup-${ENV_NAME}-$(date +%Y%m%d-%H%M%S).sql}"
  compose exec -T mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > "$output_path"
  printf 'Backup written to %s\n' "$output_path"
}

restore_mysql() {
  input_path="${1:-}"
  [ -n "$input_path" ] || die "restore requires a SQL file path."
  [ -f "$input_path" ] || die "SQL file not found: $input_path"
  compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < "$input_path"
  printf 'Restore completed from %s\n' "$input_path"
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

ENV_INPUT="${1:-dev}"
shift || true

ENV_NAME="$(env_name_for_env "$ENV_INPUT")"
ENV_COMPOSE_FILE="$(compose_file_for_env "$ENV_INPUT")"
ENV_FILE="$(select_env_file "$ENV_NAME")"

require_file "$ROOT_DIR/docker-compose.yml"
require_file "$ROOT_DIR/$ENV_COMPOSE_FILE"

load_env_file "$ENV_FILE"

COMMAND="${1:-up}"
if [ $# -gt 0 ]; then
  shift
fi

printf 'Environment: %s\n' "$ENV_NAME"
printf 'Env file:    %s\n' "$ENV_FILE"
printf 'Compose:     docker-compose.yml + %s\n' "$ENV_COMPOSE_FILE"

case "$COMMAND" in
  up|start)
    if [ "$#" -eq 0 ]; then
      if [ "$ENV_NAME" = "dev" ]; then
        compose up --build
      else
        compose up --build -d
      fi
    else
      compose up --build "$@"
    fi
    ;;
  build)
    compose build "$@"
    ;;
  rebuild)
    compose pull
    compose build --no-cache
    if [ "$ENV_NAME" = "dev" ]; then
      compose up "$@"
    else
      compose up -d "$@"
    fi
    ;;
  down)
    compose down "$@"
    ;;
  stop)
    compose stop "$@"
    ;;
  restart)
    compose restart "$@"
    ;;
  ps)
    compose ps "$@"
    ;;
  logs)
    compose logs -f "$@"
    ;;
  config)
    compose config "$@"
    ;;
  pull)
    compose pull "$@"
    ;;
  minizinc)
    compose exec backend minizinc --version
    ;;
  solvers)
    compose exec backend minizinc --version
    compose exec backend minizinc --solvers
    ;;
  mysql-ping)
    compose exec mysql sh -c 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent'
    ;;
  phpmyadmin)
    if [ "$ENV_NAME" = "release" ]; then
      COMPOSE_PROFILES=db-admin
      export COMPOSE_PROFILES
    fi
    compose up -d phpmyadmin
    ;;
  opta-up|optaplanner-up)
    enable_profile optaplanner
    compose up --build -d planning-solver
    ;;
  opta-stop|optaplanner-stop)
    enable_profile optaplanner
    compose stop planning-solver
    ;;
  opta-restart|optaplanner-restart)
    enable_profile optaplanner
    compose up --build -d planning-solver
    compose restart planning-solver
    ;;
  opta-logs|optaplanner-logs)
    enable_profile optaplanner
    compose logs -f planning-solver
    ;;
  backup)
    backup_mysql "${1:-}"
    ;;
  restore)
    restore_mysql "${1:-}"
    ;;
  shell)
    compose exec backend sh
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    die "Unknown command '$COMMAND'. Run ./planify-docker.sh --help."
    ;;
esac
