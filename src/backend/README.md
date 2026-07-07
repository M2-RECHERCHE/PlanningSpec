# Backend workspace

Ce backend est maintenant organisé comme un mini-monorepo `pnpm` piloté depuis la racine du projet.

## Paquets

- `packages/language` : définition du DSL Langium et génération MiniZinc.
- `packages/server` : API Express qui parse le modèle, génère le MiniZinc puis appelle MiniZinc.
- `packages/cli` : interface en ligne de commande.
- `packages/extension` : extension VS Code.

## Commandes utiles

Depuis la racine du dépôt :

- `pnpm build:backend`
- `pnpm dev:backend`
- `pnpm langium:generate`
- `pnpm test`

Depuis le dossier `backend` :

- `pnpm build`
- `pnpm dev:server`
- `pnpm start:server`
