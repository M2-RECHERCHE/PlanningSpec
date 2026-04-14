import React, { useState } from 'react';
import {
  TextField, Button, List, ListItem, ListItemText, IconButton,
  Select, MenuItem, FormControl, InputLabel,
  Typography, Box, Alert, Chip, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { PlanningData } from '../../model/Planning';

interface Props {
  data: PlanningData;
  onUpdate: (data: PlanningData) => void;
}

const PREFERENCE_DESCRIPTIONS: Record<string, string> = {
  avoid_participation_on_date:
    'Évite d\'affecter une ressource à une activité un jour donné. Le solveur cherchera à minimiser ces participations selon le poids défini.',
  max_per_scope:
    'Limite (souple) le nombre de participations d\'un type de ressource à une activité par créneau ou par journée.',
};

const PreferencesStep: React.FC<Props> = ({ data, onUpdate }) => {
  const [prefType, setPrefType] = useState('avoid_participation_on_date');
  const [resource, setResource] = useState('');
  const [day, setDay] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [activity, setActivity] = useState('');
  const [scope, setScope] = useState('day');
  const [max, setMax] = useState('2');
  const [weight, setWeight] = useState('1');
  const [localErrors, setLocalErrors] = useState<string>('');

  const resourceTypes = Object.keys(data.resources || {});
  const activities = Object.keys(data.activities || {});
  const allResources = Object.values(data.resources || {}).flat() as string[];
  // Les jours sont définis dans data.time.days — même format utilisé par le solveur
  const availableDays: string[] = (data.time?.days as string[]) ?? [];

  const totalPreferences = data.preferences?.length || 0;

  const validateAndAdd = () => {
    const errors: string[] = [];
    const weightNum = parseInt(weight);

    if (isNaN(weightNum) || weightNum <= 0) errors.push('Poids doit être > 0');

    if (prefType === 'avoid_participation_on_date') {
      if (!resource) errors.push('Ressource requise');
      if (!day) errors.push('Jour requis');
    } else if (prefType === 'max_per_scope') {
      if (!resourceType) errors.push('Type de ressource requis');
      if (!activity) errors.push('Activité requise');
      const maxNum = parseInt(max);
      if (isNaN(maxNum) || maxNum <= 0) errors.push('Max doit être > 0');
    }

    if (errors.length > 0) {
      setLocalErrors(errors.join(' · '));
      return;
    }

    const newPref: any = { type: prefType, weight: parseInt(weight) };

    if (prefType === 'avoid_participation_on_date') {
      newPref.resource = resource;
      // On stocke le nom du jour directement (même valeur qu'utilisée dans data.time.days)
      newPref.date = day;
    } else if (prefType === 'max_per_scope') {
      newPref.resourceType = resourceType;
      newPref.activity = activity;
      newPref.scope = scope;
      newPref.max = parseInt(max);
    }

    onUpdate({ ...data, preferences: [...(data.preferences || []), newPref] });

    // Reset
    setResource('');
    setDay('');
    setResourceType('');
    setActivity('');
    setScope('day');
    setMax('2');
    setWeight('1');
    setLocalErrors('');
  };

  const removePreference = (index: number) => {
    const updated = (data.preferences || []).filter((_: any, i: number) => i !== index);
    onUpdate({ ...data, preferences: updated });
  };

  const formatPrefLabel = (p: any): string => {
    if (p.type === 'avoid_participation_on_date') {
      return `${p.resource} évite le ${p.date} (poids: ${p.weight})`;
    }
    if (p.type === 'max_per_scope') {
      return `${p.resourceType} / ${p.activity} : max ${p.max} par ${p.scope} (poids: ${p.weight})`;
    }
    return p.type;
  };

  const hasFormErrors = (): boolean => {
    if (parseInt(weight) <= 0 || isNaN(parseInt(weight))) return true;
    if (prefType === 'avoid_participation_on_date') return !resource || !day;
    if (prefType === 'max_per_scope') return !resourceType || !activity;
    return false;
  };

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Préférences <span style={{ color: '#3b82f6', fontWeight: 600 }}>(optionnel)</span>
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Les préférences sont des <strong>contraintes souples</strong> — le solveur les respectera autant que possible
        selon leur poids, mais elles ne bloquent pas la résolution.
      </Alert>

      {/* Type de préférence */}
      <FormControl fullWidth sx={{ mb: 1 }}>
        <InputLabel>Type de préférence</InputLabel>
        <Select
          value={prefType}
          onChange={e => { setPrefType(e.target.value); setLocalErrors(''); }}
          label="Type de préférence"
        >
          <MenuItem value="avoid_participation_on_date">Éviter un jour pour une ressource</MenuItem>
          <MenuItem value="max_per_scope">Limiter les participations par période</MenuItem>
        </Select>
      </FormControl>

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2, py: 0.5 }}>
        {PREFERENCE_DESCRIPTIONS[prefType]}
      </Alert>

      {/* ── Éviter participation ── */}
      {prefType === 'avoid_participation_on_date' && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Ressource *</InputLabel>
            <Select value={resource} onChange={e => setResource(e.target.value)} label="Ressource *">
              <MenuItem value="" disabled>Choisir une ressource…</MenuItem>
              {allResources.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Jour à éviter *</InputLabel>
            <Select value={day} onChange={e => setDay(e.target.value)} label="Jour à éviter *">
              <MenuItem value="" disabled>Choisir un jour…</MenuItem>
              {availableDays.length > 0
                ? availableDays.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)
                : <MenuItem disabled>Aucun jour défini (étape Temps)</MenuItem>}
            </Select>
          </FormControl>
        </>
      )}

      {/* ── Maximum par portée ── */}
      {prefType === 'max_per_scope' && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type de ressource *</InputLabel>
            <Select value={resourceType} onChange={e => setResourceType(e.target.value)} label="Type de ressource *">
              <MenuItem value="" disabled>Choisir un type…</MenuItem>
              {resourceTypes.map(rt => <MenuItem key={rt} value={rt}>{rt}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Activité *</InputLabel>
            <Select value={activity} onChange={e => setActivity(e.target.value)} label="Activité *">
              <MenuItem value="" disabled>Choisir une activité…</MenuItem>
              {activities.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Maximum *" type="number" value={max}
              onChange={e => setMax(e.target.value)} size="small" sx={{ flex: 1 }}
              inputProps={{ min: 1 }} helperText="Nombre max de participations"
            />
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Portée</InputLabel>
              <Select value={scope} onChange={e => setScope(e.target.value)} label="Portée">
                <MenuItem value="day">Par journée</MenuItem>
                <MenuItem value="slot">Par créneau</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </>
      )}

      {/* Poids */}
      <TextField
        label="Poids (importance)"
        type="number"
        value={weight}
        onChange={e => setWeight(e.target.value)}
        size="small"
        sx={{ mb: 2, width: 180 }}
        inputProps={{ min: 1 }}
        error={parseInt(weight) <= 0}
        helperText="Plus élevé = plus prioritaire"
      />

      <Box sx={{ display: 'block' }}>
        <Button
          onClick={validateAndAdd}
          variant="contained"
          startIcon={<AddIcon />}
          disabled={hasFormErrors()}
        >
          Ajouter la préférence
        </Button>
      </Box>

      {localErrors && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setLocalErrors('')}>
          {localErrors}
        </Alert>
      )}

      {/* Liste */}
      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
        Préférences définies
        <Chip label={totalPreferences} size="small" sx={{ ml: 1 }} color={totalPreferences > 0 ? 'primary' : 'default'} />
      </Typography>

      {totalPreferences > 0 ? (
        <List sx={{ maxHeight: 240, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
          {data.preferences.map((p: any, index: number) => (
            <ListItem
              key={index}
              divider
              secondaryAction={
                <Tooltip title="Supprimer">
                  <IconButton onClick={() => removePreference(index)} size="small" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemText
                primary={formatPrefLabel(p)}
                secondary={p.type.replaceAll('_', ' ')}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Alert severity="info">
          Aucune préférence ajoutée — cette étape est optionnelle.
        </Alert>
      )}
    </div>
  );
};

export default PreferencesStep;
