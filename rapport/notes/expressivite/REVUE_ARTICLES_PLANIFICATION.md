# Revue ciblée d'articles de planification et cartographie vers `PlanningSpec`

Ce document complète le rapport LaTeX avec:
- des articles **effectivement disponibles** dans `rapport/articles/expressivite`,
- les résultats rapportés par chaque article (selon résumé/sections expérimentales),
- une implémentation ou une projection en `PlanningSpec`,
- les limites actuelles du langage quand la représentation n’est pas complète.

## 1) JSSP — classification, contraintes, objectifs

- **Article**: Abdolrazzagh‑Nezhad & Abdullah (2017), *Job Shop Scheduling: Classification, Constraints and Objective Functions*.
- **Fichier**: `rapport/articles/expressivite/abdolrazzagh2017_jssp_review.pdf`.
- **Problème étudié**: JSSP (machines, jobs, routage d’opérations, conflits de ressources).
- **Résultat principal de l’article**:
  - synthèse structurée des classes JSSP;
  - consolidation des contraintes centrales (précédences, capacité machine, non-chevauchement);
  - consolidation des objectifs classiques (makespan, lateness, tardiness).
- **Implémentation `PlanningSpec`**:
  - `cases/01_jssp_article_case.planning`.
- **Couverture par le langage**:
  - ✔ précédences opérationnelles (`instance_precedence`);
  - ✔ affectation machine (`required_resource`);
  - ✔ unicité/capacité (`cardinality_per_activity`, `resource_exclusivity`).
- **Limites observées**:
  - objectif makespan non explicite dans le DSL utilisateur (géré côté solveur/génération).

---

## 2) RCPSP (approche SAT) — fermeture d’instances benchmark

- **Article**: Horbach (2009), *A boolean satisfiability approach to the RCPSP*.
- **Fichier**: `rapport/articles/expressivite/horbach2009_sat_rcpsp.pdf`.
- **Problème étudié**: RCPSP (PSPLIB: j30, j60, j90, j120), encodage SAT.
- **Résultat principal de l’article** (tel que rapporté dans le papier):
  - fermeture d’instances auparavant ouvertes dans PSPLIB;
  - résolution optimale d’un plus grand nombre d’instances moyennes/grandes;
  - gains de temps significatifs vs solveurs comparés sur certaines classes.
- **Implémentation `PlanningSpec`**:
  - `cases/06_horbach2009_rcpsp_sat_case.planning`.
- **Couverture par le langage**:
  - ✔ précédences de projet;
  - ✔ ressources renouvelables et capacités;
  - ✔ planification discrète en slots.
- **Limites observées**:
  - pas d’expression native du **type de backend** (SAT/MIP/CP) dans le DSL;
  - pas de mécanisme standard pour déclarer explicitement des bornes inférieures/supérieures d’optimisation multi-run.

---

## 3) MSRCMPSP réel industriel (SNCF)

- **Article**: Torba et al. (2024), *Solving a real-life multi-skill resource-constrained multi-project scheduling problem*.
- **Fichier**: `rapport/articles/expressivite/torba2024_msrcmpsp_annals.pdf`.
- **Problème étudié**:
  - multi-projets;
  - multi-compétences;
  - ressources hétérogènes (opérateurs + machines);
  - objectifs SWTP et SWDP.
- **Résultat principal de l’article** (sections expérimentales):
  - l’algorithme mémétique (MA) surpasse les approches de comparaison sur une large partie des instances;
  - gains en nombre de meilleures solutions et en gap moyen selon les horizons de temps CPU.
- **Implémentation `PlanningSpec`**:
  - `cases/04_torba2024_msrcmpsp_partial.planning`.
- **Couverture par le langage**:
  - ✔ contraintes de rôles/compétences (via `roles` + `mandatory_roles`);
  - ✔ précédences intra-projet;
  - ✔ contraintes d’exclusivité et de charge.
- **Limites observées**:
  - multi-projet non typé nativement (contournement via préfixes de noms d’activités);
  - objectifs métier SWTP/SWDP non natifs;
  - lags complexes et certaines contraintes industrielles spécifiques non primitives.

---

