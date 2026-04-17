import React, { useMemo } from 'react';
import type { ActivityInstance } from '../../lib/reportApi';
import { PALETTE, hexAlpha } from './palette';

interface ResourceEntry {
  act: ActivityInstance;
  role?: string;
}

interface Props {
  activities: ActivityInstance[];
  colors: Record<string, string>;
}

export const ReportResourcesView: React.FC<Props> = ({ activities, colors }) => {
  const byResource = useMemo(() => {
    const m = new Map<string, ResourceEntry[]>();
    for (const act of activities) {
      if (act.roles.length > 0) {
        for (const rr of act.roles) {
          const list = m.get(rr.resource) ?? [];
          list.push({ act, role: rr.role });
          m.set(rr.resource, list);
        }
      } else {
        for (const r of act.assignments) {
          const list = m.get(r) ?? [];
          list.push({ act });
          m.set(r, list);
        }
      }
    }
    return m;
  }, [activities]);

  if (byResource.size === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Aucune affectation de ressource</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Relancez la résolution pour obtenir des affectations détaillées.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      {Array.from(byResource.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([resource, entries]) => {
          const sorted = [...entries].sort((a, b) =>
            a.act.day !== b.act.day ? a.act.day - b.act.day : a.act.localSlot - b.act.localSlot,
          );
          return (
            <div key={resource} style={{
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              {/* Resource header */}
              <div style={{
                padding: '9px 16px',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{resource}</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-elevated)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--border-subtle)',
                }}>
                  {entries.length} affectation{entries.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Entries */}
              {sorted.map((e, i) => {
                const c = colors[e.act.baseName] ?? PALETTE[0];
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '7px 16px',
                    borderBottom: i < sorted.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    fontSize: 13,
                  }}>
                    <div style={{ minWidth: 120, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {e.act.dayName}
                      <span style={{ margin: '0 5px', color: 'var(--border-default)' }}>·</span>
                      Créneau {e.act.localSlot}
                    </div>
                    <div style={{
                      background: hexAlpha(c, 0.1),
                      border: `1px solid ${hexAlpha(c, 0.3)}`,
                      borderLeft: `3px solid ${c}`,
                      borderRadius: 5,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: c,
                    }}>
                      {e.act.instance}
                    </div>
                    {e.role && (
                      <span style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-surface)',
                        padding: '1px 8px',
                        borderRadius: 999,
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {e.role}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
};
