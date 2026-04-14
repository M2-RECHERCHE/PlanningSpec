import React, { useMemo, useState } from 'react';
import { Planning } from '../types/index';
import { Button, Card } from './ui';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActivityInstance {
  instance: string;     // "Soutenance_1"
  baseName: string;     // "Soutenance"
  instanceNum: number;  // 1
  globalSlot: number;   // slot global (1-based)
  localSlot: number;    // slot dans la journée (1-based)
  day: number;          // numéro du jour (1-based)
  dayName: string;      // "Lundi"
  assignments: string[];
  roles: Array<{ role: string; resource: string }>;
}

// ─── Parser ─────────────────────────────────────────────────────────────────

function splitBaseName(instance: string): { baseName: string; instanceNum: number } {
  const m = instance.match(/^(.+)_(\d+)$/);
  return m ? { baseName: m[1], instanceNum: parseInt(m[2], 10) } : { baseName: instance, instanceNum: 1 };
}

function toLocalSlot(globalSlot: number, day: number, slotsPerDay: number): number {
  return slotsPerDay > 0 ? globalSlot - (day - 1) * slotsPerDay : globalSlot;
}

/**
 * Détecte et parse deux formats de sortie MiniZinc :
 *   Nouveau : "ACTIVITY: Soutenance_1 slot=1 day=1"  +  ASSIGNMENT / ROLE lines
 *   Ancien  : "Soutenance_1 starts=1 day=1"           (pas d'affectations)
 */
function parseOutput(raw: string, days: string[], slotsPerDay: number): ActivityInstance[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const useNewFormat = lines.some(l => l.startsWith('ACTIVITY:'));
  const map = new Map<string, ActivityInstance>();

  for (const line of lines) {
    if (useNewFormat) {
      // ACTIVITY: Soutenance_1 slot=24 day=3
      const m = line.match(/^ACTIVITY:\s+(\S+)\s+slot=(\d+)\s+day=(\d+)/);
      if (m) {
        const [, instance, slotStr, dayStr] = m;
        const globalSlot = parseInt(slotStr, 10);
        const day = parseInt(dayStr, 10);
        const { baseName, instanceNum } = splitBaseName(instance);
        map.set(instance, {
          instance, baseName, instanceNum,
          globalSlot, localSlot: toLocalSlot(globalSlot, day, slotsPerDay),
          day, dayName: days[day - 1] ?? `Jour ${day}`,
          assignments: [], roles: [],
        });
        continue;
      }
      // ASSIGNMENT: Soutenance_1 resource=T1
      const am = line.match(/^ASSIGNMENT:\s+(\S+)\s+resource=(.+)$/);
      if (am) { map.get(am[1])?.assignments.push(am[2]); continue; }
      // ROLE: Soutenance_1 role=President resource=T1
      const rm = line.match(/^ROLE:\s+(\S+)\s+role=(\S+)\s+resource=(.+)$/);
      if (rm) { map.get(rm[1])?.roles.push({ role: rm[2], resource: rm[3] }); }
    } else {
      // Ancien format : "Soutenance_1 starts=24 day=3"
      const m = line.match(/^(\S+)\s+starts=(\d+)\s+day=(\d+)/);
      if (m) {
        const [, instance, slotStr, dayStr] = m;
        const globalSlot = parseInt(slotStr, 10);
        const day = parseInt(dayStr, 10);
        const { baseName, instanceNum } = splitBaseName(instance);
        map.set(instance, {
          instance, baseName, instanceNum,
          globalSlot, localSlot: toLocalSlot(globalSlot, day, slotsPerDay),
          day, dayName: days[day - 1] ?? `Jour ${day}`,
          assignments: [], roles: [],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.localSlot - b.localSlot
  );
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#f97316',
  '#14b8a6', '#84cc16', '#a78bfa', '#fb7185',
];

function buildColorMap(baseNames: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  Array.from(new Set(baseNames)).forEach((name, i) => {
    map[name] = PALETTE[i % PALETTE.length];
  });
  return map;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--bg-surface)',
  borderBottom: '2px solid var(--border-default)',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: '13px',
  color: 'var(--text-primary)',
  verticalAlign: 'middle',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '999px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  fontSize: '11px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

// ─── Activity pill ────────────────────────────────────────────────────────────

const ActivityPill: React.FC<{ act: ActivityInstance; color: string; compact?: boolean }> = ({ act, color, compact }) => (
  <div style={{
    background: color + '15',
    border: `1px solid ${color}40`,
    borderLeft: `3px solid ${color}`,
    borderRadius: '6px',
    padding: compact ? '3px 7px' : '5px 9px',
    fontSize: compact ? '11px' : '12px',
    lineHeight: 1.4,
  }}>
    <div style={{ fontWeight: 700, color }}>{act.instance}</div>
    {act.assignments.length > 0 && (
      <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: 2 }}>
        {act.assignments.join(', ')}
      </div>
    )}
    {act.roles.length > 0 && act.assignments.length === 0 && (
      <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: 2 }}>
        {act.roles.map(r => r.resource).join(', ')}
      </div>
    )}
  </div>
);

