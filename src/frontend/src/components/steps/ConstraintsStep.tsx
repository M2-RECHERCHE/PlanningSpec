import React, { useState, useCallback } from 'react';
import {
  TextField, Button, List, ListItem, ListItemText, IconButton,
  Select, MenuItem, FormControl, InputLabel,
  Typography, Box, Alert, Chip, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import BuildIcon from '@mui/icons-material/Build';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface Props {
  data: any;
  onUpdate: (data: any) => void;
}

// Descriptions affichées à l'utilisateur pour chaque type de contrainte
const CONSTRAINT_DESCRIPTIONS: Record<string, string> = {
  cardinality_per_activity:
    'Définit combien de ressources (ou personnes remplissant un rôle) sont nécessaires pour une activité. Ex : chaque soutenance nécessite exactement 1 président.',
  resource_exclusivity:
    'Empêche une ressource d\'être utilisée en même temps par plusieurs activités. Ex : une salle ne peut pas accueillir deux soutenances au même créneau.',
  fixed_assignment:
    'Force l\'affectation d\'une ressource précise à une instance d\'activité. Ex : T1 est toujours président de Soutenance_1.',
  forbidden_assignment:
    'Interdit l\'affectation d\'une ressource précise à une instance d\'activité. Ex : T2 ne peut pas être jury de Soutenance_3.',
  resource_required_day:
    'Force toutes les participations d\'une ressource à se dérouler sur un jour précis. Ex : un enseignant externe passe uniquement le dimanche.',
  resource_single_day:
    'Force toutes les participations d\'une ressource à être regroupées sur une seule journée, sans préciser laquelle.',
};

const SCOPE_LABELS: Record<string, string> = {
  slot: 'Créneau (slot)',
  day: 'Journée',
};

const ConstraintsStep: React.FC<Props> = ({ data, onUpdate }) => {
  const [constraintType, setConstraintType] = useState('cardinality_per_activity');
  const [activity, setActivity] = useState('');
  const [role, setRole] = useState('');
  const [targetMode, setTargetMode] = useState<'role' | 'resourceType' | 'slot'>('role');
  const [resourceType, setResourceType] = useState('');
  const [scope, setScope] = useState('slot');
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('1');
  const [activityInstance, setActivityInstance] = useState('');
  const [resource, setResource] = useState('');
  const [day, setDay] = useState('');
  const [localErrors, setLocalErrors] = useState<string>('');

  const activities = Object.keys(data.activities || {});
  const resourceTypes = Object.keys(data.resources || {});
  const rolesByActivity: Record<string, Record<string, string>> = data.roles || {};

  // Instances d'activités disponibles (ex: Soutenance_1, Soutenance_2)
  const activityInstances: string[] = [];
  Object.entries(data.activities || {}).forEach(([name, act]: [string, any]) => {
    for (let i = 1; i <= (act.count ?? 1); i++) {
      activityInstances.push(`${name}_${i}`);
    }
  });

  const allResources = Object.values(data.resources || {}).flat() as string[];
  const availableDays: string[] = (data.time?.days as string[]) ?? [];
  const totalConstraints = data.constraints?.length || 0;

  // Rôles disponibles pour l'activité sélectionnée
  const rolesForActivity = activity ? Object.keys(rolesByActivity[activity] || {}) : [];

  const generateDefaultConstraints = useCallback(() => {
    const defaults: any[] = [];

    activities.forEach(act => {
      // Cardinalité slot (1 créneau par instance)
      defaults.push({ type: 'cardinality_per_activity', activity: act, target: 'slot', min: 1, max: 1 });

      // Cardinalité salle si Room existe
      if (resourceTypes.includes('Room')) {
        defaults.push({ type: 'cardinality_per_activity', activity: act, target: 'Room', min: 1, max: 1 });
      }

      // Cardinalité par rôle
      const actRoles = rolesByActivity[act] || {};
      Object.keys(actRoles).forEach(roleName => {
        defaults.push({ type: 'cardinality_per_activity', activity: act, role: roleName, min: 1, max: 1 });
      });
    });

    // Exclusivité par créneau pour les types courants
    ['Teacher', 'Room'].forEach(rt => {
      if (resourceTypes.includes(rt) && activities.length > 0) {
        defaults.push({
          type: 'resource_exclusivity',
          resourceType: rt,
          activity: activities[0],
          scope: 'slot',
          max: 1
        });
      }
    });

    onUpdate({ ...data, constraints: [...(data.constraints || []), ...defaults] });
  }, [data, onUpdate, activities, resourceTypes, rolesByActivity]);

  const resetForm = () => {
    setActivity('');
    setRole('');
    setTargetMode('role');
    setResourceType('');
    setScope('slot');
    setMin('1');
    setMax('1');
    setActivityInstance('');
    setResource('');
    setDay('');
    setLocalErrors('');
  };

  const validateAndAdd = () => {
    const errors: string[] = [];
    const minVal = parseInt(min);
    const maxVal = parseInt(max);

    if (minVal > maxVal) errors.push('Min doit être ≤ Max');
    if (minVal < 0 || maxVal < 0) errors.push('Les valeurs doivent être ≥ 0');

    switch (constraintType) {
      case 'cardinality_per_activity':
        if (!activity) errors.push('Activité requise');
        if (targetMode === 'role' && !role) errors.push('Rôle requis');
        if (targetMode === 'resourceType' && !resourceType) errors.push('Type de ressource requis');
        break;
      case 'resource_exclusivity':
        if (!resourceType) errors.push('Type de ressource requis');
        if (!activity) errors.push('Activité requise');
        break;
      case 'fixed_assignment':
      case 'forbidden_assignment':
        if (!activityInstance) errors.push('Instance d\'activité requise');
        if (!role) errors.push('Rôle requis');
        if (!resource) errors.push('Ressource requise');
        break;
      case 'resource_required_day':
        if (!resource) errors.push('Ressource requise');
        if (!day) errors.push('Jour requis');
        break;
      case 'resource_single_day':
        if (!resource) errors.push('Ressource requise');
        break;
    }

    if (errors.length > 0) {
      setLocalErrors(errors.join(' · '));
      return;
    }

    const newConstraint: any = { type: constraintType };

    if (constraintType === 'cardinality_per_activity') {
      newConstraint.activity = activity;
      newConstraint.min = minVal;
      newConstraint.max = maxVal;
      if (targetMode === 'role') {
        newConstraint.role = role;
      } else if (targetMode === 'resourceType') {
        newConstraint.target = resourceType;
      } else {
        newConstraint.target = 'slot';
      }
    }

    if (constraintType === 'resource_exclusivity') {
      newConstraint.resourceType = resourceType;
      newConstraint.activity = activity;
      newConstraint.scope = scope;
      newConstraint.max = maxVal;
    }

    if (constraintType === 'fixed_assignment' || constraintType === 'forbidden_assignment') {
      newConstraint.activityInstance = activityInstance;
      newConstraint.role = role;
      newConstraint.resource = resource;
    }

    if (constraintType === 'resource_required_day') {
      newConstraint.resource = resource;
      newConstraint.date = day;
    }

    if (constraintType === 'resource_single_day') {
      newConstraint.resource = resource;
    }

    onUpdate({ ...data, constraints: [...(data.constraints || []), newConstraint] });
    resetForm();
  };

  const removeConstraint = (index: number) => {
    const updated = (data.constraints || []).filter((_: any, i: number) => i !== index);
    onUpdate({ ...data, constraints: updated });
  };

  const formatConstraintLabel = (c: any): string => {
    switch (c.type) {
      case 'cardinality_per_activity':
        if (c.role) return `${c.activity} — rôle "${c.role}" : ${c.min}–${c.max}`;
        if (c.target === 'slot') return `${c.activity} — 1 créneau par instance`;
        return `${c.activity} — ressource "${c.target}" : ${c.min}–${c.max}`;
      case 'resource_exclusivity':
        return `${c.resourceType} — max ${c.max} par ${SCOPE_LABELS[c.scope] ?? c.scope} pour "${c.activity}"`;
      case 'fixed_assignment':
        return `${c.activityInstance} : "${c.role}" = ${c.resource} (fixé)`;
      case 'forbidden_assignment':
        return `${c.activityInstance} : "${c.role}" ≠ ${c.resource} (interdit)`;
      case 'resource_required_day':
        return `${c.resource} uniquement le ${c.date}`;
      case 'resource_single_day':
        return `${c.resource} regroupé sur une seule journée`;
      default:
        return c.type;
    }
  };

  const hasFormErrors = (): boolean => {
    if (parseInt(min) > parseInt(max)) return true;
    if (constraintType === 'cardinality_per_activity' && !activity) return true;
    if (constraintType === 'resource_exclusivity' && (!resourceType || !activity)) return true;
    if (['fixed_assignment', 'forbidden_assignment'].includes(constraintType)
      && (!activityInstance || !role || !resource)) return true;
    if (constraintType === 'resource_required_day' && (!resource || !day)) return true;
    if (constraintType === 'resource_single_day' && !resource) return true;
    return false;
  };

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Contraintes <span style={{ color: '#ef4444', fontWeight: 600 }}>*</span>
      </Typography>

      <Button
        onClick={generateDefaultConstraints}
        variant="outlined"
        startIcon={<BuildIcon />}
        sx={{ mb: 3 }}
      >
        Générer les contraintes de base ({activities.length} activité{activities.length > 1 ? 's' : ''})
      </Button>

      {/* Sélecteur de type */}
      <FormControl fullWidth sx={{ mb: 1 }}>
        <InputLabel>Type de contrainte *</InputLabel>
        <Select
          value={constraintType}
          onChange={e => { setConstraintType(e.target.value); resetForm(); }}
          label="Type de contrainte *"
        >
          <MenuItem value="cardinality_per_activity">Cardinalité par activité</MenuItem>
          <MenuItem value="resource_exclusivity">Exclusivité de ressource</MenuItem>
          <MenuItem value="fixed_assignment">Affectation forcée</MenuItem>
          <MenuItem value="forbidden_assignment">Affectation interdite</MenuItem>
          <MenuItem value="resource_required_day">Jour imposé pour une ressource</MenuItem>
          <MenuItem value="resource_single_day">Ressource sur une seule journée</MenuItem>
        </Select>
      </FormControl>

      {/* Description du type sélectionné */}
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2, py: 0.5 }}>
        {CONSTRAINT_DESCRIPTIONS[constraintType]}
      </Alert>

      {/* ── Cardinalité par activité ── */}
      {constraintType === 'cardinality_per_activity' && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Activité *</InputLabel>
            <Select value={activity} onChange={e => { setActivity(e.target.value); setRole(''); }} label="Activité *">
              <MenuItem value="" disabled>Choisir une activité…</MenuItem>
              {activities.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Porte sur</InputLabel>
            <Select value={targetMode} onChange={e => setTargetMode(e.target.value as any)} label="Porte sur">
              <MenuItem value="role">Un rôle (ex: Président)</MenuItem>
              <MenuItem value="resourceType">Un type de ressource (ex: Salle)</MenuItem>
              <MenuItem value="slot">Le nombre de créneaux</MenuItem>
            </Select>
          </FormControl>

          {targetMode === 'role' && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Rôle *</InputLabel>
              <Select value={role} onChange={e => setRole(e.target.value)} label="Rôle *">
                <MenuItem value="" disabled>Choisir un rôle…</MenuItem>
                {rolesForActivity.length > 0
                  ? rolesForActivity.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)
                  : <MenuItem disabled>Sélectionnez d'abord une activité</MenuItem>}
              </Select>
            </FormControl>
          )}

          {targetMode === 'resourceType' && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Type de ressource *</InputLabel>
              <Select value={resourceType} onChange={e => setResourceType(e.target.value)} label="Type de ressource *">
                <MenuItem value="" disabled>Choisir un type…</MenuItem>
                {resourceTypes.map(rt => <MenuItem key={rt} value={rt}>{rt}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField label="Min" type="number" value={min} onChange={e => setMin(e.target.value)}
              size="small" sx={{ flex: 1 }} inputProps={{ min: 0 }}
              error={parseInt(min) > parseInt(max)} helperText="Minimum requis" />
            <TextField label="Max" type="number" value={max} onChange={e => setMax(e.target.value)}
              size="small" sx={{ flex: 1 }} inputProps={{ min: 0 }}
              error={parseInt(min) > parseInt(max)} helperText="Maximum autorisé" />
          </Box>
        </>
      )}

      {/* ── Exclusivité de ressource ── */}
      {constraintType === 'resource_exclusivity' && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type de ressource *</InputLabel>
            <Select value={resourceType} onChange={e => setResourceType(e.target.value)} label="Type de ressource *">
              <MenuItem value="" disabled>Choisir un type…</MenuItem>
              {resourceTypes.map(rt => <MenuItem key={rt} value={rt}>{rt}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Activité concernée *</InputLabel>
            <Select value={activity} onChange={e => setActivity(e.target.value)} label="Activité concernée *">
              <MenuItem value="" disabled>Choisir une activité…</MenuItem>
              {activities.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Portée</InputLabel>
              <Select value={scope} onChange={e => setScope(e.target.value)} label="Portée">
                <MenuItem value="slot">Par créneau</MenuItem>
                <MenuItem value="day">Par journée</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Max simultané" type="number" value={max} onChange={e => setMax(e.target.value)}
              size="small" sx={{ flex: 1 }} inputProps={{ min: 1 }}
              helperText="Nombre max d'activités simultanées pour cette ressource" />
          </Box>
        </>
      )}

      {/* ── Affectation fixe / interdite ── */}
      {['fixed_assignment', 'forbidden_assignment'].includes(constraintType) && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Instance d'activité *</InputLabel>
            <Select value={activityInstance} onChange={e => setActivityInstance(e.target.value)} label="Instance d'activité *">
              <MenuItem value="" disabled>Ex: Soutenance_1…</MenuItem>
              {activityInstances.map(ai => <MenuItem key={ai} value={ai}>{ai}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Rôle *</InputLabel>
            <Select value={role} onChange={e => setRole(e.target.value)} label="Rôle *">
              <MenuItem value="" disabled>Choisir un rôle…</MenuItem>
              {Array.from(new Set(
                Object.values(rolesByActivity).flatMap(r => Object.keys(r))
              )).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Ressource *</InputLabel>
            <Select value={resource} onChange={e => setResource(e.target.value)} label="Ressource *">
              <MenuItem value="" disabled>Choisir une ressource…</MenuItem>
              {allResources.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
        </>
      )}

      {/* ── Jour imposé pour une ressource ── */}
      {constraintType === 'resource_required_day' && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Ressource *</InputLabel>
            <Select value={resource} onChange={e => setResource(e.target.value)} label="Ressource *">
              <MenuItem value="" disabled>Choisir une ressource…</MenuItem>
              {allResources.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Jour imposé *</InputLabel>
            <Select value={day} onChange={e => setDay(e.target.value)} label="Jour imposé *">
              <MenuItem value="" disabled>Choisir un jour…</MenuItem>
              {availableDays.length > 0
                ? availableDays.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)
                : <MenuItem disabled>Aucun jour défini (étape Temps)</MenuItem>}
            </Select>
          </FormControl>
        </>
      )}

      {/* ── Ressource regroupée sur une seule journée ── */}
      {constraintType === 'resource_single_day' && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Ressource *</InputLabel>
          <Select value={resource} onChange={e => setResource(e.target.value)} label="Ressource *">
            <MenuItem value="" disabled>Choisir une ressource…</MenuItem>
            {allResources.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
      )}

      <Button
        onClick={validateAndAdd}
        variant="contained"
        startIcon={<AddIcon />}
        disabled={hasFormErrors()}
        sx={{ mt: 1 }}
      >
        Ajouter la contrainte
      </Button>

      {localErrors && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setLocalErrors('')}>
          {localErrors}
        </Alert>
      )}

      {/* Liste des contraintes */}
      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
        Contraintes définies
        <Chip label={totalConstraints} size="small" sx={{ ml: 1 }} color={totalConstraints > 0 ? 'primary' : 'default'} />
      </Typography>

      {totalConstraints > 0 ? (
        <List sx={{ maxHeight: 320, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
          {data.constraints.map((c: any, index: number) => (
            <ListItem
              key={index}
              divider
              secondaryAction={
                <Tooltip title="Supprimer">
                  <IconButton onClick={() => removeConstraint(index)} size="small" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemText
                primary={formatConstraintLabel(c)}
                secondary={c.type.replaceAll('_', ' ')}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Alert severity="warning">
          <strong>Aucune contrainte.</strong> Cliquez sur "Générer les contraintes de base" ou ajoutez-en manuellement.
        </Alert>
      )}
    </div>
  );
};

export default ConstraintsStep;
