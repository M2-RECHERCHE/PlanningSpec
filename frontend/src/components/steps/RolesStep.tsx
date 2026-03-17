import React, { useState } from 'react';
import { 
  TextField, List, ListItem, ListItemText, IconButton, 
  Select, MenuItem, FormControl, InputLabel, 
  Typography, Box, Alert 
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface Props {
  data: any;
  onUpdate: (data: any) => void;
}

const RolesStep: React.FC<Props> = ({ data, onUpdate }) => {
  const [activity, setActivity] = useState('');
  const [role, setRole] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [localErrors, setLocalErrors] = useState<string>('');

  const activities = Object.keys(data.activities || {});
  const resourceTypes = Object.keys(data.resources || {});

  // Vérification globale de l'étape
  const validRolesCount = Object.entries(data.roles || {}).filter(([act, roles]: any) => 
    Object.values(roles).filter(Boolean).length > 0
  ).length;

  const validateAndAdd = () => {
    const errors: string[] = [];

    // Validation activité
    if (!activity) {
      errors.push("Activité requise");
    } else if (!activities.includes(activity)) {
      errors.push("Activité non définie dans l'étape précédente");
    }

    // Validation rôle
    if (!role.trim()) {
      errors.push("Nom du rôle requis");
    }

    // Validation type ressource
    if (!resourceType) {
      errors.push("Type de ressource requis");
    } else if (!resourceTypes.includes(resourceType)) {
      errors.push("Type de ressource non défini");
    }

    // Vérification doublon rôle pour cette activité
    if (activity && role && data.roles[activity]?.[role]) {
      errors.push("Ce rôle existe déjà pour cette activité");
    }

    if (errors.length > 0) {
      setLocalErrors(errors.join(", "));
      return;
    }

    // Ajout valide
    const newRoles = {
      ...data.roles,
      [activity]: {
        ...data.roles[activity],
        [role]: resourceType
      }
    };
    onUpdate({ ...data, roles: newRoles });
    
    // Reset formulaire
    setRole('');
    setResourceType('');
    setLocalErrors('');
  };

  const removeRole = (activity: string, roleName: string) => {
    const newRoles = {
      ...data.roles,
      [activity]: {
        ...data.roles[activity],
        [roleName]: undefined
      }
    };
    onUpdate({ ...data, roles: newRoles });
  };

  // Validation en temps réel
  const getFieldErrors = () => {
    const errors: string[] = [];
    
    if (!activity && activity !== '') errors.push("Activité requise");
    if (!role.trim() && role.length > 0) errors.push("Rôle requis");
    if (!resourceType && resourceType !== '') errors.push("Type requis");
    
    return errors;
  };

  const fieldErrors = getFieldErrors();

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Rôles <span className="text-red-500 font-semibold">*</span>
      </Typography>
      
      {/* Formulaire avec Select pour activité */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {/* Select Activité OBLIGATOIRE */}
        <FormControl 
          size="small" 
          sx={{ flex: 1, minWidth: 180 }}
          error={!!fieldErrors.find(e => e.includes("Activité"))}
        >
          <InputLabel>Activité *</InputLabel>
          <Select
            value={activity}
            onChange={(e) => {
              setActivity(e.target.value as string);
              if (localErrors.includes("Activité")) setLocalErrors('');
            }}
            label="Activité *"
          >
            <MenuItem value="" disabled>
              <em>Choisir une activité</em>
            </MenuItem>
            {activities.length === 0 ? (
              <MenuItem disabled>Aucune activité définie</MenuItem>
            ) : (
              activities.map((act) => (
                <MenuItem key={act} value={act}>{act}</MenuItem>
              ))
            )}
          </Select>
          {fieldErrors.find(e => e.includes("Activité")) && (
            <Typography variant="caption" color="error">
              Activité requise
            </Typography>
          )}
        </FormControl>

        {/* Rôle */}
        <TextField
          label="Rôle (ex: President, Reporter)"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            if (localErrors.includes("Rôle")) setLocalErrors('');
          }}
          error={!!fieldErrors.find(e => e.includes("Rôle"))}
          helperText={fieldErrors.find(e => e.includes("Rôle")) || "Ex: President, Member"}
          size="small"
          sx={{ flex: 1, minWidth: 150 }}
        />

        {/* Select Type Ressource */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type de ressource *</InputLabel>
          <Select
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value as string);
              if (localErrors.includes("Type")) setLocalErrors('');
            }}
            label="Type de ressource *"
            error={!!fieldErrors.find(e => e.includes("Type"))}
          >
            <MenuItem value="" disabled>
              <em>Choisir un type</em>
            </MenuItem>
            {resourceTypes.length === 0 ? (
              <MenuItem disabled>Aucun type défini</MenuItem>
            ) : (
              resourceTypes.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {/* Bouton Add avec validation */}
        <IconButton 
          onClick={validateAndAdd} 
          color="primary" 
          size="large"
          disabled={fieldErrors.length > 0 || !activity || !role || !resourceType}
        >
          <AddIcon />
        </IconButton>
      </Box>

      {/* Erreur globale */}
      {localErrors && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLocalErrors('')}>
          {localErrors}
        </Alert>
      )}

      {/* Liste des rôles */}
      <Typography variant="h6" gutterBottom>
        Rôles définis ({validRolesCount})
      </Typography>
      
      {validRolesCount > 0 ? (
        Object.entries(data.roles || {}).map(([act, roles]: any) => (
          Object.values(roles).filter(Boolean).length > 0 && (
            <div key={act}>
              <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 'bold' }}>
                {act}
              </Typography>
              <List dense>
                {Object.entries(roles).map(([roleName, type]: any) => 
                  type && (
                    <ListItem 
                      key={roleName} 
                      secondaryAction={
                        <IconButton 
                          onClick={() => removeRole(act, roleName)} 
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText 
                        primary={`${roleName}`} 
                        secondary={`Type: ${type}`} 
                      />
                    </ListItem>
                  )
                )}
              </List>
            </div>
          )
        ))
      ) : (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Aucun rôle défini</strong><br/>
          Définissez au moins 1 rôle pour 1 activité pour continuer
        </Alert>
      )}

    </div>
  );
};

export default RolesStep;
