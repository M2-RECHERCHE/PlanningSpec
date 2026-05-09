#!/usr/bin/env python3
"""Generateur d'instances .planning parametrees pour benchmark de soutenances.

Objectif recherche:
- produire deux familles d'instances separees: satisfaction et optimisation;
- garder des tailles compatibles avec des campagnes plafonnees a 5 minutes;
- encoder A/R/K/T et la famille dans le nom de fichier pour l'analyse CSV.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Iterable, List


SUPPORTED_FAMILIES = [
    "satisfaction",
    "optimisation",
]


@dataclass(frozen=True)
class InstanceSize:
    A: int
    R: int
    K: int
    T: int


@dataclass(frozen=True)
class FamilyProfile:
    name: str
    description: str
    preferences: str
    fixed_jury_ratio: float
    time_window_ratio: float
    time_window_width: int
    precedence_ratio: float
    forbidden_ratio: float
    room_tightness: str


@dataclass(frozen=True)
class DifficultyMetadata:
    label: str
    fixed_jury_ratio: float
    time_window_ratio: float
    time_window_width: int
    precedence_ratio: float
    forbidden_ratio: float
    room_tightness: str


FAMILY_PROFILES: dict[str, FamilyProfile] = {
    "satisfaction": FamilyProfile(
        name="satisfaction",
        description="Probleme de satisfaction simple: contraintes de base sans fonction objectif.",
        preferences="none",
        fixed_jury_ratio=0.50,
        time_window_ratio=0.00,
        time_window_width=0,
        precedence_ratio=0.00,
        forbidden_ratio=0.00,
        room_tightness="medium",
    ),
    "optimisation": FamilyProfile(
        name="optimisation",
        description="Probleme d'optimisation simple: contraintes de base avec quelques preferences a minimiser.",
        preferences="light",
        fixed_jury_ratio=0.50,
        time_window_ratio=0.00,
        time_window_width=0,
        precedence_ratio=0.00,
        forbidden_ratio=0.00,
        room_tightness="medium",
    ),
}


def parse_int_list(value: str) -> List[int]:
    items = [x.strip() for x in value.split(",") if x.strip()]
    if not items:
        raise ValueError("Liste vide")
    out = [int(x) for x in items]
    if any(v <= 0 for v in out):
        raise ValueError("Toutes les valeurs doivent etre > 0")
    return out


def parse_family_list(value: str) -> List[str]:
    if value.strip().lower() == "all":
        return list(SUPPORTED_FAMILIES)
    families = [x.strip() for x in value.split(",") if x.strip()]
    unknown = [x for x in families if x not in FAMILY_PROFILES]
    if unknown:
        raise ValueError(
            "Familles inconnues: "
            + ", ".join(unknown)
            + ". Valeurs supportees: all, "
            + ", ".join(SUPPORTED_FAMILIES)
        )
    return families


def materialize_sizes(
    a_list: List[int],
    r_list: List[int],
    k_list: List[int],
    t_list: List[int],
    mode: str,
) -> List[InstanceSize]:
    if mode == "grid":
        return [InstanceSize(a, r, k, t) for a in a_list for r in r_list for k in k_list for t in t_list]

    max_len = max(len(a_list), len(r_list), len(k_list), len(t_list))

    def value_at(lst: List[int], i: int) -> int:
        return lst[i] if i < len(lst) else lst[-1]

    return [InstanceSize(value_at(a_list, i), value_at(r_list, i), value_at(k_list, i), value_at(t_list, i)) for i in range(max_len)]


def preset_sizes(name: str) -> List[InstanceSize]:
    """Tailles conservatrices pour campagnes bornees a 5 minutes.

    Les tailles restent volontairement modestes car la formulation actuelle
    contient des variables role_assignment[A, ROLE, RESOURCE] et des contraintes
    de non-chevauchement paire-a-paire.
    """
    if name == "quick":
        return [
            InstanceSize(3, 9, 2, 3),
            InstanceSize(4, 12, 2, 4),
        ]
    if name == "research-3min":
        return [
            InstanceSize(3, 9, 2, 3),
            InstanceSize(4, 12, 2, 4),
            InstanceSize(5, 15, 3, 4),
            InstanceSize(6, 18, 3, 5),
            InstanceSize(8, 24, 4, 5),
        ]
    if name == "extended-3min":
        return [
            InstanceSize(3, 9, 2, 3),
            InstanceSize(4, 12, 2, 4),
            InstanceSize(5, 15, 3, 4),
            InstanceSize(6, 18, 3, 5),
            InstanceSize(8, 24, 4, 5),
            InstanceSize(10, 30, 4, 6),
        ]
    if name == "research-5min":
        return [
            InstanceSize(3, 9, 2, 3),
            InstanceSize(4, 12, 2, 4),
            InstanceSize(5, 15, 3, 4),
            InstanceSize(6, 18, 3, 5),
            InstanceSize(8, 24, 4, 5),
            InstanceSize(10, 30, 4, 6),
            InstanceSize(15, 45, 5, 7),
            InstanceSize(20, 60, 6, 8),
        ]
    raise ValueError("Preset inconnu: " + name)


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def difficulty_for_size(size: InstanceSize) -> DifficultyMetadata:
    """Augmente legerement la difficulte avec la taille, sans viser l'infaisable."""
    if size.A >= 20:
        return DifficultyMetadata(
            label="renforcee",
            fixed_jury_ratio=0.35,
            time_window_ratio=0.20,
            time_window_width=min(size.T, 4),
            precedence_ratio=0.20,
            forbidden_ratio=0.10,
            room_tightness="tight",
        )
    if size.A >= 15:
        return DifficultyMetadata(
            label="intermediaire",
            fixed_jury_ratio=0.40,
            time_window_ratio=0.15,
            time_window_width=min(size.T, 4),
            precedence_ratio=0.15,
            forbidden_ratio=0.08,
            room_tightness="tight",
        )
    if size.A >= 10:
        return DifficultyMetadata(
            label="legerement_renforcee",
            fixed_jury_ratio=0.45,
            time_window_ratio=0.10,
            time_window_width=min(size.T, 3),
            precedence_ratio=0.10,
            forbidden_ratio=0.05,
            room_tightness="medium",
        )
    return DifficultyMetadata(
        label="simple",
        fixed_jury_ratio=0.50,
        time_window_ratio=0.00,
        time_window_width=0,
        precedence_ratio=0.00,
        forbidden_ratio=0.00,
        room_tightness="medium",
    )


