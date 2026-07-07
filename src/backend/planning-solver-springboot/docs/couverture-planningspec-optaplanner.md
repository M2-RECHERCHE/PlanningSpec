# Couverture PlanningSpec -> OptaPlanner

Cette version vise l'alignement avec la grammaire `planning-spec.langium` et le générateur MiniZinc existant.

## Concepts génériques supportés

- `time.days`
- `time.slotsPerDay`
- activités arbitraires dans `activities`
- `duration` par activité
- ressources typées dans `resources`
- rôles dynamiques dans `roles`
- instances d'activités générées automatiquement sous la forme `ActivityType_1`, `ActivityType_2`, etc.

## Contraintes supportées

| Type | Statut | Notes |
|---|---:|---|
| `mandatory_roles` | supporté | transforme les rôles de l'activité en min >= 1 |
| `cardinality_per_activity` avec `role` | supporté | crée plusieurs slots optionnels jusqu'à `max` |
| `cardinality_per_activity` avec `target=slot` | implicite | chaque activité a exactement un début |
| `cardinality_per_activity` avec autre `target` | partiel | accepté, pas encore scoré directement |
| `resource_exclusivity` `scope=slot` | supporté | tient compte des durées |
| `resource_exclusivity` `scope=day` | supporté | limite par ressource et par jour |
| `fixed_assignment` | supporté | contrainte dure |
| `forbidden_assignment` | supporté | contrainte dure |
| `required_resource` | supporté | la ressource doit apparaître dans au moins un rôle de l'activité |
| `temporal_precedence` | supporté | toutes les instances de `beforeActivity` avant toutes celles de `afterActivity` |
| `instance_precedence` | supporté | une instance avant une autre |
| `time_window` | supporté | fenêtre globale min/max |

## Préférences supportées

| Type | Statut | Notes |
|---|---:|---|
| `avoid_participation_on_date` | supporté | pénalité plate si la ressource participe ce jour |
| `preferred_resource` | supporté | pénalise si la ressource préférée n'est pas affectée au rôle |
| `max_per_scope` `slot/day` | supporté | pénalité par dépassement |
| `room_stability_for_role` `day/global` | supporté | pénalise les changements de salle pour une ressource portant le rôle |
| `compact_schedule_for_role` `day/global` | supporté | pénalise les trous entre affectations |

## Architecture

```text
.planning JSON
      ↓
PlanningFileParser
      ↓
GenericPlanningProblem
      ↓
ActivityInstance + RoleAssignment
      ↓
GenericScoreCalculator
      ↓
OptaPlanner Solver
      ↓
SolveResult JSON
```

## Différence avec l'ancien prototype

L'ancien prototype était spécialisé : `Soutenance`, `President`, `Rapporteur`, `Membre`, `Salle`, `Candidat`.

Cette version remplace ces champs fixes par :

- `ActivityInstance` pour la variable de temps ;
- `RoleAssignment` pour les affectations dynamiques rôle -> ressource ;
- `RoleDefinition` pour la cardinalité et le type de ressource attendu ;
- un score calculator piloté par les objets de contraintes.
