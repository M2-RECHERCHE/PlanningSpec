import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemText,
  FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert, Chip
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import { PlanningData } from '../../model/Planning';
import { api } from '../../lib/api';

interface AvailableSolver {
  id: string;
  label: string;
  isDefault: boolean;
}

interface Props {
  data: PlanningData;
  selectedSolver: string;
  onSolverChange: (solver: string) => void;
}

const SummaryStep: React.FC<Props> = ({ data, selectedSolver, onSolverChange }) => {
  const [solvers, setSolvers] = useState<AvailableSolver[]>([]);
  const [loadingSolvers, setLoadingSolvers] = useState(true);

  useEffect(() => {
    api
      .get<{ data: { solvers: AvailableSolver[] } }>('/api/solvers')
      .then((res: { data: { data: { solvers: AvailableSolver[] } } }) => {
        const list = res.data.data.solvers;
        setSolvers(list);
        // Sélectionner le solveur par défaut si aucun n'est encore choisi
        if (!selectedSolver && list.length > 0) {
          const def = list.find((s: AvailableSolver) => s.isDefault) ?? list[0];
          onSolverChange(def.id);
        }
      })
      .catch(() => {
        // En cas d'erreur, garder le solveur déjà sélectionné
      })
      .finally(() => setLoadingSolvers(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Résumé de votre planification</Typography>

      {/* Temps */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>Temps</Typography>
        <Typography variant="body2">
          {data.time.days.length} jour{data.time.days.length > 1 ? 's' : ''} : {data.time.days.join(', ')}
        </Typography>
        <Typography variant="body2">{data.time.slotsPerDay} créneau{data.time.slotsPerDay > 1 ? 'x' : ''} par jour</Typography>
      </Paper>

      {/* Activités */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Activités ({Object.keys(data.activities).length})
        </Typography>
        <List dense disablePadding>
          {Object.entries(data.activities).map(([name, activity]: [string, any]) => (
            <ListItem key={name} disableGutters>
              <ListItemText
                primary={name}
                secondary={`${activity.count} instance${activity.count > 1 ? 's' : ''} · durée ${activity.duration} créneau${activity.duration > 1 ? 'x' : ''}`}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Ressources */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>Ressources</Typography>
        {Object.entries(data.resources || {}).map(([type, instances]: [string, any]) => (
          <Box key={type} sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>{type}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {(instances as string[]).map(r => <Chip key={r} label={r} size="small" />)}
            </Box>
          </Box>
        ))}
      </Paper>

      {/* Rôles */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>Rôles</Typography>
        {Object.entries(data.roles).map(([activity, roles]: [string, any]) => (
          <Box key={activity} sx={{ mb: 1 }}>
            <Typography variant="body2" fontWeight={500}>{activity}</Typography>
            {Object.entries(roles).map(([role, type]: [string, any]) => type && (
              <Typography key={role} variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                · {role} → {type}
              </Typography>
            ))}
          </Box>
        ))}
      </Paper>

      {/* Contraintes & préférences */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>Règles</Typography>
        <Typography variant="body2">
          {data.constraints.length} contrainte{data.constraints.length > 1 ? 's' : ''}
          {' · '}
          {(data.preferences ?? []).length} préférence{(data.preferences ?? []).length > 1 ? 's' : ''}
        </Typography>
      </Paper>

      {/* Sélecteur de solveur */}
      <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'primary.light' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TuneIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>Solveur de résolution</Typography>
        </Box>

        {loadingSolvers ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">Détection des solveurs…</Typography>
          </Box>
        ) : solvers.length === 0 ? (
          <Alert severity="warning" sx={{ py: 0.5 }}>
            Impossible de détecter les solveurs disponibles. Highs sera utilisé par défaut.
          </Alert>
        ) : (
          <>
            <FormControl fullWidth size="small">
              <InputLabel>Solveur</InputLabel>
              <Select
                value={selectedSolver}
                onChange={e => onSolverChange(e.target.value)}
                label="Solveur"
              >
                {solvers.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Highs est recommandé pour les problèmes de planification. Gecode et Chuffed sont adaptés aux problèmes combinatoires.
            </Typography>
          </>
        )}
      </Paper>

      <Box sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
        <Typography variant="body2" color="success.dark">
          Tout est prêt. Cliquez sur <strong>Planifier / Résoudre</strong> pour lancer la résolution.
        </Typography>
      </Box>
    </Box>
  );
};

export default SummaryStep;
