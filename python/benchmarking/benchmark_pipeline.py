#!/usr/bin/env python3
"""Pipeline de benchmark: .planning -> .mzn (backend CLI) -> solveurs MiniZinc."""

from __future__ import annotations

import argparse
import asyncio
import glob
import hashlib
import math
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, Iterable, Optional, Tuple

try:
    import minizinc as mz
except ModuleNotFoundError:
    mz = None

try:
    import pandas as pd
except ModuleNotFoundError:
    pd = None

# Evite les warnings matplotlib quand $HOME/.config n'est pas writable.
if "MPLCONFIGDIR" not in os.environ:
    os.environ["MPLCONFIGDIR"] = "/tmp/benchmarking_mplconfig"
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

try:
    import matplotlib.pyplot as plt
except ModuleNotFoundError:
    plt = None

if TYPE_CHECKING:
    import minizinc

DEFAULT_TIMEOUT_SECONDS = 300
CSV_COLUMNS = [
    "Instance",
    "Family",
    "A",
    "R",
    "K",
    "T",
    "Solveur",
    "T_flat",
    "T_solve",
    "T_total",
    "Statut",
]

# Solveurs cibles par defaut pour le benchmark.
SOLVER_CANDIDATES = {
    "Gecode": ["Gecode", "gecode"],
    "Chuffed": ["Chuffed", "chuffed"],
    "HiGHS": ["HiGHS", "Highs", "highs"],
    "OR Tools CP-SAT": ["OR Tools CP-SAT", "cp-sat", "or-tools", "ortools"],
    "COIN-BC": ["COIN-BC", "coin-bc", "coinbc", "cbc"],
}

OPTAPLANNER_CANDIDATES = {
    "OptaPlanner": ["OptaPlanner", "optaplanner"],
}

PLOT_FILES = {
    "curve_01_boxplot_t_total.png": "Distribution de T_total par solveur",
    "curve_02_boxplot_t_solve.png": "Distribution de T_solve par solveur",
    "curve_03_mean_times.png": "Comparaison des temps moyens (T_flat, T_solve, T_total)",
    "curve_04_status_stacked.png": "Repartition des statuts par solveur",
    "curve_05_success_timeout_rates.png": "Taux de succes vs taux de timeout",
    "curve_06_cactus_t_total.png": "Cactus plot: progression des instances resolues",
    "curve_07_ttotal_vs_A.png": "Evolution de T_total median selon A (taille activites)",
    "curve_08_tsolve_vs_A.png": "Evolution de T_solve median selon A",
    "curve_09_success_rate_vs_A.png": "Taux de succes selon A",
    "curve_10_median_ttotal_by_family.png": "T_total median par famille de probleme",
    "curve_11_opt_rate_by_family.png": "Taux de preuve d'optimalite par famille",
}


@dataclass
class RunResult:
    t_flat: Optional[float]
    t_solve: Optional[float]
    t_total: float
    status: str


def extract_params(_filename: str) -> Tuple[int, int, int, int]:
    """
    Extrait A/R/K/T depuis un nom de fichier de type:
    - instance_A30_R10_K3_T40.planning
    - instance-A30-R10-K3-T40.mzn
    Retourne (0,0,0,0) si absent.
    """
    filename = Path(_filename).stem
    patterns = {
        "A": re.compile(r"(?:^|[_-])A(?P<v>\d+)(?:[_-]|$)", re.IGNORECASE),
        "R": re.compile(r"(?:^|[_-])R(?P<v>\d+)(?:[_-]|$)", re.IGNORECASE),
        "K": re.compile(r"(?:^|[_-])K(?P<v>\d+)(?:[_-]|$)", re.IGNORECASE),
        "T": re.compile(r"(?:^|[_-])T(?P<v>\d+)(?:[_-]|$)", re.IGNORECASE),
    }

    values: Dict[str, int] = {"A": 0, "R": 0, "K": 0, "T": 0}
    for key, pattern in patterns.items():
        match = pattern.search(filename)
        if match:
            values[key] = int(match.group("v"))

    return (values["A"], values["R"], values["K"], values["T"])


