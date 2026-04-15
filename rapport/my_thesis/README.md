# LOMOFOUET Master Thesis (Template UDs)

Ce dépôt contient le code source en LaTeX d'un mémoire de Master, basé sur le template de l'Université de Dschang (UDs) avec support d'options de diffusion numérique et physique.

## Structure du Projet

Le projet sépare intelligemment le contenu rédactionnel du style global pour permettre un environnement de travail clair.

### 1. `My-Thesis/` (Contenu Principal)
Ce dossier est votre zone de travail. Il contient le code source de toutes les parties textuelles de votre document.

- **`My-Thesis.tex`** : Il s'agit du fichier maître. C'est ici que l'on configure le document (Auteur, Nature du diplôme `\master` ou `\phd`, Spécialité, Laboratoire) et que l'on inclut l'intégralité des sous-fichiers pour construire le document complet.
- **`Makefile`** : Le script de compilation automatisé pour générer le PDF sans se soucier de l'enchaînement des commandes.
- **`bibliography.bib`** : Fichier recensant toutes les références bibliographiques (base de données BibTeX).
- **`defs-and-imports.tex`** : Espace dédié aux définitions de macros LaTeX personnalisées et aux imports de paquets additionnels.
- **Dossiers de rédaction** :
  - `Introduction/`, `Chap1/`, `Chap2/`, `Chap3/`, `Conclusion/` : Hébergent vos chapitres et sous-parties structurées.
  - `Abstract/`, `Resume/`, `Acknowledgements/`, `Dedication/` : Utilisés pour renseigner le résumé (fr/en), les dédicaces et les remerciements.
  - `declaration-authorship/`, `Appendices/`, `other-pages/` : Pour la déclaration de paternité du document et l'ajout d'annexes.
- **`images/`** : Placez ici vos figures, schémas et images pour facilement les inclure dans le LaTeX avec `\includegraphics`.

### 2. `Template-Style/` (Moteur de Style)
Ce dossier contient la charte graphique et la structuration (modèle) qui sera appliquée au document final. Vous n'avez en général pas à éditer ces fichiers sauf si vous souhaitez modifier l'apparence radicale du document.

- **`main-style.tex`** : Agrégeur de style importé par votre `My-Thesis.tex`.
- **Sous-dossiers spécifiques** : 
  - `chapter-styles/`, `section-styles/` : Typographie et décors pour les titres.
  - `minitoc-styles/`, `toc-styles/` : Mise en page de vos tables de matières.
  - `footer-header-styles/` : Configuration de l'entête et du pied de page.
  - `bib-table-styles/` : Mise en forme de la bibliographie.
  - `user-commands/` : Sous-commandes système diverses.

### 3. Autres Éléments
- **`Master-PhD-Latex-Template-UDs.lpr`** : Fichier paramètre souvent généré par des éditeurs LaTeX (IDE) pour sauvegarder le contexte du projet.
- **`Backup/`** : Un dossier qui peut être utilisé pour remiser de précédentes versions du document ou d'anciennes images.

---

## Comment Utiliser ce Projet

1. **Renseigner les méta-données** :
   Ouvrez `My-Thesis/My-Thesis.tex` et éditez la section de métadonnées située autour de la Ligne 91 pour y mettre vos propres informations (`\author`, `\date`, `\level{...}`, `\speciality{...}`).
   
2. **Choix de la version (Impression ou Numérique)** :
   Dans ce même fichier principal, vous pouvez utiliser `\documentType{numerical}` pour générer un document coloré pour vos encadreurs (avec hyperliens actifs) ou `\documentType{physical}` pour une version plus sobre à envoyer chez l'imprimeur (économise l'encre couleur).

3. **Rédiger votre contenu** :
   Complétez simplement les fichiers présents dans les sous-dossiers (ex. `Chap1/Chap1.tex`) pour y verser votre prose, et placez vos images dans `images/`.

---

## Compilation

Le projet possède un module de compilation robuste et automatisé basé sur `make` qui a été configuré pour lier correctement la bibliographie et le style commun localisé dans le répertoire parent.

Prérequis : Vous devez avoir LaTeX d'installé (TeX Live sous Linux/MacOS ou MiKTeX) ainsi que l'utilitaire `make`.

Ouvrez un terminal, dirigez-vous dans le cœur du projet :
```bash
cd My-Thesis
```

Voici les commandes disponibles :

- **`make`** (ou **`make all`**) :
  C'est la commande principale à utiliser en fin de rédaction. Elle génère `My-Thesis.pdf` en combinant `pdflatex` et `bibtex` afin de lier parfaitement à la fois la table des matières complètes et vos différentes références. 
  *(Processus: pdflatex -> bibtex -> pdflatex -> pdflatex -> Nettoyage)*

- **`make fast`** :
  Effectue un rendu en direct (un seul passage de `pdflatex`). Cette commande est extrêmement véloce et parfaite lors de la phase de brouillon, si vous n'avez pas rajouté de bibliographies récemment ou si vous désirez juste prévisualiser un paragraphe.

- **`make clean`** :
  Supprime tous les fichiers de compilation résiduaires (comme `.aux`, `.log`, `.toc`, `.bbl`, etc.) créant ainsi un espace de travail pur. Idéal avant un `git commit`.

- **`make distclean`** :
  Nettoie l'ensemble du projet y compris votre document PDF généré (effectue un `clean` complet et supprime `My-Thesis.pdf`).