def effective_profile(family: str, size: InstanceSize) -> tuple[FamilyProfile, DifficultyMetadata]:
    base = FAMILY_PROFILES[family]
    difficulty = difficulty_for_size(size)
    preferences = base.preferences
    if family == "optimisation" and size.A >= 15:
        preferences = "medium"
    profile = replace(
        base,
        preferences=preferences,
        fixed_jury_ratio=difficulty.fixed_jury_ratio,
        time_window_ratio=difficulty.time_window_ratio,
        time_window_width=difficulty.time_window_width,
        precedence_ratio=difficulty.precedence_ratio,
        forbidden_ratio=difficulty.forbidden_ratio,
        room_tightness=difficulty.room_tightness,
    )
    return profile, difficulty


def teacher_for_slot(index: int, role_offset: int, teachers: list[str], used: set[str]) -> str:
    """Retourne un enseignant distinct des autres roles de la meme soutenance."""
    for step in range(len(teachers)):
        candidate = teachers[(index * 3 + role_offset + step) % len(teachers)]
        if candidate not in used:
            used.add(candidate)
            return candidate
    # Ne devrait arriver que pour des instances invalides avec moins de 3 enseignants.
    candidate = teachers[(index + role_offset) % len(teachers)]
    used.add(candidate)
    return candidate


def add_base_constraints(constraints: list[dict]) -> None:
    constraints.extend(
        [
            {"type": "mandatory_roles", "activity": "Soutenance"},
            {"type": "cardinality_per_activity", "activity": "Soutenance", "role": "President", "min": 1, "max": 1},
            {"type": "cardinality_per_activity", "activity": "Soutenance", "role": "Rapporteur", "min": 1, "max": 1},
            {"type": "cardinality_per_activity", "activity": "Soutenance", "role": "Membre", "min": 1, "max": 1},
            {"type": "cardinality_per_activity", "activity": "Soutenance", "role": "Salle", "min": 1, "max": 1},
            {"type": "cardinality_per_activity", "activity": "Soutenance", "role": "Candidat", "min": 1, "max": 1},
            {"type": "resource_exclusivity", "resourceType": "Teacher", "activity": "Soutenance", "scope": "slot", "max": 1},
            {"type": "resource_exclusivity", "resourceType": "Room", "activity": "Soutenance", "scope": "slot", "max": 1},
            {"type": "resource_exclusivity", "resourceType": "Student", "activity": "Soutenance", "scope": "slot", "max": 1},
        ]
    )


