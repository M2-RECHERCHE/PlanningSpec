import React, { useState, useCallback } from 'react';
import { 
  TextField, Button, List, ListItem, ListItemText, IconButton, 
  Select, MenuItem, FormControl, InputLabel, 
  Typography, Box, Alert 
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import BuildIcon from '@mui/icons-material/Build';

interface Props {
  data: any;
  onUpdate: (data: any) => void;
}

const ConstraintsStep: React.FC<Props> = ({ data, onUpdate }) => {
  const [constraintType, setConstraintType] = useState('cardinality_per_activity');
  const [activity, setActivity] = useState('');
  const [role, setRole] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [target, setTarget] = useState('slot');
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('1');
  const [activityInstance, setActivityInstance] = useState('');
  const [resource, setResource] = useState('');
  const [localErrors, setLocalErrors] = useState<string>('');

  const activities = Object.keys(data.activities || {});
  const resourceTypes = Object.keys(data.resources || {});
  const rolesByActivity = data.roles || {};

  // Statut étape
  const totalConstraints = data.constraints?.length || 0;

  // Générer contraintes par défaut
  const generateDefaultConstraints = useCallback(() => {
    const defaults: any[] = [];

    // 1. Une instance par slot pour chaque activité
    activities.forEach(activity => {
      defaults.push({
        type: 'cardinality_per_activity',
        activity,
        target: 'slot',
        min: 1,
        max: 1
      });

      // 2. Une salle par activité (si Room existe)
      if (resourceTypes.includes('Room')) {
        defaults.push({
          type: 'cardinality_per_activity',
          activity,
          target: 'Room',
          min: 1,
          max: 1
        });
      }

      // 3. Rôles obligatoires pour chaque activité
      const activityRoles = rolesByActivity[activity];
      if (activityRoles) {
        Object.keys(activityRoles).forEach(roleName => {
          const roleType = activityRoles[roleName];
          if (roleType) {
            defaults.push({
              type: 'cardinality_per_activity',
              activity,
              role: roleName,
              min: 1,
              max: 1
            });
          }
        });
      }
    });

    // 4. Exclusivité enseignant/salle par slot
    if (resourceTypes.includes('Teacher')) {
      defaults.push({
        type: 'resource_exclusivity',
        resourceType: 'Teacher',
        activity: activities[0] || '',
        scope: 'slot',
        max: 1
      });
    }

    if (resourceTypes.includes('Room')) {
      defaults.push({
        type: 'resource_exclusivity',
        resourceType: 'Room',
        activity: activities[0] || '',
        scope: 'slot',
        max: 1
      });
    }

    onUpdate({
      ...data,
      constraints: [...(data.constraints || []), ...defaults]
    });
  }, [data, onUpdate, activities, resourceTypes, rolesByActivity]);

  const validateAndAdd = () => {
    const errors: string[] = [];

    // Validation commune
    if (!activity && constraintType !== 'resource_exclusivity') {
      errors.push("Activité requise");
    }
    if (parseInt(min) > parseInt(max)) {
      errors.push("Min ≤ Max");
    }
    if (parseInt(min) < 0 || parseInt(max) < 0) {
      errors.push("Valeurs ≥ 0");
    }

    // Validation par type
    switch (constraintType) {
      case 'cardinality_per_activity':
        if (!activities.includes(activity)) errors.push("Activité invalide");
        break;
      case 'resource_exclusivity':
        if (!resourceTypes.includes(resourceType)) errors.push("Type ressource invalide");
        break;
      case 'fixed_assignment':
      case 'forbidden_assignment':
        if (!activityInstance || !role || !resource) {
          errors.push("Instance, rôle et ressource requis");
        }
        break;
    }

    if (errors.length > 0) {
      setLocalErrors(errors.join(", "));
      return;
    }

    // Construction contrainte
    const newConstraint: any = { 
      type: constraintType
    };

    if (['cardinality_per_activity', 'resource_exclusivity'].includes(constraintType)) {
      newConstraint.activity = activity;
      newConstraint.target = target;
      newConstraint.min = parseInt(min);
      newConstraint.max = parseInt(max);
    }
    
    if (constraintType === 'cardinality_per_activity' && role) {
      newConstraint.role = role;
    }
    
    if (constraintType === 'resource_exclusivity') {
      newConstraint.resourceType = resourceType;
      newConstraint.scope = target;
    }
    
    if (['fixed_assignment', 'forbidden_assignment'].includes(constraintType)) {
      newConstraint.activityInstance = activityInstance;
      newConstraint.role = role;
      newConstraint.resource = resource;
    }

    onUpdate({
      ...data,
      constraints: [...(data.constraints || []), newConstraint]
    });

    // Reset
    setActivity('');
    setRole('');
    setResourceType('');
    setTarget('slot');
    setMin('1');
    setMax('1');
    setActivityInstance('');
    setResource('');
    setLocalErrors('');
  };

  const removeConstraint = (index: number) => {
    const newConstraints = (data.constraints || []).filter((_: any, i: number) => i !== index);
    onUpdate({ ...data, constraints: newConstraints });
  };

  // Validation temps réel
  const hasFormErrors = () => {
    if (!activity && constraintType !== 'resource_exclusivity') return true;
    if (parseInt(min) > parseInt(max)) return true;
    return false;
  };

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Contraintes <span className="text-red-500 font-semibold">*</span>
      </Typography>

      {/* Bouton contraintes par défaut */}
      <Button 
        onClick={generateDefaultConstraints}
        variant="outlined" 
        startIcon={<BuildIcon />}
        sx={{ mb: 3 }}
        size="large"
      >
        Générer contraintes par défaut ({activities.length} activités)
      </Button>

      {/* Formulaire dynamique */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Type *</InputLabel>
        <Select 
          value={constraintType} 
          onChange={(e) => {
            setConstraintType(e.target.value as string);
            setLocalErrors('');
          }}
          label="Type *"
        >
          <MenuItem value="cardinality_per_activity">Cardinalité activité</MenuItem>
          <MenuItem value="resource_exclusivity">Exclusivité ressource</MenuItem>
          <MenuItem value="fixed_assignment">Affectation fixe</MenuItem>
          <MenuItem value="forbidden_assignment">Affectation interdite</MenuItem>
        </Select>
      </FormControl>

      {['cardinality_per_activity'].includes(constraintType) && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Activité *</InputLabel>
            <Select 
              value={activity} 
              onChange={(e) => setActivity(e.target.value as string)}
              label="Activité *"
            >
              <MenuItem value="" disabled>Choisir...</MenuItem>
              {activities.map((act) => (
                <MenuItem key={act} value={act}>{act}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'end' }}>
            <TextField 
              label="Min" 
              type="number" 
              value={min} 
              onChange={(e) => setMin(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{ min: 0 }}
              error={parseInt(min) > parseInt(max)}
            />
            <TextField 
              label="Max" 
              type="number" 
              value={max} 
              onChange={(e) => setMax(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{ min: 0 }}
              error={parseInt(min) > parseInt(max)}
            />
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Cible</InputLabel>
              <Select value={target} onChange={(e) => setTarget(e.target.value as string)}>
                <MenuItem value="slot">Slot</MenuItem>
                <MenuItem value="day">Jour</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </>
      )}

      {constraintType === 'resource_exclusivity' && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type ressource *</InputLabel>
            <Select 
              value={resourceType} 
              onChange={(e) => setResourceType(e.target.value as string)}
              label="Type ressource *"
            >
              <MenuItem value="" disabled>Choisir...</MenuItem>
              {resourceTypes.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Min/Max + Scope comme ci-dessus */}
        </>
      )}

      <Button 
        onClick={validateAndAdd} 
        variant="contained" 
        startIcon={<AddIcon />}
        disabled={hasFormErrors()}
        sx={{ mt: 2 }}
      >
        Ajouter contrainte
      </Button>

      {/* Erreurs */}
      {localErrors && (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }} onClose={() => setLocalErrors('')}>
          {localErrors}
        </Alert>
      )}

      {/* Liste des contraintes */}
      <Typography variant="h6" sx={{ mt: 4 }}>
        Contraintes ({totalConstraints})
      </Typography>
      
      {totalConstraints > 0 ? (
        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
          {data.constraints.map((constraint: any, index: number) => (
            <ListItem 
              key={index} 
              secondaryAction={
                <IconButton onClick={() => removeConstraint(index)} size="small">
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText 
                primary={constraint.description || constraint.type.replace('_', ' ')} 
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {constraint.activity && `Activité: ${constraint.activity}`}
                      {constraint.resourceType && `Type: ${constraint.resourceType}`}
                      {constraint.min !== undefined && constraint.max !== undefined && 
                        ` [${constraint.min}-${constraint.max}]`}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Aucune contrainte</strong><br/>
          Cliquez sur "Générer contraintes par défaut" ou ajoutez manuellement
        </Alert>
      )}

    </div>
  );
};

export default ConstraintsStep;