def extract_family(_filename: str) -> str:
    """
    Extrait la famille depuis un nom encode par generate_soutenance_instances.py:
    - soutenance_Foptimisation_A10_R30_K4_T6_S1.planning -> optimisation

    Retourne "unknown" si le nom n'encode pas de famille.
    """
    filename = Path(_filename).stem
    match = re.search(r"(?:^|[_-])F(?P<family>[A-Za-z0-9][A-Za-z0-9_-]*?)(?=_(?:A\d+|R\d+|K\d+|T\d+|S\d+)|$)", filename)
    if match:
        return match.group("family")
    known_families = [
        "satisfaction",
        "optimisation",
        "scaling",
    ]
    for family in known_families:
        if family in filename:
            return family
    return "unknown"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Benchmark automatique .planning/.mzn avec generation MiniZinc puis "
            "resolution via minizinc-python."
        )
    )
    parser.add_argument(
        "inputs",
        nargs="*",
        help=(
            "Chemins d'entree (fichier .planning/.mzn, dossier, ou motif glob). "
            "Exemples: backend/test_files/planning1.planning, "
            "backend/test_files, 'backend/test_files/**/*.planning'"
        ),
    )
    parser.add_argument(
        "--input-dir",
        action="append",
        default=[],
        help=(
            "Option legacy: dossier d'entree. Peut etre repetee. "
            "Utiliser de preference les arguments positionnels `inputs`."
        ),
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=Path("python/benchmarking/benchmark_results.csv"),
        help="Fichier CSV de sortie.",
    )
    parser.add_argument(
        "--result-dir",
        type=Path,
        default=Path("python/benchmarking/result"),
        help="Dossier de sortie des courbes et tableaux de synthese.",
    )
    parser.add_argument(
        "--generated-mzn-dir",
        type=Path,
        default=Path("python/benchmarking/generated_mzn"),
        help="Dossier cible pour les .mzn generes depuis les .planning.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="Timeout par solveur et par instance (secondes).",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Racine du monorepo (par defaut: detectee automatiquement).",
    )
    parser.add_argument(
        "--skip-backend-build",
        action="store_true",
        help="Ne reconstruit pas le CLI backend avant execution.",
    )
    parser.add_argument(
        "--minizinc-bin",
        type=Path,
        default=None,
        help=(
            "Chemin explicite vers l'executable minizinc a utiliser "
            "(ex: /snap/minizinc/current/bin/minizinc)."
        ),
    )
    parser.add_argument(
        "--include-optaplanner",
        action="store_true",
        help=(
            "Tente d'inclure OptaPlanner dans la liste des solveurs. "
            "Note: OptaPlanner n'est generalement pas un solveur MiniZinc natif."
        ),
    )
    parser.add_argument(
        "--keep-generated",
        action="store_true",
        help="Conserve le dossier generated_mzn (sinon purge/recreation a chaque run).",
    )
    parser.add_argument(
        "--keep-result",
        action="store_true",
        help="Conserve les anciens artefacts result (sinon purge/recreation a chaque run).",
    )
    return parser.parse_args()


def ensure_backend_cli_built(repo_root: Path) -> None:
    print("\n[Backend] Build du CLI planning-spec-cli...")
    cmd = ["pnpm", "--filter", "planning-spec-cli", "build"]
    subprocess.run(cmd, cwd=repo_root, check=True)


def configure_minizinc_binary(minizinc_bin: Optional[Path]) -> None:
    if minizinc_bin is None:
        return

    resolved_bin = minizinc_bin.resolve()
    if not resolved_bin.exists():
        raise FileNotFoundError(f"Executable MiniZinc introuvable: {resolved_bin}")
    if not os.access(resolved_bin, os.X_OK):
        raise PermissionError(f"Executable MiniZinc non executable: {resolved_bin}")

    mzn_dir = str(resolved_bin.parent)
    current_path = os.environ.get("PATH", "")
    path_entries = current_path.split(":") if current_path else []
    if mzn_dir not in path_entries:
        os.environ["PATH"] = f"{mzn_dir}:{current_path}" if current_path else mzn_dir

    print(f"[Env] MiniZinc force via --minizinc-bin: {resolved_bin}")
    probe = subprocess.run(["minizinc", "--version"], capture_output=True, text=True, check=False)
    if probe.returncode == 0:
        first_line = probe.stdout.strip().splitlines()[0] if probe.stdout.strip() else ""
        if first_line:
            print(f"[Env] Version active: {first_line}")

    # Important: minizinc-python garde son propre driver en memoire.
    # On le rebinde explicitement vers le meme binaire MiniZinc.
    if mz is not None:
        driver = mz.Driver.find([mzn_dir], name="minizinc")
        if driver is None:
            raise RuntimeError(
                f"minizinc-python ne trouve pas de driver MiniZinc dans {mzn_dir}"
            )
        mz.default_driver = driver
        print(f"[Env] minizinc-python driver: {mz.default_driver.executable}")


def build_backend_generate_command(repo_root: Path, planning_file: Path, output_dir: Path) -> list[str]:
    cli_entrypoint = repo_root / "backend" / "packages" / "cli" / "bin" / "cli.js"
    return [
        "node",
        str(cli_entrypoint),
        "generate-mzn",
        str(planning_file.resolve()),
        "-d",
        str(output_dir.resolve()),
    ]


def unique_generation_dir(base_output_dir: Path, planning_file: Path) -> Path:
    file_hash = hashlib.sha1(str(planning_file.resolve()).encode("utf-8")).hexdigest()[:10]
    return base_output_dir / f"{planning_file.stem}_{file_hash}"


def generate_mzn_from_planning(repo_root: Path, planning_file: Path, base_output_dir: Path) -> Path:
    output_dir = unique_generation_dir(base_output_dir, planning_file)
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = build_backend_generate_command(repo_root, planning_file, output_dir)

    proc = subprocess.run(cmd, cwd=repo_root, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            "Echec generation MiniZinc\n"
            f"Commande: {' '.join(cmd)}\n"
            f"stdout: {proc.stdout}\n"
            f"stderr: {proc.stderr}"
        )

    expected = output_dir / f"{planning_file.stem}.mzn"
    if expected.exists():
        return expected

    # Fallback: extraction du path si le generateur a choisi un autre chemin.
    merged = f"{proc.stdout}\n{proc.stderr}"
    match = re.search(r"MiniZinc (?:file|code generated successfully):\s*(.+\.mzn)", merged)
    if match:
        parsed = Path(match.group(1).strip())
        if parsed.exists():
            return parsed

    raise RuntimeError(
        "Le backend a termine sans produire de fichier .mzn detectable.\n"
        f"stdout: {proc.stdout}\n"
        f"stderr: {proc.stderr}"
    )