def add_candidate_constraints(constraints: list[dict], A: int) -> None:
    for i in range(1, A + 1):
        constraints.append(
            {
                "type": "fixed_assignment",
                "activityInstance": f"Soutenance_{i}",
                "role": "Candidat",
                "resource": f"Student_{i}",
            }
        )


def add_fixed_jury_constraints(
    constraints: list[dict],
    A: int,
    teachers: list[str],
    ratio: float,
    seed: int,
) -> set[tuple[int, str, str]]:
    count = clamp(round(A * ratio), 0, A)
    rng = random.Random(seed + 101)
    instances = list(range(1, A + 1))
    rng.shuffle(instances)
    protected: set[tuple[int, str, str]] = set()

    for pos, i in enumerate(sorted(instances[:count])):
        used: set[str] = set()
        p = teacher_for_slot(pos, 0, teachers, used)
        r = teacher_for_slot(pos, 1, teachers, used)
        m = teacher_for_slot(pos, 2, teachers, used)
        constraints.append({"type": "fixed_assignment", "activityInstance": f"Soutenance_{i}", "role": "President", "resource": p})
        constraints.append({"type": "fixed_assignment", "activityInstance": f"Soutenance_{i}", "role": "Rapporteur", "resource": r})
        constraints.append({"type": "fixed_assignment", "activityInstance": f"Soutenance_{i}", "role": "Membre", "resource": m})
        protected.add((i, "President", p))
        protected.add((i, "Rapporteur", r))
        protected.add((i, "Membre", m))
    return protected


def add_precedence_constraints(constraints: list[dict], A: int, ratio: float) -> int:
    count = clamp(round((A - 1) * ratio), 0, max(0, A - 1))
    for i in range(1, count + 1):
        constraints.append(
            {
                "type": "instance_precedence",
                "beforeActivityInstance": f"Soutenance_{i}",
                "afterActivityInstance": f"Soutenance_{i + 1}",
            }
        )
    return count


