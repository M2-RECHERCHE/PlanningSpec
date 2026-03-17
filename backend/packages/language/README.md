# planning-spec-language

Ce paquet contient exclusivement le langage Langium :

- la grammaire `planning-spec.langium`,
- les services Langium,
- les validateurs,
- le générateur MiniZinc.

Le serveur HTTP Express a été déplacé dans `../server` pour mieux séparer la logique métier du transport HTTP.

## Commandes

- `pnpm --filter planning-spec-language langium:generate`
- `pnpm --filter planning-spec-language build`
- `pnpm --filter planning-spec-language test`