def is_supported_instance_file(path: Path) -> bool:
    return path.suffix.lower() in {".planning", ".mzn"}


def collect_supported_files_from_dir(directory: Path) -> list[Path]:
    planning_files = sorted(directory.rglob("*.planning"))
    mzn_files = sorted(directory.rglob("*.mzn"))
    return planning_files + mzn_files


def resolve_input_paths(raw_inputs: list[str], legacy_input_dirs: list[str]) -> list[Path]:
    targets = [Path(p) for p in raw_inputs] + [Path(p) for p in legacy_input_dirs]
    if not targets:
        raise ValueError(
            "Aucune entree fournie. Passez au moins un fichier, dossier ou motif glob."
        )

    resolved: Dict[str, Path] = {}

    for target in targets:
        target_str = str(target)
        has_glob = any(char in target_str for char in ["*", "?", "["])

        if has_glob:
            for match in sorted(glob.glob(target_str, recursive=True)):
                candidate = Path(match)
                if candidate.is_dir():
                    for file_path in collect_supported_files_from_dir(candidate):
                        resolved[str(file_path.resolve())] = file_path.resolve()
                elif candidate.is_file() and is_supported_instance_file(candidate):
                    resolved[str(candidate.resolve())] = candidate.resolve()
            continue

        if target.is_dir():
            for file_path in collect_supported_files_from_dir(target):
                resolved[str(file_path.resolve())] = file_path.resolve()
            continue

        if target.is_file():
            if is_supported_instance_file(target):
                resolved[str(target.resolve())] = target.resolve()
            else:
                print(f"[Warn] Fichier ignore (extension non supportee): {target}")
            continue

        print(f"[Warn] Entree introuvable, ignoree: {target}")

    return sorted(resolved.values())


def normalize_key(key: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def to_seconds(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, timedelta):
        return float(value.total_seconds())
    if hasattr(value, "total_seconds"):
        return float(value.total_seconds())
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip().lower()
        ms = re.match(r"^([0-9]+(?:\.[0-9]+)?)\s*ms$", text)
        if ms:
            return float(ms.group(1)) / 1000.0
        s = re.match(r"^([0-9]+(?:\.[0-9]+)?)\s*s$", text)
        if s:
            return float(s.group(1))
        try:
            return float(text)
        except ValueError:
            return None
    return None


def extract_stat_seconds(statistics: Dict[Any, Any], aliases: Iterable[str]) -> Optional[float]:
    aliases_norm = {normalize_key(alias) for alias in aliases}
    for key, value in statistics.items():
        if normalize_key(key) in aliases_norm:
            converted = to_seconds(value)
            if converted is not None:
                return converted
    return None


def map_status(result_status: Any, timed_out: bool = False) -> str:
    if timed_out:
        return "TIMEOUT"

    status_name = str(getattr(result_status, "name", result_status)).upper()

    if "OPTIMAL" in status_name:
        return "OPT"
    if "UNSAT" in status_name:
        return "UNSAT"
    if "SAT" in status_name or "ALL_SOLUTIONS" in status_name:
        return "SAT"
    if "UNKNOWN" in status_name:
        return "TIMEOUT"
    return status_name


def resolve_solver(label: str, candidates: list[str]) -> Any:
    last_error: Optional[Exception] = None

    for solver_id in candidates:
        try:
            return mz.Solver.lookup(
                solver_id,
                driver=mz.default_driver,
                refresh=True,
            )
        except Exception as exc:  # pragma: no cover - depend de l'environnement local
            last_error = exc

    raise RuntimeError(f"Solveur introuvable pour {label}. Candidats testes: {candidates}. Erreur: {last_error}")


def resolve_available_solvers(solver_candidates: Dict[str, list[str]]) -> tuple[Dict[str, Any], list[str]]:
    available: Dict[str, Any] = {}
    missing: list[str] = []
    for label, candidates in solver_candidates.items():
        try:
            available[label] = resolve_solver(label, candidates)
        except Exception:
            missing.append(label)
    return available, missing


def is_success_status(status: str) -> bool:
    return status in {"SAT", "UNSAT", "OPT"}


def reset_output_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed):
        return None
    return parsed


