import React, { useState } from "react";
import { TextField, Button, Alert, Typography } from "@mui/material";

interface Props {
  data: any;
  onUpdate: (data: any) => void;
}

const TimeStep: React.FC<Props> = ({ data, onUpdate }) => {
  const [localErrors, setLocalErrors] = useState<{
    days?: string;
    slotsPerDay?: string;
  }>({});
  const [days, setDays] = useState(data.time.days.join(", "));
  const [slotsPerDay, setSlotsPerDay] = useState(
    data.time.slotsPerDay.toString(),
  );

  const validateAndUpdate = () => {
    const errors: any = {};

    if (!days.trim()) {
      errors.days = "Au moins un jour est requis";
    } else if (days.split(",").filter((d: string) => d.trim()).length === 0) {
      errors.days = "Entrez au moins un jour (format: JJ/MM/AAAA)";
    }

    if (!slotsPerDay || parseInt(slotsPerDay) <= 0) {
      errors.slotsPerDay = "Nombre de slots par jour doit être > 0";
    }

    setLocalErrors(errors);

    if (Object.keys(errors).length === 0) {
      const parsedDays = days
        .split(",")
        .map((d: string) => d.trim())
        .filter(Boolean);
      onUpdate({
        ...data,
        time: {
          days: parsedDays,
          slotsPerDay: parseInt(slotsPerDay),
        },
      });
    }
  };

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Temps (obligatoire)
      </Typography>

      <TextField
        label="Jours (séparés par virgules)"
        fullWidth
        value={days}
        onChange={(e) => {
          setDays(e.target.value);
          if (localErrors.days) setLocalErrors({ ...localErrors, days: "" });
        }}
        error={!!localErrors.days}
        helperText={
          localErrors.days || "Ex: 10/06/2025, 11/06/2025, 12/06/2025"
        }
        multiline
        rows={3}
        sx={{ mb: 2 }}
      />

      <TextField
        label="Slots par jour (obligatoire)"
        type="number"
        fullWidth
        value={slotsPerDay}
        onChange={(e) => {
          setSlotsPerDay(e.target.value);
          if (localErrors.slotsPerDay)
            setLocalErrors({ ...localErrors, slotsPerDay: "" });
        }}
        error={!!localErrors.slotsPerDay}
        helperText={localErrors.slotsPerDay || "Ex: 4, 6, 8"}
        inputProps={{ min: 1 }}
      />

      <Alert severity="info" sx={{ mt: 2 }}>
        <strong>Obligatoire :</strong> Au moins 1 jour et slots {">"} 0
      </Alert>

      <Button onClick={validateAndUpdate} variant="contained" sx={{ mt: 2 }}>
        Valider
      </Button>
    </div>
  );
};

export default TimeStep;
