# Rapport D'analyse Benchmark

- Nombre total de runs solveur-instance: **5**
- Nombre total d'instances uniques: **1**
- Solveurs testes: **COIN-BC, Chuffed, Gecode, HiGHS, OR Tools CP-SAT**

## Description Des Courbes
- `curve_01_boxplot_t_total.png`: Distribution de T_total par solveur.
- `curve_02_boxplot_t_solve.png`: Distribution de T_solve par solveur.
- `curve_03_mean_times.png`: Comparaison des temps moyens (T_flat, T_solve, T_total).
- `curve_04_status_stacked.png`: Repartition des statuts par solveur.
- `curve_05_success_timeout_rates.png`: Taux de succes vs taux de timeout.
- `curve_06_cactus_t_total.png`: Cactus plot: progression des instances resolues.

## Lecture Synthese
- Solveur le plus rapide (mediane T_total): **Gecode** avec **2.834s**.
- Solveur le plus robuste: **COIN-BC** (success=100.0%, timeouts=0, errors=0).
- Bilan global: **5** runs conclusifs, **0** timeouts, **0** erreurs.

## Conclusion Finale
Le choix recommande doit privilegier d'abord la robustesse (faible taux de timeout/erreur), puis la vitesse mediane sur T_total.
Sur cette campagne, **COIN-BC** est le plus robuste et **Gecode** est le plus rapide en mediane.
Pour une justification scientifique solide, reproduisez cette analyse sur plusieurs tailles d'instances et comparez les tendances, pas un seul run.

## Statuts Par Solveur
```
Statut           SAT
Solveur             
COIN-BC            1
Chuffed            1
Gecode             1
HiGHS              1
OR Tools CP-SAT    1
```
