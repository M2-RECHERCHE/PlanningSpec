#!/usr/bin/env python3
"""Generateur d'instances .planning parametrees pour benchmark de soutenances."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List


def parse_int_list(value: str) -> List[int]:
    items = [x.strip() for x in value.split(",") if x.strip()]
    if not items:
        raise ValueError("Liste vide")
    out = [int(x) for x in items]
    if any(v <= 0 for v in out):
        raise ValueError("Toutes les valeurs doivent etre > 0")
    return out


def materialize_sizes(a_list: List[int], r_list: List[int], k_list: List[int], t_list: List[int], mode: str) -> List[tuple[int, int, int, int]]:
    if mode == "grid":
        return [(a, r, k, t) for a in a_list for r in r_list for k in k_list for t in t_list]

    max_len = max(len(a_list), len(r_list), len(k_list), len(t_list))

    def value_at(lst: List[int], i: int) -> int:
        return lst[i] if i < len(lst) else lst[-1]

    return [(value_at(a_list, i), value_at(r_list, i), value_at(k_list, i), value_at(t_list, i)) for i in range(max_len)]


def build_instance(A: int, R: int, K: int, T: int) -> dict:
    # Time horizon: 2 jours, T slots/jour.
    days = ["Jour_1", "Jour_2"]

    # Resources
    teachers = [f"Teacher_{i}" for i in range(1, R + 1)]
    rooms = [f"Room_{i}" for i in range(1, K + 1)]
    students = [f"Student_{i}" for i in range(1, A + 1)]

    constraints = [
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

    # Fixer les candidats (contrainte metier naturelle).
    for i in range(1, A + 1):
        constraints.append(
            {
                "type": "fixed_assignment",
                "activityInstance": f"Soutenance_{i}",
                "role": "Candidat",
                "resource": f"Student_{i}",
            }
        )

    # Fixer quelques jurys pour enrichir le probleme sans le sur-contraindre.
    fixed_jury = min(A, max(1, A // 4))
    for i in range(1, fixed_jury + 1):
        p = teachers[(3 * (i - 1)) % R]
        r = teachers[(3 * (i - 1) + 1) % R]
        m = teachers[(3 * (i - 1) + 2) % R]
        constraints.append({"type": "fixed_assignment", "activityInstance": f"Soutenance_{i}", "role": "President", "resource": p})
        constraints.append({"type": "fixed_assignment", "activityInstance": f"Soutenance_{i}", "role": "Rapporteur", "resource": r})
        constraints.append({"type": "fixed_assignment", "activityInstance": f"Soutenance_{i}", "role": "Membre", "resource": m})

    # Precedence partielle.
    chain_len = min(A - 1, max(0, A // 5))
    for i in range(1, chain_len + 1):
        constraints.append(
            {
                "type": "instance_precedence",
                "beforeActivityInstance": f"Soutenance_{i}",
                "afterActivityInstance": f"Soutenance_{i + 1}",
            }
        )

    # Fenetres temporelles souples via time windows sur quelques instances.
    for i in range(1, min(A, 5) + 1):
        constraints.append(
            {
                "type": "time_window",
                "activityInstance": f"Soutenance_{i}",
                "minSlot": 1,
                "maxSlot": min(2 * T, T + i),
            }
        )

    preferences = []

    # Eviter certaines participations sur Jour_1 pour quelques enseignants.
    for i in range(1, min(R, 4) + 1):
        preferences.append(
            {
                "type": "avoid_participation_on_date",
                "resource": f"Teacher_{i}",
                "date": "Jour_1",
                "weight": 4,
            }
        )

    # Preference de salle sur quelques instances.
    for i in range(1, min(A, K, 6) + 1):
        preferences.append(
            {
                "type": "preferred_resource",
                "activityInstance": f"Soutenance_{i}",
                "role": "Salle",
                "resource": f"Room_{((i - 1) % K) + 1}",
                "weight": 3,
            }
        )

    preferences.append(
        {
            "type": "room_stability_for_role",
            "activity": "Soutenance",
            "role": "President",
            "roomResourceType": "Room",
            "scope": "day",
            "weight": 2,
        }
    )
    preferences.append(
        {
            "type": "compact_schedule_for_role",
            "activity": "Soutenance",
            "role": "President",
            "scope": "day",
            "weight": 2,
        }
    )
    preferences.append(
        {
            "type": "max_per_scope",
            "resourceType": "Teacher",
            "activity": "Soutenance",
            "scope": "day",
            "max": max(1, A // max(1, R // 2)),
            "weight": 2,
        }
    )

    model = {
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
    return model


def main() -> int:
    parser = argparse.ArgumentParser(description="Genere des instances de soutenance parametrees A/R/K/T.")
    parser.add_argument("--output-dir", type=Path, default=Path("python/benchmarking/test_files/scaling"), help="Dossier de sortie des .planning")
    parser.add_argument("--A-list", default="10,20,30,40", help="Liste des A (activities count)")
    parser.add_argument("--R-list", default="30,60,90,120", help="Liste des R (teachers)")
    parser.add_argument("--K-list", default="4,6,8,10", help="Liste des K (rooms)")
    parser.add_argument("--T-list", default="6,8,10,12", help="Liste des T (slots/day)")
    parser.add_argument("--mode", choices=["zipped", "grid"], default="zipped", help="zipped: indexe, grid: produit cartesien")
    parser.add_argument("--prefix", default="soutenance", help="Prefixe de nom de fichier")
    args = parser.parse_args()

    a_list = parse_int_list(args.A_list)
    r_list = parse_int_list(args.R_list)
    k_list = parse_int_list(args.K_list)
    t_list = parse_int_list(args.T_list)

    sizes = materialize_sizes(a_list, r_list, k_list, t_list, args.mode)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for (a, r, k, t) in sizes:
        model = build_instance(a, r, k, t)
        file_name = f"{args.prefix}_A{a}_R{r}_K{k}_T{t}.planning"
        out = args.output_dir / file_name
        out.write_text(json.dumps(model, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
        print(out)

    print(f"Instances generees: {len(sizes)} dans {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
