#!/usr/bin/env sh
set -eu

required_solvers="${REQUIRE_MINIZINC_SOLVERS:-Gecode Chuffed HiGHS}"

if [ -z "$required_solvers" ]; then
  printf 'MiniZinc solver verification skipped because REQUIRE_MINIZINC_SOLVERS is empty.\n'
  exit 0
fi

solvers_output="$(minizinc --solvers-json 2>&1 || true)"

printf '%s\n' "MiniZinc solvers detected:"
printf '%s\n' "$solvers_output"

missing=""
for solver in $required_solvers; do
  case "$solver" in
    High|HiGHS|Highs|high|highs)
      pattern='highs|high'
      ;;
    *)
      pattern="$solver"
      ;;
  esac

  if ! printf '%s\n' "$solvers_output" | grep -Eiq "$pattern"; then
    missing="$missing $solver"
  fi
done

if [ -n "$missing" ]; then
  printf '%s\n' "ERROR: required MiniZinc solver(s) not detected:$missing" >&2
  printf '%s\n' "Install the missing solver packages or override MINIZINC_SOLVER_PACKAGES/REQUIRE_MINIZINC_SOLVERS." >&2
  exit 1
fi

printf '%s\n' "Required MiniZinc solvers are available: $required_solvers"
