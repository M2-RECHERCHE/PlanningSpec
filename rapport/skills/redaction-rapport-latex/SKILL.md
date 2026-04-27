---
name: redaction-rapport-latex
description: Rédiger des rapports académiques en français au format LaTeX, structurés, rigoureux et compilables. Utiliser ce skill quand la demande concerne un mémoire, un chapitre, une étude de complexité, une analyse théorique/expérimentale, des preuves mathématiques, des tableaux méthodologiques, ou la normalisation d'un document scientifique existant.
---

# Redaction Rapport Latex

## Overview

Produire des documents LaTeX de niveau Master, en français, avec raisonnement explicite, structure propre, et qualité de compilation vérifiée.
Traiter la demande comme un livrable académique, pas comme un simple brouillon.

## Profil Cible

- Mémoire/rapport technique en français.
- Forte exigence de rigueur (définitions, hypothèses, preuves, limites).
- Préférence marquée pour des documents structurés en `\section` / `\subsection`.
- Cas fréquent : interdiction des chapitres (`\chapter`).

## Workflow

1. Lire la demande et extraire les contraintes non négociables.
2. Déterminer le mode de sortie :
   - mode A : fichier LaTeX complet compilable ;
   - mode B : section autonome intégrable (sans préambule).
3. Déduire la structure cible (sections, sous-sections, tableaux, formules, preuves, limites, conclusion).
4. Rédiger le contenu avec progression logique : contexte -> modélisation -> analyse -> comparaison -> limites -> conclusion.
5. Vérifier la cohérence mathématique (notations, hypothèses, dépendances des résultats).
6. Vérifier la cohérence argumentative (thèses nuancées, pas d'affirmations absolues).
7. Vérifier les sources techniques utilisées (docs officielles prioritaires) et citer proprement.
8. Compiler (`Makefile` prioritaire ; sinon `pdflatex`) et corriger les erreurs bloquantes.
9. Livrer un document compilable et expliciter les limites des conclusions.

## Règles de Structure (priorité haute)

- Si la demande indique “pas de chapitre” :
  - utiliser `\documentclass{article}` ;
  - n'utiliser que `\section`, `\subsection`, `\subsubsection` ;
  - interdire `\chapter`.
- Si la demande est “section autonome intégrable” :
  - ne pas inclure `\documentclass`, `\begin{document}`, `\end{document}`.
- Si la demande est “fichier complet” :
  - inclure titre, éventuellement résumé/sommaire si demandé, puis sections.

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
- Expliquer le raisonnement causal, pas seulement donner le verdict final.

## Règles d'Argumentation (important)

- Éviter les formulations absolues (“toujours meilleur”, “optimal dans tous les cas”).
- Privilégier les formulations contextuelles :
  - “le plus adapté pour la formulation actuelle” ;
  - “cohérent avec la structure du modèle généré” ;
  - “à confirmer expérimentalement”.
- Distinguer explicitement :
  - nature du problème métier ;
  - nature de la formulation mathématique générée.

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

## Politique de Sources

- Pour les caractéristiques techniques des solveurs, vérifier via sources officielles (documentation éditeur/projet, documentation MiniZinc).
- Citer uniquement des sources effectivement utilisées.
- Si utilisation de `\cite{...}` :
  - vérifier que chaque clé existe dans la bibliographie ;
  - vérifier qu'aucune référence n'est non résolue après compilation.
- Si le flux bibliographique est simple, privilégier éventuellement `\footnote{\url{...}}` pour éviter les clés cassées.

## Règles LaTeX

- Adapter la classe aux contraintes utilisateurs :
  - exiger zéro chapitre `=>` préférer `\documentclass{article}`.
- Utiliser des packages standards : `babel`, `amsmath`, `amssymb`, `amsthm`, `geometry`, `booktabs`, `longtable`, `hyperref`.
- Garder les tableaux lisibles :
  - en-têtes explicites ;
  - colonnes alignées ;
  - `longtable` pour tableaux longs ;
  - `pdflscape` si tableau large.
- Pour tableaux larges (comparatifs solveurs), privilégier :
  - `\scriptsize`,
  - colonnes `p{...}`,
  - en-têtes courts et explicites.
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

## Structure Type d'une Section Solveur (cas fréquent)

1. Contexte et objectif.
2. Nature du modèle généré.
3. Adéquation formulation-solveur principal.
4. Comparaison avec solveurs concurrents (nuancée).
5. Critères de choix.
6. Méthodologie expérimentale.
7. Limites.
8. Conclusion contextuelle.

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
4. vérifier la cohérence des citations (pas de clés manquantes).
5. compiler et corriger les erreurs bloquantes.
6. confirmer que le PDF est généré.

## Protocole de Compilation

- Si `Makefile` existe : exécuter `make clean && make`.
- Si le `Makefile` ne force pas la reconstruction, exécuter explicitement `make clean` avant `make`.
- Si absence de `Makefile` : exécuter au moins deux passes `pdflatex`.
- Considérer bloquant : erreurs LaTeX, citations non résolues, labels cassés critiques.

## Anti-Patterns à Éviter

- Mélanger preuve formelle et intuition sans signaler la différence.
- Présenter des hypothèses implicites comme des faits établis.
- Utiliser des formulations vagues sans paramètres explicites.
- Générer des tableaux expérimentaux remplis sans données réelles.
- Ignorer une contrainte de forme donnée par l'utilisateur.
- Répondre avec un simple plan quand un texte rédigé complet est demandé.
