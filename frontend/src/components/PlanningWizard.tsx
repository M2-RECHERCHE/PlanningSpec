import React, { useState, useMemo } from 'react';
import { Stepper, Step, StepLabel, Button, Box, Typography } from '@mui/material';
import axios from 'axios';
import { PlanningData } from '../model/Planning';
import TimeStep from './steps/TimeStep';
import ActivitiesStep from './steps/ActivitiesStep';
import ResourcesStep from './steps/ResourcesStep';
import RolesStep from './steps/RolesStep';
import ConstraintsStep from './steps/ConstraintsStep';
import PreferencesStep from './steps/PreferencesStep';
import SummaryStep from './steps/SummaryStep';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:4000';

const PlanningWizard: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [data, setData] = useState<PlanningData>({
    time: { days: [], slotsPerDay: 0 },
    activities: {},
    resources: {},
    roles: {},
    constraints: [],
    preferences: []
  });
  const [result, setResult] = useState<string>('');

  const steps = [
    { title: 'Temps', component: <TimeStep key="time" data={data} onUpdate={setData} /> },
    { title: 'Activités', component: <ActivitiesStep key="activities" data={data} onUpdate={setData} /> },
    { title: 'Ressources', component: <ResourcesStep key="resources" data={data} onUpdate={setData} /> },
    { title: 'Rôles', component: <RolesStep key="roles" data={data} onUpdate={setData} /> },
    { title: 'Contraintes', component: <ConstraintsStep key="constraints" data={data} onUpdate={setData} /> },
    { title: 'Préférences', component: <PreferencesStep key="prefs" data={data} onUpdate={setData} /> },
    { title: 'Résumé', component: <SummaryStep key="summary" data={data} /> }
  ];

  // ✅ Validation seulement pour les étapes 0 à 4
  const stepValidations = {
    0: () => data.time.days.length > 0 && data.time.slotsPerDay > 0, // Temps
    1: () => Object.keys(data.activities).length > 0, // Activités
    2: () => Object.values(data.resources).some((r: string[]) => r.length > 0), // Ressources
    3: () => Object.keys(data.roles).length > 0, // Rôles
    4: () => data.constraints.length > 0, // Contraintes
    5: () => true // Préférences optionnelles
  };

  // ✅ Calcul si "Suivant" doit être désactivé
  const isNextDisabled = useMemo(() => {
    // Pour l’étape Résumé, on ne valide plus : on veut juste afficher le bouton "Planifier"
    if (activeStep === steps.length - 1) {
      return false;
    }
    const validator = stepValidations[activeStep as keyof typeof stepValidations];
    return !validator();
  }, [data, activeStep]);

  const handleNext = () => {
    // Si on est déjà sur Résumé, on ne fait rien ici
    if (activeStep === steps.length - 1) {
      return;
    }
    const validator = stepValidations[activeStep as keyof typeof stepValidations];
    if (validator()) {
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSolve = async () => {
    try {
      const response = await axios.post(`${apiBaseUrl}/api/solve`, {
        source: JSON.stringify(data, null, 2)
      });

      if (response.data.ok) {
        setResult(response.data.output);
      } else {
        setResult(`Erreur : ${response.data.error}`);
      }
    } catch (error: any) {
      setResult(`Erreur réseau : ${error.message}`);
    }
  };

  const currentStep = steps[activeStep];

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((step) => (
          <Step key={step.title}>
            <StepLabel>{step.title}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ p: 3, border: '1px solid #ddd', borderRadius: 2 }}>
        {currentStep.component}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          variant="outlined"
          disabled={activeStep === 0}
          onClick={handleBack}
        >
          Précédent
        </Button>

        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSolve}
          >
            Planifier / Résoudre
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isNextDisabled}
          >
            Suivant
          </Button>
        )}
      </Box>

      {result && (
        <Box sx={{ mt: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="h6">Résultat :</Typography>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{result}</pre>
        </Box>
      )}
    </Box>
  );
};

export default PlanningWizard;