def generate_textual_conclusion(
    df_export: Any,
    solver_summary: Any,
    status_by_solver: Any,
    result_dir: Path,
) -> None:
    report_path = result_dir / "analysis_report.md"
    lines: list[str] = []

    total_runs = len(df_export)
    total_instances = int(df_export["Instance"].nunique()) if total_runs > 0 else 0
    lines.append("# Rapport D'analyse Benchmark\n")
    lines.append(f"- Nombre total de runs solveur-instance: **{total_runs}**")
    lines.append(f"- Nombre total d'instances uniques: **{total_instances}**")
    lines.append(f"- Solveurs testes: **{', '.join(solver_summary['Solveur'].tolist()) if len(solver_summary) > 0 else 'Aucun'}**\n")

    lines.append("## Description Des Courbes")
    for filename, description in PLOT_FILES.items():
        path = result_dir / filename
        if path.exists():
            lines.append(f"- `{filename}`: {description}.")
        else:
            lines.append(f"- `{filename}`: non generee (donnees insuffisantes ou non applicables).")

    lines.append("\n## Lecture Synthese")
    if len(solver_summary) == 0:
        lines.append("- Aucun resultat disponible pour l'interpretation.")
        report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return

    summary = solver_summary.copy()
    summary["Median_T_total"] = summary["Median_T_total"].apply(safe_float)
    summary["Success_Rate"] = summary["Success_Rate"].apply(safe_float)
    summary["Timeout_Count"] = summary["Timeout_Count"].fillna(0).astype(int)
    summary["Error_Count"] = summary["Error_Count"].fillna(0).astype(int)

    valid_time = summary.dropna(subset=["Median_T_total"])
    if len(valid_time) > 0:
        best_time = valid_time.sort_values(["Median_T_total", "Mean_T_total"]).iloc[0]
        lines.append(
            f"- Solveur le plus rapide (mediane T_total): **{best_time['Solveur']}** "
            f"avec **{best_time['Median_T_total']:.3f}s**."
        )
    else:
        lines.append("- Temps median indisponible: impossible de conclure sur la vitesse.")

    robust = summary.copy()
    robust["Timeout_Count"] = robust["Timeout_Count"].astype(int)
    robust["Error_Count"] = robust["Error_Count"].astype(int)
    robust["Success_Rate"] = robust["Success_Rate"].fillna(0.0)
    best_robust = robust.sort_values(
        ["Success_Rate", "Timeout_Count", "Error_Count"],
        ascending=[False, True, True],
    ).iloc[0]
    lines.append(
        f"- Solveur le plus robuste: **{best_robust['Solveur']}** "
        f"(success={best_robust['Success_Rate'] * 100:.1f}%, "
        f"timeouts={int(best_robust['Timeout_Count'])}, errors={int(best_robust['Error_Count'])})."
    )

    timeout_total = int((df_export["Statut"] == "TIMEOUT").sum())
    error_total = int(df_export["Statut"].astype(str).str.startswith("ERROR").sum())
    sat_total = int(df_export["Statut"].isin(["SAT", "UNSAT", "OPT"]).sum())
    lines.append(
        f"- Bilan global: **{sat_total}** runs conclusifs, **{timeout_total}** timeouts, **{error_total}** erreurs."
    )

    lines.append("\n## Conclusion Finale")
    lines.append(
        "Le choix recommande doit privilegier d'abord la robustesse "
        "(faible taux de timeout/erreur), puis la vitesse mediane sur T_total."
    )
    if len(valid_time) > 0:
        lines.append(
            f"Sur cette campagne, **{best_robust['Solveur']}** est le plus robuste "
            f"et **{best_time['Solveur']}** est le plus rapide en mediane."
        )
    lines.append(
        "Pour une justification scientifique solide, reproduisez cette analyse "
        "sur plusieurs tailles d'instances et comparez les tendances, pas un seul run."
    )

    if not status_by_solver.empty:
        lines.append("\n## Statuts Par Solveur")
        lines.append("```")
        lines.append(status_by_solver.to_string())
        lines.append("```")

    size_summary_path = result_dir / "size_summary_by_A.csv"
    if size_summary_path.exists():
        try:
            size_df = pd.read_csv(size_summary_path)
            if not size_df.empty:
                lines.append("\n## Analyse Par Taille (A)")
                rank_speed = (
                    size_df.groupby("Solveur")["Median_T_total"]
                    .mean()
                    .sort_values()
                )
                lines.append("- Classement moyen selon A (T_total median):")
                for idx, (solver, value) in enumerate(rank_speed.items(), start=1):
                    lines.append(f"  {idx}. {solver}: {value:.3f}s")
        except Exception:
            pass

    family_summary_path = result_dir / "family_summary.csv"
    if family_summary_path.exists():
        try:
            family_df = pd.read_csv(family_summary_path)
            if not family_df.empty:
                lines.append("\n## Analyse Par Famille")
                for family, group in family_df.groupby("Family"):
                    best = group.sort_values(
                        ["Success_Rate", "Timeout_Rate", "Median_T_total"],
                        ascending=[False, True, True],
                    ).iloc[0]
                    lines.append(
                        f"- **{family}**: meilleur compromis = **{best['Solveur']}** "
                        f"(median T_total={best['Median_T_total']:.3f}s, "
                        f"success={best['Success_Rate'] * 100:.1f}%, "
                        f"OPT={best['OPT_Rate'] * 100:.1f}%)."
                    )
        except Exception:
            pass

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def save_figure(fig: Any, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)


