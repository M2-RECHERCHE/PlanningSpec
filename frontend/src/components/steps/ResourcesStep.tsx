import React, { useState } from 'react';
import { 
  TextField, IconButton, Chip, Typography, Box, Alert
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import { PlanningData } from '../../model/Planning';

interface Props {
  data: PlanningData;
  onUpdate: (data: PlanningData) => void;
}

const ResourcesStep: React.FC<Props> = ({ data, onUpdate }) => {
  const [resourceType, setResourceType] = useState('');
  const [resourceNames, setResourceNames] = useState(''); // Plusieurs noms séparés par virgule
  const [localErrors, setLocalErrors] = useState<string>('');

  // Calcul total des ressources
  const totalResources = Object.values(data.resources || {}).reduce(
    (acc: number, resources: string[]) => acc + (resources?.length || 0), 0
  );
  const isStepValid = totalResources > 0;

  const validateAndAdd = () => {
    const errors: string[] = [];

    // Validation type
    if (!resourceType.trim()) {
      errors.push("Type de ressource requis");
    }

    // Validation noms
    const names = resourceNames
      .split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (names.length === 0) {
      errors.push("Au moins un nom de ressource requis");
    }

    // Vérifier que chaque nom n’existe pas déjà pour ce type
    const existingResources = data.resources[resourceType.trim()] || [];
    const duplicates = names.filter(n => existingResources.includes(n));
    if (duplicates.length > 0) {
      errors.push(`Ressource(s) déjà existante(s) pour ce type : ${duplicates.join(', ')}`);
    }

    // Validation doublon global
    const allResources = Object.values(data.resources || {}).flat();
    const globalDuplicates = names.filter(n => allResources.includes(n));
    if (globalDuplicates.length > 0) {
      errors.push(`Nom(s) de ressource(s) dupliqué(s) : ${globalDuplicates.join(', ')}`);
    }

    if (errors.length > 0) {
      setLocalErrors(errors.join(", "));
      return;
    }

    // Ajout valide
    const newResources = {
      ...data.resources,
      [resourceType.trim()]: [
        ...(data.resources[resourceType.trim()] || []),
        ...names
      ]
    };
    onUpdate({ ...data, resources: newResources });
    
    // Reset
    setResourceNames('');
    setLocalErrors('');
  };

  const removeResource = (type: string, name: string) => {
    const newResources = {
      ...data.resources,
      [type]: (data.resources[type] || []).filter((r: string) => r !== name)
    };
    // Nettoyer les types vides
    const cleanedResources = { ...newResources };
    if (newResources[type]?.length === 0) {
      delete cleanedResources[type];
    }
    onUpdate({ ...data, resources: cleanedResources });
  };

  // Validation temps réel
  const getFieldErrors = () => {
    const errors: string[] = [];
    
    if (!resourceType.trim() && resourceType.length > 0) {
      errors.push("Type requis");
    }
    
    const names = resourceNames
      .split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (!resourceNames && resourceNames.length > 0 && names.length === 0) {
      errors.push("Nom(s) requis");
    }
    
    return errors;
  };

  const fieldErrors = getFieldErrors();

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Ressources <span className="text-red-500 font-semibold">*</span>
      </Typography>
      
      {/* Formulaire avec validation inline */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="Type (ex: Room, Teacher, Student) *"
          value={resourceType}
          onChange={(e) => {
            setResourceType(e.target.value);
            if (localErrors.includes("Type")) setLocalErrors('');
          }}
          error={!!fieldErrors.find(e => e.includes("Type"))}
          helperText={
            fieldErrors.find(e => e.includes("Type")) || 
            "Ex: Room, Teacher, Student"
          }
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
        />
        
        <TextField
          label="Noms (ex: Salle_A, Salle_B, Salle_C) *"
          value={resourceNames}
          onChange={(e) => {
            setResourceNames(e.target.value);
            if (localErrors.includes("Nom")) setLocalErrors('');
          }}
          error={!!fieldErrors.find(e => e.includes("Nom"))}
          helperText={
            fieldErrors.find(e => e.includes("Nom")) || 
            "Noms séparés par virgule"
          }
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          multiline
          rows={2}
        />
        
        <IconButton 
          onClick={validateAndAdd} 
          color="primary" 
          size="large"
          disabled={fieldErrors.length > 0 || !resourceType.trim() || !resourceNames.trim()}
        >
          <AddIcon />
        </IconButton>
      </Box>

      {/* Erreur globale d'ajout */}
      {localErrors && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLocalErrors('')}>
          {localErrors}
        </Alert>
      )}

      {/* Liste des ressources */}
      <Typography variant="h6" gutterBottom>
        Ressources définies ({totalResources})
      </Typography>
      
      {totalResources > 0 ? (
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {Object.entries(data.resources || {}).map(([type, resources]: any) => (
            resources && resources.length > 0 && (
              <div key={type}>
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                  {type} ({resources.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {resources.map((name: string) => (
                    <Chip
                      key={name}
                      label={name}
                      onDelete={() => removeResource(type, name)}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ 
                        '& .MuiChip-deleteIcon': { 
                          color: 'text.secondary !important' 
                        }
                      }}
                    />
                  ))}
                </Box>
              </div>
            )
          ))}
        </Box>
      ) : (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Aucune ressource</strong><br/>
          Ajoutez au moins 1 ressource (type + nom) pour continuer
        </Alert>
      )}

      {/* Aide utilisateur */}
      <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
        <strong>Exemples :</strong><br/>
        • Room → Salle_A, Salle_B<br/>
        • Teacher → Dr_Mathieu, Dr_Physique<br/>
        • Student → Etudiant_1, Etudiant_2
      </Alert>
    </div>
  );
};

export default ResourcesStep;