## 4) MRCMPSP (multi-skill + multi-mode) avec HQPSO

- **Article**: Peng et al. (2023), *Multi-skill resource-constrained multi-modal project scheduling problem based on hybrid quantum algorithm*.
- **Fichier**: `rapport/articles/expressivite/peng2023_mrcmpsp_scirep.pdf`.
- **Problème étudié**:
  - activités multi-modes;
  - ressources multi-compétences;
  - minimisation de durée projet.
- **Résultat principal de l’article**:
  - le HQPSO proposé montre une meilleure convergence et précision que les variantes comparées (PSO/QPSO) sur les expérimentations rapportées.
- **Implémentation `PlanningSpec`**:
  - `cases/05_peng2023_mrcmpsp_partial.planning`.
- **Couverture par le langage**:
  - ✔ ressources multi-compétences via types/roles;
  - ✔ contraintes de précédence et capacités.
- **Limites observées**:
  - **multi-mode natif absent** (pas de variable de sélection de mode par activité);
  - pas de contrainte disjonctive “choisir exactement un mode” dans la grammaire;
  - pas de coût/énergie natif pour objectif multi-critère.

---

## 5) MSRCPSP avec compétences hiérarchiques

- **Article**: Snauwaert & Vanhoucke (2025), *A solution framework for multi-skilled project scheduling problems with hierarchical skills*.
- **Fichier**: `rapport/articles/expressivite/snauwaert2025_hierarchical_skills.pdf`.
- **Problème étudié**:
  - 6 variantes MSRCPSP à compétences hiérarchiques;
  - génération de best-known solutions + bornes sur jeux de données de la littérature.
- **Résultat principal de l’article**:
  - cadre GA + local search spécifique;
  - amélioration de l’état de l’art sur best-known/lower bounds pour les variantes traitées.
- **Implémentation `PlanningSpec`**:
  - `cases/07_snauwaert2025_hskills_partial.planning`.
- **Couverture par le langage**:
  - ✔ compétences catégorielles (présence/absence) via types et rôles.
- **Limites observées**:
  - **niveaux hiérarchiques de compétence absents**;
  - pas de relation native niveau-skill ↔ durée/coût/qualité;
  - pas de structure objective multi-critère “coût + makespan + qualité”.

---

## 6) Articles orientés modélisation CP par LLM (complément)

Ces articles ne définissent pas un nouveau problème de planification spécifique, mais ils sont utiles pour valider la partie “modélisation automatisée”:
- `text2zinc2025_arxiv.pdf`
- `constraintllm2025_acl.pdf`
- `szeider2025_mcp_solver_arxiv.pdf`
- `song2025_llm_cp.pdf`

**Résultats globaux**:
- les LLMs améliorent l’assistance à la modélisation, mais ne sont pas encore “push-button” en fiabilité absolue;
- les approches neuro-symboliques/validation outillée améliorent la robustesse.

**Intérêt pour `PlanningSpec`**:
- justifie le besoin d’un DSL intermédiaire explicite, validable, puis compilable vers solveur.

---

## 7) Synthèse des limites actuelles du langage (issues de la revue)

Fonctionnalités **manquantes ou partielles** pour couvrir complètement les articles avancés:

1. Multi-mode natif par activité (`modes[]`, sélection unique de mode, durées/consommations par mode).
2. Niveaux hiérarchiques de compétence (skill levels) et règles de qualification (`>= niveau requis`).
3. Objectifs avancés natifs:
   - makespan explicite configurable,
   - tardiness pondéré (SWTP),
   - durée pondérée (SWDP),
   - objectifs multi-critères hiérarchiques.
4. Entité “projet” explicite (au lieu de conventions de nommage).
5. Contraintes de lags et contraintes industrielles spécifiques (setup, calendriers complexes, etc.).

## 8) Décision scientifique pratique

Avec les cas fournis, `PlanningSpec` couvre déjà:
- la base RCPSP/JSSP discrète (précédences, capacités, affectations),
- les rôles et préférences souples.

La revue montre cependant que, pour viser la littérature récente multi-skill/multi-mode/multi-objectifs, il faut une **v2** de la grammaire avec les 5 extensions ci-dessus.
