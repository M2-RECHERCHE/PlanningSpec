#!/usr/bin/env sh
set -eu

PROJECT_NAME="planify"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DEPLOYMENT_DIR="$ROOT_DIR/deployment"
DEFAULT_ENV="${PLANIFY_ENV:-dev}"

usage() {
  cat <<'EOF'
Usage:
  ./run.sh start [dev|release|prod] [--with-optaplanner] [--detach]
  ./run.sh start all [dev|release|prod] [--with-optaplanner] [--detach]
  ./run.sh stop [dev|release|prod]
  ./run.sh restart [dev|release|prod] [--with-optaplanner]
  ./run.sh logs [dev|release|prod] [backend|frontend|mysql|optaplanner]
  ./run.sh build [dev|release|prod] [service]
  ./run.sh config [dev|release|prod] [docker compose config options]
  ./run.sh solvers [dev|release|prod]
  ./run.sh env [dev|release|prod]

OptaPlanner:
  ./run.sh start all dev --with-optaplanner
  ./run.sh start optaplanner [dev|release|prod]
  ./run.sh stop optaplanner [dev|release|prod]
  ./run.sh restart optaplanner [dev|release|prod]
  ./run.sh logs optaplanner [dev|release|prod]

Compatibility:
  ./run.sh dev up
  ./run.sh release up -d
  ./run.sh prod logs backend

Notes:
  Missing .env.<env> files are created from .env.<env>.example.
  Use --with-optaplanner when the Node backend must detect the Spring Boot solver at startup.
EOF
}

die() {
  printf '%s\n' "Error: $*" >&2
  exit 1
}

is_env() {
  case "${1:-}" in
    dev|release|prod|production) return 0 ;;
    *) return 1 ;;
  esac
}

env_name_for_env() {
  case "$1" in
    dev) printf '%s\n' "dev" ;;
    release) printf '%s\n' "release" ;;
    prod|production) printf '%s\n' "prod" ;;
    *) die "Unknown environment '$1'. Expected dev, release or prod." ;;
  esac
}

compose_file_for_env() {
  case "$1" in
    dev) printf '%s\n' "docker-compose.dev.yml" ;;
    release) printf '%s\n' "docker-compose.release.yml" ;;
    prod) printf '%s\n' "docker-compose.prod.yml" ;;
    *) die "Unknown environment '$1'." ;;
  esac
}

env_or_default() {
  if is_env "${1:-}"; then
    env_name_for_env "$1"
  else
    printf '%s\n' "$DEFAULT_ENV"
  fi
}

ensure_env_file() {
  env_name="$1"
  env_file="$ROOT_DIR/.env.$env_name"
  example_file="$ROOT_DIR/.env.$env_name.example"
  generic_example="$ROOT_DIR/.env.example"

  if [ -f "$env_file" ]; then
    printf '%s\n' "$env_file"
    return
  fi

  if [ -f "$example_file" ]; then
    cp "$example_file" "$env_file"
    chmod 600 "$env_file" 2>/dev/null || true
    printf 'Created %s from %s\n' "$env_file" "$example_file" >&2
    printf '%s\n' "$env_file"
    return
  fi

  if [ -f "$generic_example" ]; then
    cp "$generic_example" "$env_file"
    chmod 600 "$env_file" 2>/dev/null || true
    printf 'Created %s from %s\n' "$env_file" "$generic_example" >&2
    printf '%s\n' "$env_file"
    return
  fi

  die "No env example found for $env_name."
}

load_env_file() {
  env_file="$1"
  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
}

setup_env() {
  ENV_NAME="$(env_name_for_env "$1")"
  ENV_COMPOSE_FILE="$(compose_file_for_env "$ENV_NAME")"
  BASE_COMPOSE_FILE="$DEPLOYMENT_DIR/docker-compose.yml"
  ENV_COMPOSE_PATH="$DEPLOYMENT_DIR/$ENV_COMPOSE_FILE"
  ENV_FILE="$(ensure_env_file "$ENV_NAME")"

  [ -f "$BASE_COMPOSE_FILE" ] || die "Required file not found: $BASE_COMPOSE_FILE"
  [ -f "$ENV_COMPOSE_PATH" ] || die "Required file not found: $ENV_COMPOSE_PATH"

  load_env_file "$ENV_FILE"
}

print_context() {
  printf 'Environment: %s\n' "$ENV_NAME"
  printf 'Env file:    %s\n' "$ENV_FILE"
  printf 'Compose:     deployment/docker-compose.yml + deployment/%s\n' "$ENV_COMPOSE_FILE"
}

compose() {
  docker compose \
    --project-name "${COMPOSE_PROJECT_NAME:-$PROJECT_NAME-$ENV_NAME}" \
    --env-file "$ENV_FILE" \
    -f "$BASE_COMPOSE_FILE" \
    -f "$ENV_COMPOSE_PATH" \
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

service_name() {
  case "${1:-}" in
    opta|optaplanner|planning-solver) printf '%s\n' "planning-solver" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

has_arg() {
  needle="$1"
  shift || true
  for arg in "$@"; do
    [ "$arg" = "$needle" ] && return 0
  done
  return 1
}

has_optaplanner_arg() {
  for arg in "$@"; do
    case "$arg" in
      --with-optaplanner|--with-opta|--opta) return 0 ;;
    esac
  done
  return 1
}

