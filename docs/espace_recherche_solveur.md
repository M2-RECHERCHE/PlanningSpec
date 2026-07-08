# Évolution et réduction de l’espace de recherche du solveur

## 1. Qu’est-ce que l’espace de recherche ?

L’espace de recherche correspond à l’ensemble des combinaisons que le solveur peut explorer pour construire un planning.

Dans un problème de planification, chaque activité peut être placée sur plusieurs créneaux, dans plusieurs salles, et parfois avec plusieurs ressources possibles.

Formule simplifiée :

```text
Espace simplifié = nombre de choix possibles par activité ^ nombre d’activités
```

Plus il y a d’activités, de salles, de créneaux ou de ressources variables, plus l’espace augmente.

## 2. Exemple simplifié

Pour une soutenance informatique :

- 14 créneaux disponibles ;
- 5 salles disponibles.

Donc :

```text
14 × 5 = 70 choix possibles pour une soutenance
```

Pour 52 soutenances informatiques :

```text
70^52
```

Pour une soutenance mathématique :

- 14 créneaux disponibles ;
- 2 salles disponibles.

Donc :

```text
14 × 2 = 28 choix possibles
```

Pour 24 soutenances mathématiques :

```text
28^24
```

L’espace simplifié devient donc :

```text
70^52 × 28^24
```

Cette estimation ne considère que le placement des soutenances dans les couples salle–créneau. Elle ne prend pas encore en compte les contraintes, les préférences ou l’affectation éventuelle des jurys.

## 3. Comment l’espace augmente ?

L’espace augmente de manière exponentielle : chaque choix laissé ouvert multiplie le nombre de combinaisons possibles.

- Ajouter une soutenance informatique multiplie l’espace par 70.
- Ajouter une soutenance mathématique multiplie l’espace par 28.
- Ajouter une salle augmente le nombre de choix pour chaque activité concernée.
- Ajouter un créneau augmente aussi le nombre de choix pour chaque activité.
- Laisser les membres de jury variables peut multiplier fortement l’espace.

Si le système doit choisir automatiquement trois enseignants distincts parmi 32 enseignants pour une soutenance, cela ajoute environ :

```text
32 × 31 × 30
```

possibilités supplémentaires par soutenance.

Avec le choix salle–créneau, cela devient :

```text
70 × 32 × 31 × 30
```

possibilités pour une seule soutenance.

## 4. Pourquoi les affectations fixes réduisent l’espace ?

Lorsqu’une information est déjà fixée, le solveur n’a plus besoin de la chercher.

Exemple :

Si le président, le rapporteur et l’examinateur d’une soutenance sont déjà définis, le solveur ne cherche plus à composer le jury. Il cherche seulement à placer la soutenance dans un créneau et une salle compatibles.

Comparaison :

```text
Sans jury fixé :
70 × 32 × 31 × 30 possibilités pour une soutenance

Avec jury fixé :
70 possibilités pour une soutenance
```

Les affectations fixes réduisent fortement l’espace de recherche, car elles retirent des décisions au solveur.

## 5. Comment réduire au maximum l’espace de recherche ?

### Fixer les jurys connus

Quand les membres de jury sont déjà connus, il faut les préciser dans la spécification.

### Fixer les affectations obligatoires

Si une soutenance doit obligatoirement se faire avec un enseignant, une salle ou un créneau précis, il faut l’indiquer explicitement.

### Réduire les domaines inutiles

Ne pas laisser une activité choisir parmi toutes les salles si seules certaines salles sont réellement possibles.

### Utiliser des fenêtres temporelles

Limiter certaines soutenances à des jours ou créneaux précis si l’information est connue.

### Éviter les ressources trop générales

Déclarer des groupes précis de ressources : enseignants d’informatique, enseignants de mathématiques, salles informatique, salles mathématiques, etc.

### Transformer ce qui est certain en contrainte dure

Une règle obligatoire doit être déclarée comme contrainte dure, pas comme préférence.

### Utiliser les préférences seulement pour ce qui est réellement flexible

Les préférences doivent exprimer ce qui est souhaitable, mais non obligatoire.

## 6. Bonnes pratiques de spécification

- fixer tout ce qui est déjà connu ;
- éviter les choix inutiles ;
- limiter les domaines des ressources ;
- distinguer contraintes dures et préférences ;
- éviter les préférences contradictoires ;
- regrouper les activités par catégorie si nécessaire ;
- vérifier les données avant de lancer le solveur.

## 7. Résumé

L’espace de recherche augmente très rapidement avec le nombre d’activités, de créneaux, de salles et de ressources variables. Les affectations fixes permettent de réduire cet espace, car elles retirent certaines décisions du solveur. Une bonne spécification doit donc fixer les informations connues, limiter les domaines inutiles et laisser au solveur uniquement les choix réellement nécessaires.
