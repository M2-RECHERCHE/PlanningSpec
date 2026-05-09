# Benchmark Planning -> MiniZinc -> Solveurs

Ce module automatise le pipeline expérimental suivant:
1. entrée: un ou plusieurs fichiers `.planning`/`.mzn`, ou un dossier complet,
2. compilation DSL: `.planning -> .mzn` via votre backend Langium (`planning-spec-cli generate-mzn`),
3. résolution MiniZinc via `minizinc-python` sur plusieurs solveurs,
4. export des résultats dans un CSV exploitable pour votre rapport de recherche.

Objectif: obtenir des mesures comparables pour justifier le choix d'un solveur (robustesse, temps de compilation, temps de recherche, taux d'échec/timeout).

---

## 1) Prérequis

- Python 3.10+
- MiniZinc installé et accessible dans le `PATH`
- Dépendances Node du monorepo installées (`pnpm install` à la racine)

Installation Python:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python/benchmarking/requirements.txt
```

Lancement Jupyter:

```bash
jupyter lab
```

Notebook principal:

`python/benchmarking/benchmark_pipeline.ipynb`

Kernel recommande dans Jupyter/VS Code:

`Python (benchmarking-mzn)`

---

## 2) Entrées supportées

Le script accepte maintenant:
- un fichier unique (`.planning` ou `.mzn`),
- plusieurs fichiers,
- un dossier (scan récursif),
- un motif glob (`**/*.planning`, etc.).

Formats traités:
- `.planning`: compilé automatiquement en `.mzn` via le backend,
- `.mzn`: envoyé directement au solveur,
- `.dzn`: si un `fichier.dzn` homonyme de `fichier.mzn` existe, il est chargé automatiquement.

---

## 3) Commandes d'exécution

Vous pouvez soit utiliser le script CLI, soit le notebook Jupyter.

### Option Notebook (recommandée pour visualisation)

1. Ouvrir `python/benchmarking/benchmark_pipeline.ipynb`
2. Exécuter les cellules dans l'ordre
3. Récupérer les courbes et tableaux dans `python/benchmarking/result/`

### Cas A: un seul fichier `.planning`

```bash
python3 python/benchmarking/benchmark_pipeline.py \
  python/benchmarking/test_files/01_jssp_article_case.planning
```

### Cas B: plusieurs fichiers précis

```bash
python3 python/benchmarking/benchmark_pipeline.py \
  python/benchmarking/test_files/01_jssp_article_case.planning \
  python/benchmarking/test_files/02_rcpsp_article_case.planning \
  python/benchmarking/test_files/03_academic_planning_case.planning
```

### Cas C: un dossier complet

```bash
python3 python/benchmarking/benchmark_pipeline.py \
  python/benchmarking/test_files
```

### Cas D: un motif glob

```bash
python3 python/benchmarking/benchmark_pipeline.py \
  "python/benchmarking/test_files/**/*.planning"
```

### Cas E: mélange fichier + dossier + glob

```bash
python3 python/benchmarking/benchmark_pipeline.py \
  backend/test_files/planning1.planning \
  backend/test_files \
  "rapport/notes/expressivite/cases/*.planning"
```

### Campagne par familles et tailles (A/R/K/T)

Generer une suite etendue pour des runs avec timeout de 5 minutes par solveur-instance:

```bash
python3 python/benchmarking/generate_soutenance_instances.py \
  --output-dir python/benchmarking/test_files/scaling \
  --preset research-5min \
  --families all \
  --seeds 1 \
  --clear
```

Le nom des fichiers encode maintenant la famille et la taille:

`soutenance_Foptimisation_A8_R24_K4_T5_S1.planning`

Le generateur ecrit aussi un `manifest.csv` avec famille, taille, niveau de difficulte, ratios de fenetres temporelles / precedences / interdictions, nombre de contraintes, nombre de preferences et timeout recommande.

Familles disponibles:
- `satisfaction`: contraintes de planning sans fonction objectif;
- `optimisation`: contraintes de planning avec preferences a minimiser.

Pour une verification rapide:

```bash
python3 python/benchmarking/generate_soutenance_instances.py \
  --output-dir python/benchmarking/test_files/scaling \
  --preset quick \
  --families satisfaction,optimisation \
  --seeds 1 \
  --clear