def add_time_windows(
    constraints: list[dict],
    A: int,
    total_slots: int,
    ratio: float,
    width: int,
    seed: int,
) -> int:
    count = clamp(round(A * ratio), 0, A)
    rng = random.Random(seed + 203)
    instances = list(range(1, A + 1))
    rng.shuffle(instances)

    for rank, i in enumerate(sorted(instances[:count])):
        # Centre deterministe repartissant les fenetres dans l'horizon.
        center = 1 + ((rank * max(1, total_slots // max(1, count))) % total_slots)
        min_slot = clamp(center - width // 2, 1, total_slots)
        max_slot = clamp(min_slot + width - 1, min_slot, total_slots)
        if max_slot - min_slot + 1 < width:
            min_slot = clamp(max_slot - width + 1, 1, max_slot)
        constraints.append(
            {
                "type": "time_window",
                "activityInstance": f"Soutenance_{i}",
                "minSlot": min_slot,
                "maxSlot": max_slot,
            }
        )
    return count


def add_forbidden_constraints(
    constraints: list[dict],
    A: int,
    teachers: list[str],
    ratio: float,
    seed: int,
    protected: set[tuple[int, str, str]],
) -> int:
    count = clamp(round(A * 3 * ratio), 0, A * 3)
    roles = ["President", "Rapporteur", "Membre"]
    rng = random.Random(seed + 307)
    for n in range(count):
        activity_idx = 1 + (n % A)
        role = roles[n % len(roles)]
        teacher_idx = (n * 5 + rng.randrange(len(teachers))) % len(teachers)
        teacher = teachers[teacher_idx]
        for step in range(len(teachers)):
            candidate = teachers[(teacher_idx + step) % len(teachers)]
            if (activity_idx, role, candidate) not in protected:
                teacher = candidate
                break
        constraints.append(
            {
                "type": "forbidden_assignment",
                "activityInstance": f"Soutenance_{activity_idx}",
                "role": role,
                "resource": teacher,
            }
        )
    return count


def add_preferences(
    preferences: list[dict],
    profile: FamilyProfile,
    A: int,
    R: int,
    K: int,
    days: list[str],
) -> int:
    if profile.preferences == "none":
        return 0

    start_len = len(preferences)
    if profile.preferences == "light":
        avoid_count = 1
        preferred_count = min(A, K, 2)
        avoid_weight = 4
        preferred_weight = 3
    elif profile.preferences == "medium":
        avoid_count = min(R, 2)
        preferred_count = min(A, K, 3)
        avoid_weight = 5
        preferred_weight = 4
    else:
        avoid_count = min(R, 4)
        preferred_count = min(A, K, A)
        avoid_weight = 6
        preferred_weight = 5

    for i in range(1, avoid_count + 1):
        preferences.append(
            {
                "type": "avoid_participation_on_date",
                "resource": f"Teacher_{i}",
                "date": days[(i - 1) % len(days)],
                "weight": avoid_weight,
            }
        )

    for i in range(1, preferred_count + 1):
        preferences.append(
            {
                "type": "preferred_resource",
                "activityInstance": f"Soutenance_{i}",
                "role": "Salle",
                "resource": f"Room_{((i - 1) % K) + 1}",
                "weight": preferred_weight,
            }
        )

    if profile.preferences in {"medium", "dense"}:
        preferences.append(
            {
                "type": "max_per_scope",
                "resourceType": "Teacher",
                "activity": "Soutenance",
                "scope": "day",
                "max": max(1, A // max(2, R // 4)),
                "weight": 4,
            }
        )

    if profile.preferences == "dense":
        preferences.append(
            {
                "type": "room_stability_for_role",
                "activity": "Soutenance",
                "role": "President",
                "roomResourceType": "Room",
                "scope": "day",
                "weight": 3,
            }
        )
        preferences.append(
            {
                "type": "compact_schedule_for_role",
                "activity": "Soutenance",
                "role": "President",
                "scope": "day",
                "weight": 3,
            }
        )

    return len(preferences) - start_len


def build_instance(
    A: int,
    R: int,
    K: int,
    T: int,
    family: str = "optimisation",
    seed: int = 1,
) -> dict:
    if family not in FAMILY_PROFILES:
        raise ValueError("Famille inconnue: " + family)
    if R < 3:
        raise ValueError("R doit etre >= 3 pour pouvoir former un jury de trois enseignants.")
    if K < 1:
        raise ValueError("K doit etre >= 1.")

    size = InstanceSize(A, R, K, T)
    profile, _ = effective_profile(family, size)
    days = ["Jour_1", "Jour_2"]
    total_slots = len(days) * T

    teachers = [f"Teacher_{i}" for i in range(1, R + 1)]
    rooms = [f"Room_{i}" for i in range(1, K + 1)]
    students = [f"Student_{i}" for i in range(1, A + 1)]

    constraints: list[dict] = []
    preferences: list[dict] = []
    add_base_constraints(constraints)
    add_candidate_constraints(constraints, A)
    fixed_jury = add_fixed_jury_constraints(constraints, A, teachers, profile.fixed_jury_ratio, seed)
    add_precedence_constraints(constraints, A, profile.precedence_ratio)
    add_time_windows(constraints, A, total_slots, profile.time_window_ratio, profile.time_window_width, seed)
    add_forbidden_constraints(constraints, A, teachers, profile.forbidden_ratio, seed, fixed_jury)
    add_preferences(preferences, profile, A, R, K, days)

    if profile.room_tightness == "tight":
        # Fixe certaines salles pour reduire la symetrie et rendre les instances
        # tendues sans les rendre volontairement infaisables.
        fixed_rooms = clamp(A // 3, 1, A)
        for i in range(1, fixed_rooms + 1):
            constraints.append(
                {
                    "type": "fixed_assignment",
                    "activityInstance": f"Soutenance_{i}",
                    "role": "Salle",
                    "resource": f"Room_{((i - 1) % K) + 1}",
                }
            )

    return {
        "time": {
            "days": days,
            "slotsPerDay": T,
        },
        "activities": {
            "Soutenance": {
                "count": A,
                "duration": 1,
            }
        },
        "resources": {
            "Teacher": teachers,
            "Room": rooms,
            "Student": students,
        },
        "roles": {
            "Soutenance": {
                "President": "Teacher",
                "Rapporteur": "Teacher",
                "Membre": "Teacher",
                "Salle": "Room",
                "Candidat": "Student",
            }
        },
        "constraints": constraints,
        "preferences": preferences,
    }


def write_manifest(rows: Iterable[dict], output_dir: Path) -> None:
    rows = list(rows)
    if not rows:
        return
    manifest_path = output_dir / "manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "file",
                "family",
                "A",
                "R",
                "K",
                "T",
                "seed",
                "constraints",
                "preferences",
                "difficulty",
                "fixed_jury_ratio",
                "time_window_ratio",
                "time_window_width",
                "precedence_ratio",
                "forbidden_ratio",
                "room_tightness",
                "recommended_timeout_seconds",
                "description",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)
    print(manifest_path)


def default_output_name(prefix: str, family: str, size: InstanceSize, seed: int) -> str:
    # Le marqueur F<famille> permet au pipeline de separer les familles.
    return f"{prefix}_F{family}_A{size.A}_R{size.R}_K{size.K}_T{size.T}_S{seed}.planning"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Genere des instances de soutenance parametrees pour benchmark. "
            "Par defaut, produit une suite conservatrice pour timeout 300s."
        )
    )
    parser.add_argument("--output-dir", type=Path, default=Path("python/benchmarking/test_files/scaling"), help="Dossier de sortie des .planning")
    parser.add_argument("--preset", choices=["quick", "research-3min", "extended-3min", "research-5min", "custom"], default="research-5min", help="Jeu de tailles predefini")
    parser.add_argument("--families", default="all", help="Familles a generer: all ou liste separee par virgules")
    parser.add_argument("--seeds", default="1", help="Seeds separes par virgules pour repeter chaque famille/taille")
    parser.add_argument("--A-list", default="3,4,5,6,8,10,15,20", help="Liste des A si --preset custom")
    parser.add_argument("--R-list", default="9,12,15,18,24,30,45,60", help="Liste des R si --preset custom")
    parser.add_argument("--K-list", default="2,2,3,3,4,4,5,6", help="Liste des K si --preset custom")
    parser.add_argument("--T-list", default="3,4,4,5,5,6,7,8", help="Liste des T si --preset custom")
    parser.add_argument("--mode", choices=["zipped", "grid"], default="zipped", help="Mode de combinaison des listes en preset custom")
    parser.add_argument("--prefix", default="soutenance", help="Prefixe de nom de fichier")
    parser.add_argument("--recommended-timeout", type=int, default=300, help="Timeout recommande, ecrit dans manifest.csv")
    parser.add_argument("--clear", action="store_true", help="Supprime les anciens .planning du prefixe dans output-dir avant generation")
    args = parser.parse_args()

    families = parse_family_list(args.families)
    seeds = parse_int_list(args.seeds)

    if args.preset == "custom":
        sizes = materialize_sizes(
            parse_int_list(args.A_list),
            parse_int_list(args.R_list),
            parse_int_list(args.K_list),
            parse_int_list(args.T_list),
            args.mode,
        )
    else:
        sizes = preset_sizes(args.preset)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.clear:
        for old_file in args.output_dir.glob(f"{args.prefix}_F*.planning"):
            old_file.unlink()

    manifest_rows: list[dict] = []
    for family in families:
        for size in sizes:
            for seed in seeds:
                model = build_instance(size.A, size.R, size.K, size.T, family=family, seed=seed)
                profile, difficulty = effective_profile(family, size)
                file_name = default_output_name(args.prefix, family, size, seed)
                out = args.output_dir / file_name
                out.write_text(json.dumps(model, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
                print(out)
                manifest_rows.append(
                    {
                        "file": file_name,
                        "family": family,
                        "A": size.A,
                        "R": size.R,
                        "K": size.K,
                        "T": size.T,
                        "seed": seed,
                        "constraints": len(model["constraints"]),
                        "preferences": len(model["preferences"]),
                        "difficulty": difficulty.label,
                        "fixed_jury_ratio": difficulty.fixed_jury_ratio,
                        "time_window_ratio": difficulty.time_window_ratio,
                        "time_window_width": difficulty.time_window_width,
                        "precedence_ratio": difficulty.precedence_ratio,
                        "forbidden_ratio": difficulty.forbidden_ratio,
                        "room_tightness": difficulty.room_tightness,
                        "recommended_timeout_seconds": args.recommended_timeout,
                        "description": profile.description,
                    }
                )

    write_manifest(manifest_rows, args.output_dir)
    print(
        "Instances generees: "
        f"{len(manifest_rows)} dans {args.output_dir} "
        f"({len(families)} familles, {len(sizes)} tailles, {len(seeds)} seed(s))."
    )
    print("Timeout recommande pour cette suite: " + str(args.recommended_timeout) + "s par solveur-instance.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
