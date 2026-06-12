#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PLANIFY="${ROOT_DIR}/planify-docker.sh"
DEFAULT_ENV="${PLANIFY_ENV:-dev}"

usage() {
  cat <<'EOF'
Usage:
  ./project.sh start [dev|release|prod]
  ./project.sh stop [dev|release|prod]
  ./project.sh restart [dev|release|prod]
  ./project.sh logs [dev|release|prod] [backend|frontend|mysql|optaplanner]
  ./project.sh solvers [dev|release|prod]
  ./project.sh start optaplanner [dev|release|prod]
  ./project.sh stop optaplanner [dev|release|prod]
  ./project.sh restart optaplanner [dev|release|prod]
  ./project.sh logs optaplanner [dev|release|prod]

Examples:
  ./project.sh start dev
  ./project.sh stop prod
  ./project.sh logs backend
  ./project.sh logs release backend
  ./project.sh solvers
  ./project.sh start optaplanner
  ./project.sh stop optaplanner
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

env_or_default() {
  if is_env "${1:-}"; then
    printf '%s\n' "$1"
  else
    printf '%s\n' "$DEFAULT_ENV"
  fi
}

require_planify() {
  [ -x "$PLANIFY" ] || die "Script not executable: $PLANIFY"
}

command="${1:-help}"
shift || true

case "$command" in
  start|up)
    target="${1:-}"
    if [ "$target" = "optaplanner" ] || [ "$target" = "opta" ]; then
      env_name="$(env_or_default "${2:-}")"
      require_planify
      exec "$PLANIFY" "$env_name" opta-up
    fi

    env_name="$(env_or_default "$target")"
    require_planify
    exec "$PLANIFY" "$env_name" up
    ;;

  stop)
    target="${1:-}"
    if [ "$target" = "optaplanner" ] || [ "$target" = "opta" ]; then
      env_name="$(env_or_default "${2:-}")"
      require_planify
      exec "$PLANIFY" "$env_name" opta-stop
    fi

    env_name="$(env_or_default "$target")"
    require_planify
    exec "$PLANIFY" "$env_name" stop
    ;;

  restart)
    target="${1:-}"
    if [ "$target" = "optaplanner" ] || [ "$target" = "opta" ]; then
      env_name="$(env_or_default "${2:-}")"
      require_planify
      exec "$PLANIFY" "$env_name" opta-restart
    fi

    env_name="$(env_or_default "$target")"
    require_planify
    exec "$PLANIFY" "$env_name" restart
    ;;

  logs)
    first="${1:-}"
    second="${2:-}"
    if is_env "$first"; then
      env_name="$first"
      service="$second"
    else
      env_name="$(env_or_default "$second")"
      service="$first"
    fi

    require_planify
    case "$service" in
      optaplanner|opta|planning-solver)
        exec "$PLANIFY" "$env_name" opta-logs
        ;;
      "")
        exec "$PLANIFY" "$env_name" logs
        ;;
      *)
        exec "$PLANIFY" "$env_name" logs "$service"
        ;;
    esac
    ;;

  solvers)
    env_name="$(env_or_default "${1:-}")"
    require_planify
    exec "$PLANIFY" "$env_name" solvers
    ;;

  help|-h|--help)
    usage
    ;;

  *)
    die "Unknown command '$command'. Run ./project.sh --help."
    ;;
esac
