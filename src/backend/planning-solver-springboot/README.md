# Planning Solver Generic OptaPlanner

Backend Spring Boot + OptaPlanner pour résoudre des fichiers `.planning` écrits avec le langage PlanningSpec.

Cette version est générique : elle ne dépend plus du cas `Soutenance` uniquement. Elle lit les activités, ressources, rôles, contraintes et préférences déclarés dans le fichier.

## Prérequis

- Java 25
- Maven

Vérification :

```bash
java --version
mvn --version
```

## Compiler

```bash
mvn clean package
```

## Lancer le serveur

```bash
mvn spring-boot:run
```

Puis tester :

```bash
curl http://localhost:8080/api/planning/health
```

## Résoudre un fichier `.planning`

```bash
curl -s -F "file=@examples/soutenance-15.planning" \
  "http://localhost:8080/api/planning/solve" \
  -o result.json

cat result.json | python3 -m json.tool
```

Avec un fichier personnel :

```bash
curl -s -F "file=@/chemin/vers/mon-fichier.planning" \
  "http://localhost:8080/api/planning/solve" \
  -o result.json
```

Une limite peut être ajoutée explicitement si nécessaire avec `?timeLimitSeconds=<secondes>`. Par défaut, aucune limite automatique n'est appliquée; utilisez la route d'arrêt asynchrone pour interrompre un job long.

## Mode ligne de commande

```bash
mvn -DskipTests package

java -jar target/planning-solver-generic-0.2.0.jar \
  --spring.main.web-application-type=none \
  --input=examples/soutenance-15.planning \
  --output=target/result.json
```

## Interpréter le résultat

Dans la sortie JSON :

- `hardScore = 0` signifie que les contraintes obligatoires sont respectées.
- `softScore < 0` indique des préférences non satisfaites.
- `assignments` contient une ligne par instance d'activité.
- `roles` contient les ressources affectées par rôle. La valeur est une liste pour supporter les cardinalités `min/max` supérieures à 1.

Exemple :

```json
{
  "activityInstance": "Soutenance_1",
  "activity": "Soutenance",
  "day": "Jour_1",
  "slotInDay": 1,
  "globalSlot": 1,
  "roles": {
    "President": ["Teacher_1"],
    "Rapporteur": ["Teacher_2"],
    "Salle": ["Room_1"]
  }
}
```

## Pourquoi EasyScoreCalculator ?

Le langage est dynamique : les activités, rôles et types de ressources sont déclarés dans le fichier `.planning`. Un `ConstraintProvider` OptaPlanner classique est très efficace quand le modèle est fixe, mais moins naturel pour générer des contraintes arbitraires au runtime.

Cette version utilise donc un `EasyScoreCalculator`, qui calcule le score à partir des objets de contraintes et préférences lus dans le fichier. C'est plus simple à maintenir pour un langage de spécification.

## Limites actuelles

- Le backend est générique mais reste une première version.
- Les contraintes sont évaluées dans le score calculator, donc les gros problèmes peuvent être plus lents qu'une version spécialisée en Constraint Streams.
- `cardinality_per_activity` avec `target` autre que `slot` est accepté mais pas encore pénalisé spécifiquement. La cardinalité par `role` est supportée.
- Le format de sortie est JSON applicatif, pas identique à la sortie MiniZinc.

Voir `docs/couverture-planningspec-optaplanner.md` pour la matrice détaillée.
