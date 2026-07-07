# Release & Tagging Guide

Ce document définit un processus simple et reproductible pour publier une version du projet.

## 1) Convention de version

Le projet suit `SemVer`:

- `MAJOR`: rupture de compatibilité.
- `MINOR`: nouvelles fonctionnalités compatibles.
- `PATCH`: corrections sans rupture.

Format des tags:

- `vX.Y.Z` (ex: `v0.1.0`)

## 2) Pré-checks avant release

Depuis la racine du monorepo:

```bash
git checkout main
git pull --ff-only
git status
pnpm install
pnpm build
pnpm test
```

Conditions minimales:

- arborescence propre (`git status` sans changements non commités),
- build backend/frontend OK,
- tests critiques OK.

## 3) Mettre à jour la version et le changelog

1. Mettre à jour les versions dans:
   - `package.json`
   - `src/backend/packages/server/package.json`
   - `src/frontend/package.json`
2. Mettre à jour `docs/CHANGELOG.md`.
3. Commit de release:

```bash
git add package.json src/backend/packages/server/package.json src/frontend/package.json docs/CHANGELOG.md
git commit -m "chore(release): prepare vX.Y.Z"
```

## 4) Créer le tag

Créer un tag annoté:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

Vérifier:

```bash
git show vX.Y.Z --stat
git tag --list
```

Pousser commit + tag:

```bash
git push origin main
git push origin vX.Y.Z
```

## 5) Publier une release (optionnel mais recommandé)

Si vous utilisez GitHub/GitLab, créer une release depuis le tag avec:

- titre: `vX.Y.Z`,
- notes: résumé des changements de `CHANGELOG.md`,
- artefacts: build frontend, notes PDF, etc. si nécessaire.

## 6) Rollback rapide

Si le tag doit être retiré localement:

```bash
git tag -d vX.Y.Z
```

Si déjà poussé:

```bash
git push --delete origin vX.Y.Z
```

## 7) Checklist release (copier/coller)

- [ ] `main` à jour (`git pull --ff-only`)
- [ ] Build OK (`pnpm build`)
- [ ] Tests OK (`pnpm test`)
- [ ] Versions synchronisées
- [ ] `CHANGELOG.md` mis à jour
- [ ] Commit `chore(release): prepare vX.Y.Z`
- [ ] Tag annoté `vX.Y.Z`
- [ ] Push commit + tag
- [ ] Release publiée (si applicable)