```

Lancer le benchmark sur ces familles:

```bash
python3 python/benchmarking/benchmark_pipeline.py \
  python/benchmarking/test_files/scaling \
  --minizinc-bin /snap/minizinc/current/bin/minizinc \
  --timeout 300 \
  --result-dir python/benchmarking/result
```

---

## 4) Options importantes

- `--output-csv <path>`: chemin du fichier de résultats (défaut: `python/benchmarking/benchmark_results.csv`)
- `--result-dir <path>`: dossier des courbes et tableaux de synthèse (défaut: `python/benchmarking/result`)
- `--generated-mzn-dir <path>`: dossier de sortie des `.mzn` générés
- `--timeout <sec>`: timeout par solveur/instance (défaut: 300, soit 5 minutes)
- `--skip-backend-build`: saute le `pnpm --filter planning-spec-cli build`
- `--repo-root <path>`: racine du monorepo
- `--minizinc-bin <path>`: force le binaire MiniZinc (utile si plusieurs installations coexistent)
- `--include-optaplanner`: tente d'inclure OptaPlanner (si présent dans MiniZinc)
- `--keep-generated`: conserve les anciens `.mzn` (sinon le dossier `generated_mzn` est regénéré)
- `--keep-result`: conserve les anciens artefacts (sinon le dossier `result` est regénéré)
- `--input-dir <dir>`: ancien mode compatible (peut être répété), mais les arguments positionnels sont recommandés

Exemple complet:

```bash
python3 python/benchmarking/benchmark_pipeline.py \
  backend/test_files \
  --timeout 300 \
  --minizinc-bin /snap/minizinc/current/bin/minizinc \
  --result-dir python/benchmarking/result \
  --output-csv python/benchmarking/results_etude_v1.csv
```

---

## 5) Solveurs utilisés

Le script cible:
- `Gecode`
- `Chuffed`
- `HiGHS`
- `OR Tools CP-SAT`
- `COIN-BC`

Optionnel:
- `OptaPlanner` via `--include-optaplanner` (souvent non disponible via MiniZinc)

Comportement:
- les 5 solveurs principaux sont considérés comme requis,
- si l'un d'eux manque, le run s'arrête avec une erreur explicite,
- OptaPlanner reste optionnel et n'empêche pas l'exécution.

---

## 6) Vérifier la disponibilité des solveurs

Vérification côté MiniZinc:

```bash
minizinc --solvers-json
```

Ou filtré:

```bash
minizinc --solvers | grep -E "Gecode|Chuffed|HiGHS|OR Tools|COIN-BC|OptaPlanner"
```

---

## 7) Installation des solveurs: point important

`pip install minizinc` installe uniquement la librairie Python cliente.
Cela **n'installe pas** les solveurs natifs.

Les solveurs doivent être installés via MiniZinc/OS:
- méthode recommandée: installer MiniZinc Bundle (inclut généralement Gecode + Chuffed + HiGHS selon la distribution),
- ou installer les solveurs séparément puis les enregistrer dans MiniZinc.

En pratique sur machine locale Linux:
1. installer/mettre à jour MiniZinc,
2. vérifier `minizinc --solvers-json`,
3. relancer le benchmark.

### Cas fréquent: l'IDE voit Chuffed, mais le terminal non

Cela signifie généralement que votre terminal utilise un autre `minizinc` que l'IDE.

Vérifiez le binaire actif:

```bash
which minizinc
minizinc --version
```

Si vous utilisez le package Snap MiniZinc, vous pouvez forcer ce binaire:

```bash
python3 python/benchmarking/benchmark_pipeline.py \
  backend/test_files \
  --minizinc-bin /snap/minizinc/current/bin/minizinc
