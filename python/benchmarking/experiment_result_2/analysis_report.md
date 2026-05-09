# Rapport D'analyse Benchmark

- Nombre total de runs solveur-instance: **50**
- Nombre total d'instances uniques: **10**
- Solveurs testes: **COIN-BC, Chuffed, Gecode, HiGHS, OR Tools CP-SAT**

## Description Des Courbes
- `curve_01_boxplot_t_total.png`: Distribution de T_total par solveur.
- `curve_02_boxplot_t_solve.png`: Distribution de T_solve par solveur.
- `curve_03_mean_times.png`: Comparaison des temps moyens (T_flat, T_solve, T_total).
- `curve_04_status_stacked.png`: Repartition des statuts par solveur.
- `curve_05_success_timeout_rates.png`: Taux de succes vs taux de timeout.
- `curve_06_cactus_t_total.png`: Cactus plot: progression des instances resolues.
- `curve_07_ttotal_vs_A.png`: Evolution de T_total median selon A (taille activites).
- `curve_08_tsolve_vs_A.png`: Evolution de T_solve median selon A.
- `curve_09_success_rate_vs_A.png`: Taux de succes selon A.
- `curve_10_median_ttotal_by_family.png`: T_total median par famille de probleme.
- `curve_11_opt_rate_by_family.png`: Taux de preuve d'optimalite par famille.

## Lecture Synthese
- Solveur le plus rapide (mediane T_total): **Gecode** avec **0.268s**.
- Solveur le plus robuste: **COIN-BC** (success=100.0%, timeouts=0, errors=0).
- Bilan global: **50** runs conclusifs, **0** timeouts, **0** erreurs.

## Conclusion Finale
Le choix recommande doit privilegier d'abord la robustesse (faible taux de timeout/erreur), puis la vitesse mediane sur T_total.
Sur cette campagne, **COIN-BC** est le plus robuste et **Gecode** est le plus rapide en mediane.
Pour une justification scientifique solide, reproduisez cette analyse sur plusieurs tailles d'instances et comparez les tendances, pas un seul run.

## Statuts Par Solveur
```
Statut           OPT  SAT
Solveur                  
COIN-BC            5    5
Chuffed            5    5
Gecode             5    5
HiGHS              5    5
OR Tools CP-SAT    5    5
```

## Analyse Par Taille (A)
- Classement moyen selon A (T_total median):
  1. Chuffed: 0.384s
  2. OR Tools CP-SAT: 0.594s
  3. Gecode: 1.024s
  4. HiGHS: 1.296s
  5. COIN-BC: 1.493s

## Analyse Par Famille
- **optimisation**: meilleur compromis = **Gecode** (median T_total=0.266s, success=100.0%, OPT=100.0%).
- **satisfaction**: meilleur compromis = **Gecode** (median T_total=0.269s, success=100.0%, OPT=0.0%).
