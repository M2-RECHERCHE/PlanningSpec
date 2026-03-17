import React, { useState } from 'react';
import { 
  TextField, Button, List, ListItem, ListItemText, IconButton, 
  Select, MenuItem, FormControl, InputLabel, 
  Typography, Box, Alert 
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { PlanningData } from '../../model/Planning';

interface Props {
  data: PlanningData;
  onUpdate: (data: PlanningData) => void;
}

const PreferencesStep: React.FC<Props> = ({ data, onUpdate }) => {
  const [prefType, setPrefType] = useState('avoid_participation_on_date');
  const [resource, setResource] = useState('');
  const [date, setDate] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [activity, setActivity] = useState('');
  const [scope, setScope] = useState('day');
  const [max, setMax] = useState('2');
  const [weight, setWeight] = useState('1');
  const [localErrors, setLocalErrors] = useState<string>('');

  const resourceTypes = Object.keys(data.resources || {});
  const activities = Object.keys(data.activities || {});
  const allResources = Object.values(data.resources || {}).flat();

  // Toujours valide car optionnel
  const totalPreferences = data.preferences?.length || 0;
  const isStepValid = true; // Préférences optionnelles

  const validateAndAdd = () => {
    const errors: string[] = [];

    // Validation poids
    const weightNum = parseInt(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      errors.push("Poids > 0 requis");
    }

    // Validation par type
    if (prefType === 'avoid_participation_on_date') {
      if (!allResources.includes(resource)) {
        errors.push("Ressource invalide");
      }
      if (!date.trim()) {
        errors.push("Date requise");
      }
    } else if (prefType === 'max_per_scope') {
      if (!resourceTypes.includes(resourceType)) {
        errors.push("Type ressource invalide");
      }
      if (!activities.includes(activity)) {
        errors.push("Activité invalide");
      }
      const maxNum = parseInt(max);
      if (isNaN(maxNum) || maxNum <= 0) {
        errors.push("Max > 0 requis");
      }
    }

    if (errors.length > 0) {
      setLocalErrors(errors.join(", "));
      return;
    }

    // Construction préférence avec description
    const newPref: any = { 
      type: prefType, 
      weight: weightNum,
      description: generatePreferenceDescription(prefType)
    };
    
    if (prefType === 'avoid_participation_on_date') {
      newPref.resource = resource;
      newPref.date = date;
    } else if (prefType === 'max_per_scope') {
      newPref.resourceType = resourceType;
      newPref.activity = activity;
      newPref.scope = scope;
      newPref.max = parseInt(max);
    }

    onUpdate({
      ...data,
      preferences: [...(data.preferences || []), newPref]
    });

    // Reset formulaire
    setResource('');
    setDate('');
    setResourceType('');
    setActivity('');
    setScope('day');
    setMax('2');
    setWeight('1');
    setLocalErrors('');
  };

  const generatePreferenceDescription = (type: string) => {
    switch (type) {
      case 'avoid_participation_on_date':
        return `${resource} évite ${date}`;
      case 'max_per_scope':
        return `${resourceType} ${activity}: max ${max} par ${scope}`;
      default:
        return type.replace('_', ' ');
    }
  };

  const removePreference = (index: number) => {
    const newPrefs = (data.preferences || []).filter((_: any, i: number) => i !== index);
    onUpdate({ ...data, preferences: newPrefs });
  };

  // Validation temps réel
  const hasFormErrors = () => {
    const weightNum = parseInt(weight);
    if (isNaN(weightNum) || weightNum <= 0) return true;
    
    if (prefType === 'avoid_participation_on_date') {
      return !resource || !date.trim();
    } else if (prefType === 'max_per_scope') {
      return !resourceType || !activity;
    }
    return false;
  };

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Préférences <span className="text-blue-500 font-semibold">(optionnel)</span>
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }} icon={<InfoIcon />}>
        <strong>Optionnel :</strong> Ajoutez des préférences pour optimiser davantage votre planning
      </Alert>

      {/* Formulaire dynamique */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Type de préférence</InputLabel>
        <Select 
          value={prefType} 
          onChange={(e) => {
            setPrefType(e.target.value as string);
            setLocalErrors('');
          }}
          label="Type de préférence"
        >
          <MenuItem value="avoid_participation_on_date">Éviter participation (date)</MenuItem>
          <MenuItem value="max_per_scope">Maximum par scope</MenuItem>
        </Select>
      </FormControl>

      {/* Éviter participation */}
      {prefType === 'avoid_participation_on_date' && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Ressource *</InputLabel>
            <Select 
              value={resource} 
              onChange={(e) => setResource(e.target.value as string)}
              label="Ressource *"
            >
              <MenuItem value="" disabled>Choisir une ressource</MenuItem>
              {allResources.length === 0 ? (
                <MenuItem disabled>Aucune ressource</MenuItem>
              ) : (
                allResources.map((r: string) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          
          <TextField
            label="Date (JJ/MM/AAAA) *"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            helperText="Ex: 15/06/2025"
          />
        </>
      )}

      {/* Maximum par scope */}
      {prefType === 'max_per_scope' && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type ressource *</InputLabel>
            <Select 
              value={resourceType} 
              onChange={(e) => setResourceType(e.target.value as string)}
              label="Type ressource *"
            >
              <MenuItem value="" disabled>Choisir un type</MenuItem>
              {resourceTypes.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Activité *</InputLabel>
            <Select 
              value={activity} 
              onChange={(e) => setActivity(e.target.value as string)}
              label="Activité *"
            >
              <MenuItem value="" disabled>Choisir une activité</MenuItem>
              {activities.map((act) => (
                <MenuItem key={act} value={act}>{act}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'end' }}>
            <TextField 
              label="Max *" 
              type="number" 
              value={max} 
              onChange={(e) => setMax(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{ min: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Scope</InputLabel>
              <Select value={scope} onChange={(e) => setScope(e.target.value as string)}>
                <MenuItem value="day">Jour</MenuItem>
                <MenuItem value="slot">Slot</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </>
      )}

      {/* Poids commun */}
      <TextField 
        label="Poids * (importance)"
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        size="small"
        sx={{ mb: 2, mr: 2 }}
        inputProps={{ min: 1 }}
        error={parseInt(weight) <= 0}
        helperText="Plus élevé = plus important (min: 1)"
      />

      {/* Bouton Add */}
      <Button 
        onClick={validateAndAdd} 
        variant="contained" 
        startIcon={<AddIcon />}
        disabled={hasFormErrors()}
        sx={{ mt: 2 }}
      >
        Ajouter préférence
      </Button>

      {/* Erreurs */}
      {localErrors && (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }} onClose={() => setLocalErrors('')}>
          {localErrors}
        </Alert>
      )}

      {/* Liste des préférences */}
      <Typography variant="h6" sx={{ mt: 4 }}>
        Préférences ajoutées ({totalPreferences})
      </Typography>
      
      {totalPreferences > 0 ? (
        <List sx={{ maxHeight: 200, overflow: 'auto' }}>
          {data.preferences.map((pref: any, index: number) => (
            <ListItem 
              key={index} 
              secondaryAction={
                <IconButton onClick={() => removePreference(index)} size="small">
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText 
                primary={pref.description || pref.type.replace('_', ' ').toUpperCase()} 
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Poids: {pref.weight}
                      {pref.resource && ` | Ressource: ${pref.resource}`}
                      {pref.resourceType && ` | Type: ${pref.resourceType}`}
                      {pref.activity && ` | Activité: ${pref.activity}`}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          Aucune préférence ajoutée (cette étape est optionnelle)
        </Alert>
      )}
    </div>
  );
};

export default PreferencesStep;
