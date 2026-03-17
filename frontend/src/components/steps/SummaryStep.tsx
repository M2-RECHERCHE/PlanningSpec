import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';
import { PlanningData } from '../../model/Planning';

interface Props {
  data: PlanningData;
}

const SummaryStep: React.FC<Props> = ({ data }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>Résumé de votre planification</Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Temps</Typography>
        <Typography>Jours: {data.time.days.length}, Slots/jour: {data.time.slotsPerDay}</Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Activités ({Object.keys(data.activities).length})</Typography>
        <List dense>
          {Object.entries(data.activities).map(([name, activity]: any) => (
            <ListItem key={name}>
              <ListItemText 
                primary={name} 
                secondary={`Count: ${activity.count}, Durée: ${activity.duration}`} 
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Rôles</Typography>
        {Object.entries(data.roles).map(([activity, roles]: any) => (
          <div key={activity}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1 }}>{activity}:</Typography>
            {Object.entries(roles).map(([role, type]: any) => type && (
              <Typography key={role} variant="body2">{role}: {type}</Typography>
            ))}
          </div>
        ))}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Contraintes: {data.constraints.length}</Typography>
        <Typography variant="body2">Préférences: {data.preferences.length}</Typography>
      </Paper>

      <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="body1">
          Données prêtes pour planification ! Cliquez sur "Planifier / Résoudre" pour envoyer au backend.
        </Typography>
      </Box>
    </Box>
  );
};

export default SummaryStep;