def build_size_analysis_artifacts(df_export: Any, result_dir: Path) -> None:
    # Active seulement si A est renseigne dans les noms d'instances.
    if "A" not in df_export.columns:
        return
    if pd.to_numeric(df_export["A"], errors="coerce").fillna(0).max() <= 0:
        return

    df_size = df_export.copy()
    df_size["A"] = pd.to_numeric(df_size["A"], errors="coerce")
    df_size["T_total"] = pd.to_numeric(df_size["T_total"], errors="coerce")
    df_size["T_solve"] = pd.to_numeric(df_size["T_solve"], errors="coerce")
    df_size = df_size.dropna(subset=["A"])
    if df_size.empty:
        return

    size_summary = (
        df_size.groupby(["Solveur", "A"], dropna=False)
        .agg(
            Runs=("Instance", "count"),
            Median_T_total=("T_total", "median"),
            Mean_T_total=("T_total", "mean"),
            Median_T_solve=("T_solve", "median"),
            Mean_T_solve=("T_solve", "mean"),
            Success_Rate=("Statut", lambda s: float(s.isin(["SAT", "UNSAT", "OPT"]).mean())),
        )
        .reset_index()
        .sort_values(["Solveur", "A"])
    )
    size_summary.to_csv(result_dir / "size_summary_by_A.csv", index=False)

    if plt is None:
        return

    # Courbe mediane T_total en fonction de A.
    fig, ax = plt.subplots(figsize=(11, 6))
    plotted = False
    for solver, group in size_summary.groupby("Solveur"):
        g = group.sort_values("A")
        if len(g) == 0:
            continue
        ax.plot(g["A"], g["Median_T_total"], marker="o", label=solver)
        plotted = True
    if plotted:
        ax.set_title("T_total median en fonction de A")
        ax.set_xlabel("A (nombre d'activites)")
        ax.set_ylabel("Temps total median (s)")
        ax.legend()
        save_figure(fig, result_dir / "curve_07_ttotal_vs_A.png")
    else:
        plt.close(fig)

    # Courbe mediane T_solve en fonction de A.
    fig, ax = plt.subplots(figsize=(11, 6))
    plotted = False
    for solver, group in size_summary.groupby("Solveur"):
        g = group.sort_values("A")
        if len(g) == 0:
            continue
        ax.plot(g["A"], g["Median_T_solve"], marker="o", label=solver)
        plotted = True
    if plotted:
        ax.set_title("T_solve median en fonction de A")
        ax.set_xlabel("A (nombre d'activites)")
        ax.set_ylabel("Temps solve median (s)")
        ax.legend()
        save_figure(fig, result_dir / "curve_08_tsolve_vs_A.png")
    else:
        plt.close(fig)

    # Taux de succes selon A.
    fig, ax = plt.subplots(figsize=(11, 6))
    plotted = False
    for solver, group in size_summary.groupby("Solveur"):
        g = group.sort_values("A")
        if len(g) == 0:
            continue
        ax.plot(g["A"], g["Success_Rate"] * 100.0, marker="o", label=solver)
        plotted = True
    if plotted:
        ax.set_title("Taux de succes en fonction de A")
        ax.set_xlabel("A (nombre d'activites)")
        ax.set_ylabel("Success rate (%)")
        ax.set_ylim(0, 100)
        ax.legend()
        save_figure(fig, result_dir / "curve_09_success_rate_vs_A.png")
    else:
        plt.close(fig)


def build_family_analysis_artifacts(df_export: Any, result_dir: Path) -> None:
    if "Family" not in df_export.columns:
        return

    df_family = df_export.copy()
    df_family["Family"] = df_family["Family"].fillna("unknown").astype(str)
    if df_family["Family"].nunique() <= 1 and df_family["Family"].iloc[0] == "unknown":
        return

    df_family["T_total"] = pd.to_numeric(df_family["T_total"], errors="coerce")
    df_family["T_solve"] = pd.to_numeric(df_family["T_solve"], errors="coerce")
    df_family["Statut"] = df_family["Statut"].astype(str)

    family_summary = (
        df_family.groupby(["Family", "Solveur"], dropna=False)
        .agg(
            Runs=("Instance", "count"),
            Mean_T_total=("T_total", "mean"),
            Median_T_total=("T_total", "median"),
            Q1_T_total=("T_total", lambda s: s.quantile(0.25)),
            Q3_T_total=("T_total", lambda s: s.quantile(0.75)),
            Mean_T_solve=("T_solve", "mean"),
            Median_T_solve=("T_solve", "median"),
            Success_Rate=("Statut", lambda s: float(s.isin(["SAT", "UNSAT", "OPT"]).mean())),
            OPT_Rate=("Statut", lambda s: float((s == "OPT").mean())),
            Timeout_Rate=("Statut", lambda s: float((s == "TIMEOUT").mean())),
            Error_Rate=("Statut", lambda s: float(s.str.startswith("ERROR").mean())),
        )
        .reset_index()
        .sort_values(["Family", "Median_T_total", "Solveur"])
    )
    family_summary.to_csv(result_dir / "family_summary.csv", index=False)

    # Classement par famille: utile directement dans le rapport.
    family_ranking = family_summary.sort_values(
        ["Family", "Success_Rate", "Timeout_Rate", "Median_T_total"],
        ascending=[True, False, True, True],
    )
    family_ranking.to_csv(result_dir / "family_ranking.csv", index=False)

    if plt is None:
        return

    # Median T_total par famille et solveur.
    pivot = family_summary.pivot(index="Family", columns="Solveur", values="Median_T_total")
    if not pivot.empty:
        fig, ax = plt.subplots(figsize=(13, 6))
        pivot.plot(kind="bar", ax=ax)
        ax.set_title("T_total median par famille de probleme")
        ax.set_xlabel("Famille")
        ax.set_ylabel("Temps total median (s)")
        ax.tick_params(axis="x", rotation=25)
        ax.legend(title="Solveur")
        save_figure(fig, result_dir / "curve_10_median_ttotal_by_family.png")

    # Taux OPT par famille et solveur. Les familles SAT resteront naturellement a 0.
    pivot_opt = family_summary.pivot(index="Family", columns="Solveur", values="OPT_Rate") * 100.0
    if not pivot_opt.empty:
        fig, ax = plt.subplots(figsize=(13, 6))
        pivot_opt.plot(kind="bar", ax=ax)
        ax.set_title("Taux de preuve OPT par famille")
        ax.set_xlabel("Famille")
        ax.set_ylabel("OPT rate (%)")
        ax.set_ylim(0, 100)
        ax.tick_params(axis="x", rotation=25)
        ax.legend(title="Solveur")
        save_figure(fig, result_dir / "curve_11_opt_rate_by_family.png")


