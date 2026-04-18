# Changelog

Toutes les évolutions notables du projet sont documentées ici.

Le format suit une structure inspirée de Keep a Changelog et le versioning suit SemVer.

## [0.1.0] - 2026-04-18

### Added

- Monorepo `pnpm` stabilisé pour backend + frontend.
- Chaîne DSL Langium -> génération MiniZinc -> exécution solveur via API Express.
- Éditeur de planification côté frontend avec validation/synchronisation.
- Génération de rapports et base de cas d’expressivité (`rapport/notes/expressivite`).

### Changed

- Renforcement de la grammaire/validation DSL pour les contraintes et préférences.
- Optimisations progressives du flux solveur et du générateur MiniZinc.

### Fixed

- Correctifs de robustesse sur la génération MiniZinc (dont collisions d’identifiants de ressources).
- Correctifs LaTeX/bibliographie dans la documentation d’expressivité.
