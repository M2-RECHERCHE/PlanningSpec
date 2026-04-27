---
name: redaction-rapport-latex
description: Rédiger des rapports académiques en français au format LaTeX, structurés, rigoureux et compilables. Utiliser ce skill quand la demande concerne un mémoire, un chapitre, une étude de complexité, une analyse théorique/expérimentale, des preuves mathématiques, des tableaux méthodologiques, ou la normalisation d'un document scientifique existant.
---

# Redaction Rapport Latex

## Overview

Produire un rapport académique LaTeX complet, cohérent et directement compilable, avec séparation explicite entre théorie, estimation et empirique.
Respecter strictement les contraintes structurelles du demandeur (ex. document sans chapitres, langue française, sections imposées, style Master).

## Workflow

1. Lire la demande et extraire les contraintes non négociables.
2. Identifier le format attendu : `article` ou `report`, avec ou sans `\chapter`.
3. Déduire le plan cible (sections, sous-sections, preuves, tableaux, bibliographie).
4. Rédiger le contenu section par section avec progression logique : définitions, propositions, preuves, remarques, limites.
5. Vérifier la cohérence mathématique (notations, hypothèses, dépendances des résultats).
6. Vérifier la cohérence rédactionnelle (terminologie stable, transitions, niveau Master).
7. Compiler (`Makefile` si présent, sinon `pdflatex`) et corriger les erreurs bloquantes.
8. Livrer un document compilable et signaler explicitement ce qui relève de la théorie, de l'estimation, et de l'empirique.

## Contraintes de Rédaction

- Rédiger en français académique clair, sans jargon gratuit.
- Définir les notations avant usage.
- Distinguer explicitement :
  - résultats démontrés ;
  - estimations asymptotiques ;
  - protocole empirique.
- Ne pas inventer de mesures expérimentales.
- Si les données sont absentes, fournir une méthodologie et des tableaux vides à remplir.
- Énoncer les hypothèses de chaque preuve.
- Conclure chaque preuve proprement.

## Rigueur Mathématique

Utiliser `amsthm` et les environnements suivants quand pertinents :
- `definition`
- `proposition`
- `proof`
- `remark`

Pour chaque résultat important :
1. annoncer l'énoncé ;
2. préciser les hypothèses ;
3. démontrer ;
4. interpréter en une phrase.

## Règles LaTeX

- Adapter la classe aux contraintes utilisateurs :
  - exiger zéro chapitre `=>` préférer `\documentclass{article}`.
- Utiliser des packages standards : `babel`, `amsmath`, `amssymb`, `amsthm`, `geometry`, `booktabs`, `longtable`, `hyperref`.
- Garder les tableaux lisibles :
  - en-têtes explicites ;
  - colonnes alignées ;
  - `longtable` pour tableaux longs ;
  - `pdflscape` si tableau large.
- Toujours livrer un document compilable dans l'état final.

## Structure Type d'un Rapport

Adapter selon la demande, mais utiliser par défaut :
1. Titre + résumé.
2. Introduction et objectif.
3. Rappels théoriques.
4. Modélisation/paramètres/notations.
5. Analyse de complexité temporelle.
6. Analyse de complexité spatiale.
7. Difficulté théorique (ex. NP-difficulté).
8. Analyse solveur et aspects pratiques.
9. Méthodologie expérimentale.
10. Limites.
11. Conclusion.
12. Références.

## Gestion des Résultats Empiriques

Si mesures absentes :
- écrire un protocole reproductible ;
- définir variables contrôlées ;
- préciser métriques collectées ;
- proposer tableaux de collecte vides ;
- éviter tout chiffre non fourni.

## Qualité et Vérifications Finales

Avant livraison :
1. vérifier l'absence de conflit avec les contraintes explicites (ex. pas de `\chapter`).
2. vérifier que toutes les formules sont cohérentes avec les notations.
3. vérifier que chaque proposition importante a une justification.
4. compiler et corriger les erreurs bloquantes.
5. confirmer que le PDF est généré.

## Anti-Patterns à Éviter

- Mélanger preuve formelle et intuition sans signaler la différence.
- Présenter des hypothèses implicites comme des faits établis.
- Utiliser des formulations vagues sans paramètres explicites.
- Générer des tableaux expérimentaux remplis sans données réelles.
- Ignorer une contrainte de forme donnée par l'utilisateur.