def build_result_artifacts(df: Any, result_dir: Path) -> None:
    result_dir.mkdir(parents=True, exist_ok=True)

    df_export = df.copy()
    for col in ["T_flat", "T_solve", "T_total"]:
        df_export[col] = pd.to_numeric(df_export[col], errors="coerce")

    benchmark_csv = result_dir / "benchmark_results.csv"
    df_export.to_csv(benchmark_csv, index=False)

    status_by_solver = (
        df_export.groupby(["Solveur", "Statut"])
        .size()
        .unstack(fill_value=0)
        .sort_index()
    )
    status_by_solver.to_csv(result_dir / "status_by_solver.csv")

    solver_summary = (
        df_export.groupby("Solveur", dropna=False)
        .agg(
            Runs=("Instance", "count"),
            Mean_T_flat=("T_flat", "mean"),
            Median_T_flat=("T_flat", "median"),
            Mean_T_solve=("T_solve", "mean"),
            Median_T_solve=("T_solve", "median"),
            Mean_T_total=("T_total", "mean"),
            Median_T_total=("T_total", "median"),
            Q1_T_total=("T_total", lambda s: s.quantile(0.25)),
            Q3_T_total=("T_total", lambda s: s.quantile(0.75)),
            Min_T_total=("T_total", "min"),
            Max_T_total=("T_total", "max"),
        )
        .reset_index()
    )
    solver_summary["Timeout_Count"] = (
        df_export[df_export["Statut"] == "TIMEOUT"]
        .groupby("Solveur")["Instance"]
        .count()
        .reindex(solver_summary["Solveur"])
        .fillna(0)
        .astype(int)
        .to_numpy()
    )
    solver_summary["Error_Count"] = (
        df_export[df_export["Statut"].str.startswith("ERROR", na=False)]
        .groupby("Solveur")["Instance"]
        .count()
        .reindex(solver_summary["Solveur"])
        .fillna(0)
        .astype(int)
        .to_numpy()
    )
    solver_summary["Success_Count"] = (
        df_export[df_export["Statut"].isin(["SAT", "UNSAT", "OPT"])]
        .groupby("Solveur")["Instance"]
        .count()
        .reindex(solver_summary["Solveur"])
        .fillna(0)
        .astype(int)
        .to_numpy()
    )
    solver_summary["Success_Rate"] = solver_summary["Success_Count"] / solver_summary["Runs"]
    solver_summary["OPT_Count"] = (
        df_export[df_export["Statut"] == "OPT"]
        .groupby("Solveur")["Instance"]
        .count()
        .reindex(solver_summary["Solveur"])
        .fillna(0)
        .astype(int)
        .to_numpy()
    )
    solver_summary["OPT_Rate"] = solver_summary["OPT_Count"] / solver_summary["Runs"]
    solver_summary.to_csv(result_dir / "solver_summary.csv", index=False)

    if plt is None:
        print("[Warn] matplotlib indisponible: courbes non generees.")
        generate_textual_conclusion(df_export, solver_summary, status_by_solver, result_dir)
        return

    # 1) Distribution des temps totaux par solveur.
    fig, ax = plt.subplots(figsize=(11, 6))
    by_solver_total = [
        pd.to_numeric(group["T_total"], errors="coerce").dropna().tolist()
        for _, group in df_export.groupby("Solveur")
    ]
    labels_total = [solver for solver, _ in df_export.groupby("Solveur")]
    if any(len(v) > 0 for v in by_solver_total):
        ax.boxplot(by_solver_total, tick_labels=labels_total, vert=True, patch_artist=True)
        ax.set_title("Distribution de T_total par solveur")
        ax.set_ylabel("Temps total (secondes)")
        ax.tick_params(axis="x", rotation=20)
        save_figure(fig, result_dir / "curve_01_boxplot_t_total.png")
    else:
        plt.close(fig)

    # 2) Distribution des temps de solve par solveur.
    fig, ax = plt.subplots(figsize=(11, 6))
    by_solver_solve = [
        pd.to_numeric(group["T_solve"], errors="coerce").dropna().tolist()
        for _, group in df_export.groupby("Solveur")
    ]
    labels_solve = [solver for solver, _ in df_export.groupby("Solveur")]
    if any(len(v) > 0 for v in by_solver_solve):
        ax.boxplot(by_solver_solve, tick_labels=labels_solve, vert=True, patch_artist=True)
        ax.set_title("Distribution de T_solve par solveur")
        ax.set_ylabel("Temps de resolution (secondes)")
        ax.tick_params(axis="x", rotation=20)
        save_figure(fig, result_dir / "curve_02_boxplot_t_solve.png")
    else:
        plt.close(fig)

    # 3) Moyennes des temps (flat, solve, total).
    fig, ax = plt.subplots(figsize=(12, 6))
    summary_plot = solver_summary.copy()
    x = range(len(summary_plot))
    width = 0.25
    ax.bar([i - width for i in x], summary_plot["Mean_T_flat"], width=width, label="Mean T_flat")
    ax.bar(x, summary_plot["Mean_T_solve"], width=width, label="Mean T_solve")
    ax.bar([i + width for i in x], summary_plot["Mean_T_total"], width=width, label="Mean T_total")
    ax.set_xticks(list(x))
    ax.set_xticklabels(summary_plot["Solveur"], rotation=20)
    ax.set_ylabel("Temps (secondes)")
    ax.set_title("Comparaison des temps moyens par solveur")
    ax.legend()
    save_figure(fig, result_dir / "curve_03_mean_times.png")

    # 4) Repartition des statuts par solveur.
    fig, ax = plt.subplots(figsize=(12, 6))
    status_plot = status_by_solver.copy()
    bottom = [0] * len(status_plot.index)
    for status_col in status_plot.columns:
        values = status_plot[status_col].tolist()
        ax.bar(status_plot.index.tolist(), values, bottom=bottom, label=status_col)
        bottom = [b + v for b, v in zip(bottom, values)]
    ax.set_title("Repartition des statuts par solveur")
    ax.set_ylabel("Nombre d'instances")
    ax.tick_params(axis="x", rotation=20)
    ax.legend()
    save_figure(fig, result_dir / "curve_04_status_stacked.png")

    # 5) Taux de succes et timeout.
    fig, ax = plt.subplots(figsize=(11, 6))
    success_percent = (solver_summary["Success_Rate"] * 100.0).fillna(0.0)
    timeout_percent = (solver_summary["Timeout_Count"] / solver_summary["Runs"] * 100.0).fillna(0.0)
    idx = range(len(solver_summary))
    bar_width = 0.4
    ax.bar([i - bar_width / 2 for i in idx], success_percent, width=bar_width, label="Success %")
    ax.bar([i + bar_width / 2 for i in idx], timeout_percent, width=bar_width, label="Timeout %")
    ax.set_xticks(list(idx))
    ax.set_xticklabels(solver_summary["Solveur"], rotation=20)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Pourcentage")
    ax.set_title("Robustesse: taux de succes vs timeout")
    ax.legend()
    save_figure(fig, result_dir / "curve_05_success_timeout_rates.png")

    # 6) Cactus plot sur T_total pour statuts reussis.
    fig, ax = plt.subplots(figsize=(11, 6))
    plotted = False
    for solver_name, group in df_export.groupby("Solveur"):
        successful = group[group["Statut"].apply(lambda s: is_success_status(str(s)))]
        times = pd.to_numeric(successful["T_total"], errors="coerce").dropna().sort_values().tolist()
        if not times:
            continue
        x_vals = list(range(1, len(times) + 1))
        ax.step(x_vals, times, where="post", label=solver_name)
        plotted = True

    if plotted:
        ax.set_title("Cactus plot (T_total, instances resolues)")
        ax.set_xlabel("Nombre d'instances resolues")
        ax.set_ylabel("Temps total (secondes)")
        ax.legend()
        save_figure(fig, result_dir / "curve_06_cactus_t_total.png")
    else:
        plt.close(fig)

    build_size_analysis_artifacts(df_export, result_dir)
    build_family_analysis_artifacts(df_export, result_dir)
    generate_textual_conclusion(df_export, solver_summary, status_by_solver, result_dir)


