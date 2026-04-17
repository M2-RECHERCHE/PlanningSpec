import React, { useMemo } from 'react';
import type { ActivityInstance } from '../../lib/reportApi';
import { PALETTE, hexAlpha } from './palette';

const TH: React.CSSProperties = {
  padding: '9px 12px',
  background: 'var(--bg-surface)',
  borderBottom: '2px solid var(--border-default)',
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'top',
  minWidth: 130,
};

interface Props {
  activities: ActivityInstance[];
  days: string[];
  slotsPerDay: number;
  colors: Record<string, string>;
}

export const ReportCalendarView: React.FC<Props> = ({ activities, days, slotsPerDay, colors }) => {
  const dayCount = days.length > 0 ? days.length : Math.max(...activities.map(a => a.day), 1);
  const maxSlot = slotsPerDay > 0 ? slotsPerDay : Math.max(...activities.map(a => a.localSlot), 1);
  const activeDays = days.length > 0 ? days : Array.from({ length: dayCount }, (_, i) => `Jour ${i + 1}`);

  const grid = useMemo(() => {
    const m: Record<string, ActivityInstance[]> = {};
    for (const act of activities) {
      const k = `${act.day}-${act.localSlot}`;
      (m[k] ??= []).push(act);
    }
    return m;
  }, [activities]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${dayCount * 140 + 56}px` }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: 52, borderRight: '1px solid var(--border-subtle)' }}>Crén.</th>
            {activeDays.map((d, i) => <th key={i} style={TH}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxSlot }, (_, i) => i + 1).map(slot => (
            <tr key={slot} style={{ background: slot % 2 === 0 ? 'var(--bg-elevated)' : 'transparent' }}>
              <td style={{
                ...TD,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '11px',
                color: 'var(--text-muted)',
                borderRight: '1px solid var(--border-subtle)',
                minWidth: 52,
              }}>
                {slot}
              </td>
              {activeDays.map((_, di) => {
                const acts = grid[`${di + 1}-${slot}`] ?? [];
                return (
                  <td key={di} style={TD}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {acts.map(act => {
                        const c = colors[act.baseName] ?? PALETTE[0];
                        const sub = act.assignments.length > 0
                          ? act.assignments.join(', ')
                          : act.roles.length > 0
                            ? act.roles.map(r => r.resource).join(', ')
                            : null;
                        return (
                          <div key={act.instance} style={{
                            background: hexAlpha(c, 0.1),
                            border: `1px solid ${hexAlpha(c, 0.3)}`,
                            borderLeft: `3px solid ${c}`,
                            borderRadius: 5,
                            padding: '3px 7px',
                            fontSize: '11px',
                            lineHeight: 1.4,
                          }}>
                            <div style={{ fontWeight: 700, color: c }}>{act.instance}</div>
                            {sub && (
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 1 }}>
                                {sub}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