wait_for_service_healthy() {
  service="$1"
  timeout_seconds="${2:-180}"
  elapsed=0

  printf 'Waiting for %s to become healthy...\n' "$service"
  while [ "$elapsed" -lt "$timeout_seconds" ]; do
    container_id="$(compose ps -q "$service" 2>/dev/null || true)"
    if [ -n "$container_id" ]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || printf unknown)"
      case "$status" in
        healthy)
          printf '%s is healthy.\n' "$service"
          return 0
          ;;
        unhealthy|exited|dead)
          compose ps "$service"
          die "$service is $status."
          ;;
      esac
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  compose ps "$service"
  die "Timeout while waiting for $service health."
}

start_optaplanner_service() {
  enable_profile optaplanner
  compose up --build -d planning-solver
  wait_for_service_healthy planning-solver "${OPTAPLANNER_START_TIMEOUT_SECONDS:-240}"
}

start_stack() {
  with_optaplanner=0
  detached=0

  has_optaplanner_arg "$@" && with_optaplanner=1
  if has_arg "--detach" "$@" || has_arg "-d" "$@" || [ "$ENV_NAME" != "dev" ]; then
    detached=1
  fi

  if [ "$with_optaplanner" -eq 1 ]; then
    start_optaplanner_service
  fi

  if [ "$detached" -eq 1 ]; then
    compose up --build -d
  else
    compose up --build
  fi
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

run_compose_command() {
  command="${1:-up}"
  if [ "$#" -gt 0 ]; then
    shift
  fi

  print_context
  case "$command" in
    up|start)
      compose up --build "$@"
      ;;
    build)
      compose build "$@"
      ;;
    rebuild)
      compose pull
      compose build --no-cache
      compose up "$@"
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
      if [ "${1:-}" = "optaplanner" ] || [ "${1:-}" = "opta" ]; then
        enable_profile optaplanner
        compose logs -f planning-solver
      else
        compose logs -f "$@"
      fi
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
        enable_profile db-admin
      fi
      compose up -d phpmyadmin
      ;;
    opta-up|optaplanner-up)
      start_optaplanner_service
      ;;
    opta-stop|optaplanner-stop)
      enable_profile optaplanner
      compose stop planning-solver
      ;;
    opta-restart|optaplanner-restart)
      enable_profile optaplanner
      compose up --build -d planning-solver
      compose restart planning-solver
      wait_for_service_healthy planning-solver "${OPTAPLANNER_START_TIMEOUT_SECONDS:-240}"
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
    *)
      die "Unknown command '$command'. Run ./run.sh --help."
      ;;
  esac
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "help" ]; then
  usage
  exit 0
fi

if is_env "${1:-}"; then
  setup_env "$1"
  shift || true
  if [ "$#" -eq 0 ]; then
    print_context
    start_stack
    exit 0
  fi

  legacy_command="$1"
  shift || true
  run_compose_command "$legacy_command" "$@"
  exit 0
fi

command="${1:-help}"
shift || true

case "$command" in
  env)
    env_name="$(env_or_default "${1:-}")"
    setup_env "$env_name"
    print_context
    ;;

  start|up)
    target="${1:-}"
    if [ "$target" = "optaplanner" ] || [ "$target" = "opta" ]; then
      env_name="$(env_or_default "${2:-}")"
      setup_env "$env_name"
      print_context
      start_optaplanner_service
      exit 0
    fi

    if [ "$target" = "all" ] || [ "$target" = "project" ] || [ "$target" = "stack" ]; then
      shift || true
      if is_env "${1:-}"; then
        env_name="$(env_name_for_env "$1")"
        shift || true
      else
        env_name="$DEFAULT_ENV"
      fi
    elif is_env "$target"; then
      env_name="$(env_name_for_env "$target")"
      shift || true
    else
      env_name="$DEFAULT_ENV"
    fi

    setup_env "$env_name"
    print_context
    start_stack "$@"
    ;;

  stop|down|restart|build|config|ps|pull)
    env_name="$(env_or_default "${1:-}")"
    if is_env "${1:-}"; then
      shift || true
    fi
    setup_env "$env_name"
    run_compose_command "$command" "$@"
    ;;

  logs)
    first="${1:-}"
    second="${2:-}"
    if is_env "$first"; then
      env_name="$(env_name_for_env "$first")"
      service="${second:-}"
    else
      env_name="$(env_or_default "$second")"
      service="$first"
    fi

    setup_env "$env_name"
    if [ "$service" = "optaplanner" ] || [ "$service" = "opta" ]; then
      run_compose_command opta-logs
    elif [ -n "$service" ]; then
      run_compose_command logs "$(service_name "$service")"
    else
      run_compose_command logs
    fi
    ;;

  solvers|minizinc|mysql-ping|phpmyadmin|shell)
    env_name="$(env_or_default "${1:-}")"
    setup_env "$env_name"
    run_compose_command "$command"
    ;;

  backup|restore)
    env_name="$DEFAULT_ENV"
    if is_env "${1:-}"; then
      env_name="$(env_name_for_env "$1")"
      shift || true
    fi
    setup_env "$env_name"
    run_compose_command "$command" "${1:-}"
    ;;

  optaplanner|opta|planning-solver)
    subcommand="${1:-start}"
    env_name="$(env_or_default "${2:-}")"
    setup_env "$env_name"
    case "$subcommand" in
      start|up) run_compose_command opta-up ;;
      stop) run_compose_command opta-stop ;;
      restart) run_compose_command opta-restart ;;
      logs) run_compose_command opta-logs ;;
      *) die "Unknown OptaPlanner command '$subcommand'." ;;
    esac
    ;;

  *)
    die "Unknown command '$command'. Run ./run.sh --help."
    ;;
esac