// ─── View: Calendar ───────────────────────────────────────────────────────────

const CalendarView: React.FC<{
  activities: ActivityInstance[];
  days: string[];
  slotsPerDay: number;
  colors: Record<string, string>;
}> = ({ activities, days, slotsPerDay, colors }) => {
  const maxLocalSlot = Math.max(slotsPerDay, ...activities.map(a => a.localSlot));
  const slots = Array.from({ length: maxLocalSlot }, (_, i) => i + 1);

  const grid = useMemo(() => {
    const m: Record<string, ActivityInstance[]> = {};
    for (const act of activities) {
      const key = `${act.day}-${act.localSlot}`;
      if (!m[key]) m[key] = [];
      m[key].push(act);
    }
    return m;
  }, [activities]);

  const activeDays = days.length > 0
    ? days
    : Array.from(new Set(activities.map(a => a.dayName)));

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${activeDays.length * 160 + 90}px` }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 80 }}>Créneau</th>
            {activeDays.map((d, i) => (
              <th key={i} style={{ ...thStyle, textAlign: 'center' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map(slot => {
            const hasContent = activeDays.some((_, di) => (grid[`${di + 1}-${slot}`] ?? []).length > 0);
            return (
              <tr key={slot} style={{ background: slot % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                <td style={{ ...tdStyle, fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {slot}
                </td>
                {activeDays.map((_, di) => {
                  const acts = grid[`${di + 1}-${slot}`] ?? [];
                  return (
                    <td key={di} style={{
                      ...tdStyle,
                      verticalAlign: 'top',
                      padding: acts.length > 0 ? '6px' : '10px 14px',
                      minHeight: hasContent ? 50 : undefined,
                    }}>
                      {acts.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {acts.map(act => (
                            <ActivityPill key={act.instance} act={act} color={colors[act.baseName] ?? PALETTE[0]} compact />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── View: Table ──────────────────────────────────────────────────────────────

const TableView: React.FC<{
  activities: ActivityInstance[];
  colors: Record<string, string>;
  hasAssignments: boolean;
}> = ({ activities, colors, hasAssignments }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          {['Instance', 'Activité', 'Jour', 'Créneau'].map(h => <th key={h} style={thStyle}>{h}</th>)}
          {hasAssignments && <th style={thStyle}>Ressources</th>}
          {hasAssignments && <th style={thStyle}>Rôles</th>}
        </tr>
      </thead>
      <tbody>
        {activities.map((act, idx) => (
          <tr key={act.instance} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
            <td style={tdStyle}>
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
                background: (colors[act.baseName] ?? PALETTE[0]) + '18',
                color: colors[act.baseName] ?? PALETTE[0],
                border: `1px solid ${(colors[act.baseName] ?? PALETTE[0])}40`,
                fontSize: '12px', fontWeight: 600,
              }}>
                {act.instance}
              </span>
            </td>
            <td style={{ ...tdStyle, fontWeight: 500 }}>{act.baseName}</td>
            <td style={tdStyle}>{act.dayName}</td>
            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 500 }}>{act.localSlot}</td>
            {hasAssignments && (
              <td style={tdStyle}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {act.assignments.length > 0
                    ? act.assignments.map(r => <span key={r} style={chipStyle}>{r}</span>)
                    : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                </div>
              </td>
            )}
            {hasAssignments && (
              <td style={tdStyle}>
                {act.roles.length > 0
                  ? act.roles.map((rr, i) => (
                    <div key={i} style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{rr.role}</span>
                      <span style={{ color: 'var(--text-muted)' }}> → </span>
                      {rr.resource}
                    </div>
                  ))
                  : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── View: By resource ────────────────────────────────────────────────────────

const ResourcesView: React.FC<{
  activities: ActivityInstance[];
  colors: Record<string, string>;
}> = ({ activities, colors }) => {
  interface ResourceEntry { act: ActivityInstance; role?: string }

  const byResource = useMemo(() => {
    const m = new Map<string, ResourceEntry[]>();
    for (const act of activities) {
      if (act.roles.length > 0) {
        for (const rr of act.roles) {
          if (!m.has(rr.resource)) m.set(rr.resource, []);
          m.get(rr.resource)!.push({ act, role: rr.role });
        }
      } else {
        for (const r of act.assignments) {
          if (!m.has(r)) m.set(r, []);
          m.get(r)!.push({ act });
        }
      }
    }
    return m;
  }, [activities]);

  if (byResource.size === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
        Aucune affectation de ressource dans ce résultat.
        <br />
        <span style={{ fontSize: '12px' }}>
          Relancez la résolution pour obtenir les affectations détaillées.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from(byResource.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([resource, entries]) => (
          <div key={resource} style={{
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 16px',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{resource}</span>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border-subtle)' }}>
                {entries.length} affectation{entries.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {entries
                .sort((a: { act: ActivityInstance; role?: string }, b: { act: ActivityInstance; role?: string }) =>
                  a.act.day !== b.act.day ? a.act.day - b.act.day : a.act.localSlot - b.act.localSlot)
                .map((e: { act: ActivityInstance; role?: string }, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px',
                    borderBottom: i < entries.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{ minWidth: 110, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {e.act.dayName}
                      <span style={{ margin: '0 4px', color: 'var(--border-default)' }}>·</span>
                      Créneau {e.act.localSlot}
                    </div>
                    <ActivityPill act={e.act} color={colors[e.act.baseName] ?? PALETTE[0]} compact />
                    {e.role && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '1px 8px', borderRadius: '999px', border: '1px solid var(--border-subtle)' }}>
                        {e.role}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

type ViewMode = 'calendar' | 'table' | 'resources';

export const PlanningReport: React.FC<{ planning: Planning }> = ({ planning }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  const rawData = planning.data as Record<string, any> | undefined;
  const days: string[] = rawData?.time?.days ?? [];
  const slotsPerDay: number = rawData?.time?.slotsPerDay ?? 0;

  const activities = useMemo(() => {
    if (!planning.solutionOutput) return [];
    return parseOutput(planning.solutionOutput, days, slotsPerDay);
  }, [planning.solutionOutput, days, slotsPerDay]);

  const baseNames = useMemo(() => Array.from(new Set(activities.map(a => a.baseName))), [activities]);
  const hasAssignments = useMemo(() => activities.some(a => a.assignments.length > 0 || a.roles.length > 0), [activities]);

  const colors = useMemo(() => ({ ...buildColorMap(baseNames), ...customColors }), [baseNames, customColors]);

  if (!planning.solutionOutput) return null;

  if (activities.length === 0) {
    return (
      <Card>
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Résultat de résolution</h4>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px', margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {planning.solutionOutput}
        </pre>
      </Card>
    );
  }

  const dayCount = Math.max(...activities.map(a => a.day));
  const instanceCount = activities.length;
  const activityTypes = baseNames.length;

  const views: Array<{ id: ViewMode; icon: string; label: string }> = [
    { id: 'calendar', icon: '▦', label: 'Calendrier' },
    { id: 'table',    icon: '≡', label: 'Tableau' },
    { id: 'resources', icon: '◎', label: 'Par ressource' },
  ];

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg-surface)',
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '15px' }}>Rapport de planification</h4>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 12 }}>
            <span>{instanceCount} instance{instanceCount > 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{activityTypes} type{activityTypes > 1 ? 's' : ''} d'activité</span>
            <span>·</span>
            <span>{dayCount} jour{dayCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* View switcher */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {views.map(v => (
            <Button
              key={v.id}
              variant={viewMode === v.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode(v.id)}
            >
              {v.icon} {v.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Color legend ── */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg-elevated)',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Couleurs
        </span>
        {baseNames.map(name => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="color"
              value={colors[name] ?? PALETTE[0]}
              onChange={e => setCustomColors(prev => ({ ...prev, [name]: e.target.value }))}
              style={{ width: 18, height: 18, padding: 0, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'transparent' }}
            />
            <span style={{
              fontSize: '12px', fontWeight: 600,
              color: colors[name] ?? PALETTE[0],
              background: (colors[name] ?? PALETTE[0]) + '15',
              padding: '2px 8px', borderRadius: '999px',
              border: `1px solid ${(colors[name] ?? PALETTE[0])}35`,
            }}>
              {name}
            </span>
          </label>
        ))}
      </div>

      {/* ── View content ── */}
      <div style={{ padding: '0' }}>
        {viewMode === 'calendar' && (
          <CalendarView
            activities={activities}
            days={days.length > 0 ? days : Array.from({ length: dayCount }, (_, i) => `Jour ${i + 1}`)}
            slotsPerDay={slotsPerDay > 0 ? slotsPerDay : Math.max(...activities.map(a => a.localSlot))}
            colors={colors}
          />
        )}
        {viewMode === 'table' && (
          <TableView activities={activities} colors={colors} hasAssignments={hasAssignments} />
        )}
        {viewMode === 'resources' && (
          <ResourcesView activities={activities} colors={colors} />
        )}
      </div>

      {/* ── Raw output toggle ── */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0 20px' }}>
        <details>
          <summary style={{
            padding: '12px 0',
            fontSize: '12px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            userSelect: 'none',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ fontSize: '10px' }}>▶</span>
            Voir la sortie brute du solveur
          </summary>
          <pre style={{ margin: '0 0 16px', whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {planning.solutionOutput}
          </pre>
        </details>
      </div>
    </Card>
  );
};