async def solve_with_solver(
    mzn_path: Path,
    solver_label: str,
    solver: Any,
    timeout_seconds: int,
    dzn_path: Optional[Path] = None,
) -> RunResult:
    model = mz.Model(str(mzn_path))
    if dzn_path is not None and dzn_path.exists():
        model.add_file(str(dzn_path))
    instance = mz.Instance(solver, model)

    start = time.perf_counter()
    timed_out = False

    try:
        result = await asyncio.wait_for(
            instance.solve_async(timeout=timedelta(seconds=timeout_seconds)),
            timeout=timeout_seconds + 5,
        )
    except asyncio.TimeoutError:
        timed_out = True
        elapsed = time.perf_counter() - start
        return RunResult(t_flat=None, t_solve=None, t_total=elapsed, status="TIMEOUT")
    except Exception as exc:
        elapsed = time.perf_counter() - start
        return RunResult(t_flat=None, t_solve=None, t_total=elapsed, status=f"ERROR: {exc}")

    elapsed = time.perf_counter() - start
    stats = dict(result.statistics or {})

    t_flat = extract_stat_seconds(
        stats,
        aliases=[
            "flatTime",
            "flattenTime",
            "flat_time",
            "timeFlattening",
        ],
    )
    t_solve = extract_stat_seconds(
        stats,
        aliases=[
            "solveTime",
            "solve_time",
            "time",
            "searchTime",
        ],
    )

    return RunResult(
        t_flat=t_flat,
        t_solve=t_solve,
        t_total=elapsed,
        status=map_status(result.status, timed_out=timed_out),
    )