```

Et pour rendre ce choix permanent dans votre shell:

```bash
echo 'export PATH="/snap/minizinc/current/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
hash -r
```

Re-vérifiez ensuite:

```bash
which minizinc
minizinc --solvers | grep -E "Chuffed|Gecode|HiGHS|OR Tools|COIN-BC|OptaPlanner"
```

Si vous voulez, je peux vous préparer ensuite un script d'audit (`check_environment.sh`) qui valide automatiquement:
- Python, `minizinc-python`, `pandas`,
- binaire `minizinc`,
- solveurs attendus,
- versions détectées.

---

## 8) Format du CSV produit

Colonnes:
- `Instance`
- `A`, `R`, `K`, `T`
- `Solveur`
- `T_flat`
- `T_solve`
- `T_total`
- `Statut`

Statuts normalisés:
- `SAT`
- `UNSAT`
- `OPT`
- `TIMEOUT`
- ou `ERROR: ...` si exception technique

---

## 9) Courbes et synthèses générées dans `result/`

Le script génère automatiquement dans le dossier `result`:

- `benchmark_results.csv` (copie consolidée des résultats)
- `solver_summary.csv` (moyennes, médianes, taux de succès/timeout)
- `status_by_solver.csv` (table de contingence statuts vs solveurs)
- `analysis_report.md` (description des figures + conclusion automatique)
- `size_summary_by_A.csv` (synthèse par taille A)
- `family_summary.csv` (médiane, quartiles et taux succès/OPT/timeout par famille et solveur)
- `family_ranking.csv` (classement par famille de problème)
- `curve_01_boxplot_t_total.png`
- `curve_02_boxplot_t_solve.png`
- `curve_03_mean_times.png`
- `curve_04_status_stacked.png`
- `curve_05_success_timeout_rates.png`
- `curve_06_cactus_t_total.png`
- `curve_07_ttotal_vs_A.png`
- `curve_08_tsolve_vs_A.png`
- `curve_09_success_rate_vs_A.png`
- `curve_10_median_ttotal_by_family.png`
- `curve_11_opt_rate_by_family.png`

Ces courbes couvrent les comparaisons nécessaires pour justifier le choix du solveur:
- performance brute (`T_total`, `T_solve`),
- coût de compilation (`T_flat` via tableaux de synthèse),
- robustesse (`SAT/UNSAT/OPT/TIMEOUT/ERROR`),
- capacité à résoudre rapidement un grand nombre d’instances (cactus plot).

Le fichier `analysis_report.md` ajoute:
- une description de chaque image générée,
- une synthèse des statuts/temps,
- une conclusion finale sur robustesse vs performance.

Les courbes `curve_07..09` permettent une lecture claire de l'effet de la taille du problème:
- comment le temps évolue avec `A`,
- quels solveurs se dégradent le plus vite,
- si le taux de succès reste stable quand la difficulté augmente.

---

## 10) Paramètres A/R/K/T (taille d'instance)

La fonction `extract_params(filename)` retourne actuellement `(0, 0, 0, 0)`.

Recommandation recherche: encoder les paramètres dans le nom de fichier, par exemple:

`instance_A30_R10_K3_T40.planning`

Puis parser par regex dans `extract_params` pour obtenir un CSV directement exploitable statistiquement.

---

## 11) Bonnes pratiques méthodologiques (rapport de Master)

Pour justifier le choix d'un solveur, gardez un protocole constant:
- même timeout pour tous les solveurs,
- même machine et charge système stable,
- plusieurs tailles d'instances,
- comparaison par médiane et taux de timeout, pas seulement un cas isolé,
- distinguer coût de compilation (`T_flat`) et coût de recherche (`T_solve`).

Cela vous permettra de conclure proprement sur:
- solveur le plus rapide en moyenne,
- solveur le plus robuste (moins de timeouts/erreurs),
- solveur le plus adapté à votre type de modèle.
