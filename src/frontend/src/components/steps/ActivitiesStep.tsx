import React, { useState } from "react";
import {
  TextField,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  Box,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

interface Props {
  data: any;
  onUpdate: (data: any) => void;
}

const ActivitiesStep: React.FC<Props> = ({ data, onUpdate }) => {
  const [activityName, setActivityName] = useState("");
  const [count, setCount] = useState("1");
  const [duration, setDuration] = useState("1");
  const [localErrors, setLocalErrors] = useState<string>("");

  // Vérification globale pour cette étape
  const totalActivities = Object.keys(data.activities).length;
  const hasActivities = totalActivities > 0;

  const validateAndAdd = () => {
    const errors: string[] = [];

    // Validation nom activité
    if (!activityName.trim()) {
      errors.push("Nom d'activité requis");
    } else if (data.activities[activityName.trim()]) {
      errors.push("Cette activité existe déjà");
    }

    // Validation count
    const countNum = parseInt(count);
    if (isNaN(countNum) || countNum <= 0) {
      errors.push("Nombre doit être supérieur à 0");
    }

    // Validation durée
    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      errors.push("Durée doit être supérieure à 0");
    }

    if (errors.length > 0) {
      setLocalErrors(errors.join(", "));
      return;
    }

    // Ajout valide
    const newActivities = {
      ...data.activities,
      [activityName.trim()]: {
        count: countNum,
        duration: durationNum,
      },
    };
    onUpdate({ ...data, activities: newActivities });

    // Reset formulaire
    setActivityName("");
    setCount("1");
    setDuration("1");
    setLocalErrors("");
  };

  const removeActivity = (name: string) => {
    const newActivities = { ...data.activities };
    delete newActivities[name];
    onUpdate({ ...data, activities: newActivities });
  };

  // Validation en temps réel sur les inputs
  const getFieldErrors = () => {
    const errors: string[] = [];

    if (!activityName.trim() && activityName.length > 0) {
      errors.push("Nom requis");
    }

    const countNum = parseInt(count);
    if (
      (count === "" || isNaN(countNum) || countNum <= 0) &&
      count.length > 0
    ) {
      errors.push("Nombre > 0");
    }

    const durationNum = parseInt(duration);
    if (
      (duration === "" || isNaN(durationNum) || durationNum <= 0) &&
      duration.length > 0
    ) {
      errors.push("Durée > 0");
    }

    return errors;
  };

  const fieldErrors = getFieldErrors();

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Activités{" "}
        <span className="text-red-500 font-semibold">*</span>
      </Typography>

      {/* Formulaire d'ajout avec validation inline */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <TextField
          label="Nom de l'activité (ex: Defense)"
          value={activityName}
          onChange={(e) => {
            setActivityName(e.target.value);
            // Clear error si l'utilisateur retape
            if (
              localErrors.includes("Nom") ||
              fieldErrors.includes("Nom requis")
            ) {
              setLocalErrors("");
            }
          }}
          error={!!fieldErrors.find((e) => e.includes("Nom"))}
          helperText={
            fieldErrors.find((e) => e.includes("Nom")) || "Nom unique requis"
          }
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
        />

        <TextField
          label="Nombre"
          type="number"
          value={count}
          onChange={(e) => {
            setCount(e.target.value);
            if (localErrors.includes("Nombre")) setLocalErrors("");
          }}
          error={!!fieldErrors.find((e) => e.includes("Nombre"))}
          helperText={fieldErrors.find((e) => e.includes("Nombre")) || "Ex: 5"}
          size="small"
          sx={{ width: 100 }}
          inputProps={{ min: 1 }}
        />

        <TextField
          label="Durée (slots)"
          type="number"
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
            if (localErrors.includes("Durée")) setLocalErrors("");
          }}
          error={!!fieldErrors.find((e) => e.includes("Durée"))}
          helperText={fieldErrors.find((e) => e.includes("Durée")) || "Ex: 2"}
          size="small"
          sx={{ width: 120 }}
          inputProps={{ min: 1 }}
        />

        <IconButton
          onClick={validateAndAdd}
          color="primary"
          size="large"
          disabled={fieldErrors.length > 0}
        >
          <AddIcon />
        </IconButton>
      </Box>

      {/* Erreur globale d'ajout */}
      {localErrors && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setLocalErrors("")}
        >
          {localErrors}
        </Alert>
      )}

      {/* Liste des activités */}
      <Typography variant="h6" gutterBottom>
        Activités définies ({totalActivities})
      </Typography>

      {hasActivities ? (
        <List sx={{ maxHeight: 300, overflow: "auto" }}>
          {Object.entries(data.activities).map(([name, activity]: any) => (
            <ListItem
              key={name}
              secondaryAction={
                <IconButton onClick={() => removeActivity(name)} edge="end">
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={name}
                secondary={`Count: ${activity.count} | Durée: ${activity.duration} slots`}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Aucune activité</strong> - Ajoutez au moins 1 activité pour
          continuer
        </Alert>
      )}

    </div>
  );
};

export default ActivitiesStep;
