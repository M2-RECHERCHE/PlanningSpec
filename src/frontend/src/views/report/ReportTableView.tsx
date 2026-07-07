import React from 'react';
import type { ActivityInstance } from '../../lib/reportApi';
import { PALETTE, hexAlpha } from './palette';

const TH: React.CSSProperties = {
  padding: '9px 12px',
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

const TD: React.CSSProperties = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: '13px',
  verticalAlign: 'middle',
};

interface Props {
  activities: ActivityInstance[];
  colors: Record<string, string>;
}

export const ReportTableView: React.FC<Props> = ({ activities, colors }) => {
  const hasAssignments = activities.some(a => a.assignments.length > 0 || a.roles.length > 0);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Instance', 'Activité', 'Jour', 'Créneau'].map(h => (
              <th key={h} style={TH}>{h}</th>
            ))}
            {hasAssignments && <th style={TH}>Ressources</th>}
            {hasAssignments && <th style={TH}>Rôles</th>}
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => {
            const c = colors[act.baseName] ?? PALETTE[0];
            return (
              <tr key={act.instance} style={{ background: idx % 2 !== 0 ? 'var(--bg-elevated)' : 'transparent' }}>
                <td style={TD}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 999,
                    background: hexAlpha(c, 0.1),
                    color: c,
                    border: `1px solid ${hexAlpha(c, 0.3)}`,
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {act.instance}
                  </span>
                </td>
                <td style={{ ...TD, fontWeight: 500 }}>{act.baseName}</td>
                <td style={TD}>{act.dayName}</td>
                <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{act.localSlot}</td>
                {hasAssignments && (
                  <td style={TD}>
                    {act.assignments.length > 0
                      ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {act.assignments.map(r => (
                            <span key={r} style={{
                              display: 'inline-block',
                              padding: '1px 8px',
                              borderRadius: 999,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-default)',
                              fontSize: 11,
                            }}>
                              {r}
                            </span>
                          ))}
                        </div>
                      )
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                )}
                {hasAssignments && (
                  <td style={TD}>
                    {act.roles.length > 0
                      ? act.roles.map((rr, i) => (
                        <div key={i} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          <b>{rr.role}</b>
                          <span style={{ color: 'var(--text-muted)' }}> → </span>
                          {rr.resource}
                        </div>
                      ))
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