async def run_benchmark(args: argparse.Namespace) -> None:
    output_csv: Path = args.output_csv.resolve()
    result_dir: Path = args.result_dir.resolve()
    generated_mzn_dir: Path = args.generated_mzn_dir.resolve()
    repo_root: Path = args.repo_root.resolve()

    configure_minizinc_binary(args.minizinc_bin)

    if args.keep_generated:
        generated_mzn_dir.mkdir(parents=True, exist_ok=True)
    else:
        print(f"[Clean] Regeneration complete du dossier generated: {generated_mzn_dir}")
        reset_output_dir(generated_mzn_dir)

    if args.keep_result:
        result_dir.mkdir(parents=True, exist_ok=True)
    else:
        print(f"[Clean] Regeneration complete du dossier result: {result_dir}")
        reset_output_dir(result_dir)

    if not args.skip_backend_build:
        ensure_backend_cli_built(repo_root)

    instances = resolve_input_paths(args.inputs, args.input_dir)
    if not instances:
        print("Aucune instance .planning/.mzn trouvee.")
        return

    required_solvers = dict(SOLVER_CANDIDATES)
    available_solvers, missing_required = resolve_available_solvers(required_solvers)
    if missing_required:
        raise RuntimeError(
            "Solveurs requis indisponibles: "
            + ", ".join(missing_required)
            + ". Le benchmark exige les solveurs: "
            + ", ".join(required_solvers.keys())
            + ". Verifiez --minizinc-bin et votre installation MiniZinc."
        )

    if args.include_optaplanner:
        opta_available, opta_missing = resolve_available_solvers(OPTAPLANNER_CANDIDATES)
        if opta_missing:
            print(
                "[Warn] OptaPlanner indisponible (optionnel): "
                + ", ".join(opta_missing)
            )
        available_solvers.update(opta_available)

    print(f"\nInstances detectees: {len(instances)}")
    print(f"Solveurs utilises: {', '.join(available_solvers.keys())}")
    rows = []

    for instance_path in instances:
        print(f"\n=== Instance: {instance_path.name} ===")
        dzn_path: Optional[Path] = None

        try:
            if instance_path.suffix == ".planning":
                print(f"[Backend] Generation MiniZinc pour {instance_path.name}... [En cours]")
                mzn_path = generate_mzn_from_planning(repo_root, instance_path, generated_mzn_dir)
                print(f"[Backend] MiniZinc genere: {mzn_path}")
            else:
                mzn_path = instance_path
                sibling_dzn = instance_path.with_suffix(".dzn")
                if sibling_dzn.exists():
                    dzn_path = sibling_dzn
                    print(f"[Info] Fichier .dzn associe detecte: {dzn_path.name}")
        except Exception as exc:
            print(f"[Erreur] Echec backend pour {instance_path.name}: {exc}")
            continue

        a, r, k, t = extract_params(instance_path.name)
        family = extract_family(instance_path.name)

        for solver_label, solver in available_solvers.items():
            print(f"Traitement de {mzn_path.name} avec {solver_label}... [En cours]")
            result = await solve_with_solver(
                mzn_path,
                solver_label,
                solver,
                args.timeout,
                dzn_path=dzn_path,
            )
            print(
                f"Traitement de {mzn_path.name} avec {solver_label}... "
                f"[Termine: {result.status}]"
            )

            rows.append(
                {
                    "Instance": mzn_path.name,
                    "Family": family,
                    "A": a,
                    "R": r,
                    "K": k,
                    "T": t,
                    "Solveur": solver_label,
                    "T_flat": result.t_flat,
                    "T_solve": result.t_solve,
                    "T_total": result.t_total,
                    "Statut": result.status,
                }
            )

    df = pd.DataFrame(rows, columns=CSV_COLUMNS)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    if output_csv.exists() and not args.keep_result:
        output_csv.unlink()
    df.to_csv(output_csv, index=False)
    build_result_artifacts(df, result_dir)
    print(f"\nBenchmark termine. Resultats exportes dans: {output_csv}")
    print(f"Artefacts (courbes + syntheses) exportes dans: {result_dir}")


def main() -> int:
    args = parse_args()
    if mz is None or pd is None:
        missing_libs = []
        if mz is None:
            missing_libs.append("minizinc")
        if pd is None:
            missing_libs.append("pandas")
        print(
            "Dependances Python manquantes: "
            + ", ".join(missing_libs)
            + ". Installez-les avec: pip install -r python/benchmarking/requirements.txt",
            file=sys.stderr,
        )
        return 2

    if plt is None:
        print(
            "[Warn] matplotlib non installe: les courbes seront sautees. "
            "Installez avec: pip install matplotlib",
            file=sys.stderr,
        )

    try:
        asyncio.run(run_benchmark(args))
        return 0
    except KeyboardInterrupt:
        print("\nInterruption utilisateur.")
        return 130
    except Exception as exc:
        print(f"\nErreur fatale: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
