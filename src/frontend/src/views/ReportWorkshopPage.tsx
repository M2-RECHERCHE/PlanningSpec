import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppLayout, Topbar } from '../components/layout/AppLayout';
import { Button } from '../components/ui';
import { useResponsive } from '../hooks/useResponsive';
import {
  parseOutput, buildColorMap, toMarkdown, REPORT_PALETTE,
  ActivityInstance,
} from '../lib/reportParser';

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(title: string, html: string) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 24px 32px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; color: #1e293b; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
    th { background: #f1f5f9; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #475569; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; margin: 1px 2px; }
    .chip { display: inline-block; padding: 2px 7px; border-radius: 999px; background: #f1f5f9; border: 1px solid #e2e8f0; font-size: 11px; margin: 1px 2px; }
    .section-title { font-size: 15px; font-weight: 700; margin: 24px 0 12px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
    .slot-label { font-weight: 700; color: #94a3b8; font-size: 11px; text-align: center; }
    .empty-cell { color: #e2e8f0; text-align: center; font-size: 14px; }
    @media print {
      body { padding: 12px 18px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
${html}
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
}

function exportWord(title: string, html: string) {
  const content = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'/>
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml>
  <![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
    h1 { font-size: 18pt; font-weight: bold; color: #1e3a5f; margin-bottom: 4pt; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14pt; }
    th { background: #EEF2FF; font-size: 9pt; font-weight: bold; padding: 6pt 8pt; border: 1pt solid #CBD5E1; }
    td { padding: 5pt 8pt; border: 1pt solid #E2E8F0; font-size: 10pt; vertical-align: top; }
    .section-title { font-size: 13pt; font-weight: bold; color: #1e3a5f; margin: 16pt 0 8pt; }
    .pill { padding: 1pt 5pt; border-radius: 3pt; font-size: 9pt; font-weight: bold; }
    .chip { padding: 1pt 5pt; border: 1pt solid #CBD5E1; border-radius: 3pt; font-size: 9pt; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  downloadBlob(content, `${title}.doc`, 'application/msword');
}

// ─── Palette ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '9px 12px',
  background: 'var(--bg-surface)',
  borderBottom: '2px solid var(--border-default)',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap' as const,
};

const TD: React.CSSProperties = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: '13px',
  verticalAlign: 'middle' as const,
};

// ─── Activity pill (screen) ───────────────────────────────────────────────────

const Pill: React.FC<{ act: ActivityInstance; color: string; small?: boolean }> = ({ act, color, small }) => (
  <div style={{
    background: hexToRgba(color, 0.1),
    border: `1px solid ${hexToRgba(color, 0.35)}`,
    borderLeft: `3px solid ${color}`,
    borderRadius: 6,
    padding: small ? '3px 7px' : '5px 10px',
    fontSize: small ? '11px' : '12px',
    lineHeight: 1.4,
    marginBottom: 3,
  }}>
    <div style={{ fontWeight: 700, color }}>{act.instance}</div>
    {(act.assignments.length > 0 || act.roles.length > 0) && (
      <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: 2 }}>
        {act.assignments.length > 0
          ? act.assignments.join(', ')
          : act.roles.map(r => r.resource).join(', ')}
      </div>
    )}
  </div>
);

// ─── HTML generators (for export) ────────────────────────────────────────────

function buildExportHTML(
  activities: ActivityInstance[],
  days: string[],
  slotsPerDay: number,
  colors: Record<string, string>,
  title: string,
  viewMode: ViewMode,
): string {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const activeDays = days.length > 0 ? days : Array.from(new Set(activities.map(a => a.dayName)));
  const dayCount = activeDays.length;
  const maxSlot = slotsPerDay > 0 ? slotsPerDay : Math.max(...activities.map(a => a.localSlot));
  const hasAssignments = activities.some(a => a.assignments.length > 0 || a.roles.length > 0);

  const grid: Record<string, ActivityInstance[]> = {};
  for (const act of activities) {
    const key = `${act.day}-${act.localSlot}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(act);
  }

  let html = `<h1>${title}</h1><p class="meta">Généré le ${date} · ${activities.length} instance(s) planifiée(s)</p>`;

  if (viewMode === 'calendar' || viewMode === 'table') {
    // Calendar table
    html += `<p class="section-title">Calendrier</p><table>`;
    html += `<thead><tr><th class="slot-label">Créneau</th>${activeDays.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>`;
    for (let slot = 1; slot <= maxSlot; slot++) {
      html += `<tr><td class="slot-label">${slot}</td>`;
      for (let d = 1; d <= dayCount; d++) {
        const acts = (grid[`${d}-${slot}`] ?? []);
        if (acts.length > 0) {
          html += `<td>${acts.map(a => {
            const c = colors[a.baseName] ?? REPORT_PALETTE[0];
            return `<span class="pill" style="background:${c}18;color:${c};border-left:3px solid ${c}">${a.instance}</span>`;
          }).join('')}</td>`;
        } else {
          html += `<td class="empty-cell">·</td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
  }

  if (viewMode === 'table' || viewMode === 'resources') {
    // Detail table
    html += `<p class="section-title">Détail des instances</p><table>`;
    if (hasAssignments) {
      html += '<thead><tr><th>Instance</th><th>Activité</th><th>Jour</th><th>Créneau</th><th>Ressources</th><th>Rôles</th></tr></thead><tbody>';
      for (const act of activities) {
        const c = colors[act.baseName] ?? REPORT_PALETTE[0];
        const res = act.assignments.length > 0 ? act.assignments.map(r => `<span class="chip">${r}</span>`).join(' ') : '—';
        const roles = act.roles.length > 0 ? act.roles.map(r => `<b>${r.role}</b> → ${r.resource}`).join(', ') : '—';
        html += `<tr><td><span class="pill" style="background:${c}18;color:${c}">${act.instance}</span></td><td>${act.baseName}</td><td>${act.dayName}</td><td style="text-align:center">${act.localSlot}</td><td>${res}</td><td>${roles}</td></tr>`;
      }
    } else {
      html += '<thead><tr><th>Instance</th><th>Activité</th><th>Jour</th><th>Créneau</th></tr></thead><tbody>';
      for (const act of activities) {
        const c = colors[act.baseName] ?? REPORT_PALETTE[0];
        html += `<tr><td><span class="pill" style="background:${c}18;color:${c}">${act.instance}</span></td><td>${act.baseName}</td><td>${act.dayName}</td><td style="text-align:center">${act.localSlot}</td></tr>`;
      }
    }
    html += '</tbody></table>';
  }

  if (viewMode === 'resources') {
    const byResource = new Map<string, Array<{ act: ActivityInstance; role?: string }>>();
    for (const act of activities) {
      if (act.roles.length > 0) {
        for (const rr of act.roles) {
          if (!byResource.has(rr.resource)) byResource.set(rr.resource, []);
          byResource.get(rr.resource)!.push({ act, role: rr.role });
        }
      } else {
        for (const r of act.assignments) {
          if (!byResource.has(r)) byResource.set(r, []);
          byResource.get(r)!.push({ act });
        }
      }
    }
    if (byResource.size > 0) {
      html += `<p class="section-title">Affectations par ressource</p><table>`;
      html += '<thead><tr><th>Ressource</th><th>Jour</th><th>Créneau</th><th>Instance</th><th>Rôle</th></tr></thead><tbody>';
      Array.from(byResource.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([resource, entries]) => {
        entries.sort((a, b) => a.act.day !== b.act.day ? a.act.day - b.act.day : a.act.localSlot - b.act.localSlot).forEach((e, i) => {
          const c = colors[e.act.baseName] ?? REPORT_PALETTE[0];
          html += `<tr>${i === 0 ? `<td rowspan="${entries.length}" style="font-weight:700;vertical-align:middle">${resource}</td>` : ''}`;
          html += `<td>${e.act.dayName}</td><td style="text-align:center">${e.act.localSlot}</td>`;
          html += `<td><span class="pill" style="background:${c}18;color:${c}">${e.act.instance}</span></td>`;
          html += `<td>${e.role ?? '—'}</td></tr>`;
        });
      });
      html += '</tbody></table>';
    }
  }

  return html;
}

// ─── Calendar View ────────────────────────────────────────────────────────────

const CalendarView: React.FC<{
  activities: ActivityInstance[];
  days: string[];
  slotsPerDay: number;
  colors: Record<string, string>;
}> = ({ activities, days, slotsPerDay, colors }) => {
  const dayCount = days.length > 0 ? days.length : Math.max(...activities.map(a => a.day));
  const maxSlot = slotsPerDay > 0 ? slotsPerDay : Math.max(...activities.map(a => a.localSlot));
  const activeDays = days.length > 0 ? days : Array.from({ length: dayCount }, (_, i) => `Jour ${i + 1}`);
  const slots = Array.from({ length: maxSlot }, (_, i) => i + 1);

  const grid = useMemo(() => {
    const m: Record<string, ActivityInstance[]> = {};
    for (const act of activities) {
      const k = `${act.day}-${act.localSlot}`;
      if (!m[k]) m[k] = [];
      m[k].push(act);
    }
    return m;
  }, [activities]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${dayCount * 150 + 80}px` }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: 60, textAlign: 'center' }}>Crén.</th>
            {activeDays.map((d, i) => <th key={i} style={{ ...TH, textAlign: 'center' }}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {slots.map(slot => (
            <tr key={slot} style={{ background: slot % 2 === 0 ? 'var(--bg-elevated)' : 'transparent' }}>
              <td style={{ ...TD, textAlign: 'center', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)', borderRight: '1px solid var(--border-subtle)' }}>
                {slot}
              </td>
              {activeDays.map((_, di) => {
                const acts = grid[`${di + 1}-${slot}`] ?? [];
                return (
                  <td key={di} style={{ ...TD, padding: acts.length > 0 ? 6 : TD.padding, minWidth: 140 }}>
                    {acts.map(act => <Pill key={act.instance} act={act} color={colors[act.baseName] ?? REPORT_PALETTE[0]} small />)}
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

// ─── Table View ───────────────────────────────────────────────────────────────

const TableView: React.FC<{ activities: ActivityInstance[]; colors: Record<string, string> }> = ({ activities, colors }) => {
  const hasAssignments = activities.some(a => a.assignments.length > 0 || a.roles.length > 0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Instance', 'Activité', 'Jour', 'Créneau'].map(h => <th key={h} style={TH}>{h}</th>)}
            {hasAssignments && <th style={TH}>Ressources</th>}
            {hasAssignments && <th style={TH}>Rôles</th>}
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => {
            const color = colors[act.baseName] ?? REPORT_PALETTE[0];
            return (
              <tr key={act.instance} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-elevated)' }}>
                <td style={TD}>
                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: hexToRgba(color, 0.1), color, border: `1px solid ${hexToRgba(color, 0.3)}`, fontSize: 12, fontWeight: 700 }}>
                    {act.instance}
                  </span>
                </td>
                <td style={{ ...TD, fontWeight: 500 }}>{act.baseName}</td>
                <td style={TD}>{act.dayName}</td>
                <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{act.localSlot}</td>
                {hasAssignments && (
                  <td style={TD}>
                    {act.assignments.length > 0
                      ? act.assignments.map(r => <span key={r} style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 999, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontSize: 11, marginRight: 4 }}>{r}</span>)
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                )}
                {hasAssignments && (
                  <td style={TD}>
                    {act.roles.length > 0
                      ? act.roles.map((rr, i) => <div key={i} style={{ fontSize: 12 }}><b>{rr.role}</b> <span style={{ color: 'var(--text-muted)' }}>→</span> {rr.resource}</div>)
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
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

// ─── Resources View ───────────────────────────────────────────────────────────

const ResourcesView: React.FC<{ activities: ActivityInstance[]; colors: Record<string, string> }> = ({ activities, colors }) => {
  const byResource = useMemo(() => {
    const m = new Map<string, Array<{ act: ActivityInstance; role?: string }>>();
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
      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Aucune affectation de ressource</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Relancez la résolution pour obtenir des affectations détaillées.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      {Array.from(byResource.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([resource, entries]) => (
          <div key={resource} style={{ border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>{resource}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border-subtle)' }}>
                {entries.length} affectation{entries.length > 1 ? 's' : ''}
              </span>
            </div>
            <div>
              {entries
                .sort((a: { act: ActivityInstance; role?: string }, b: { act: ActivityInstance; role?: string }) =>
                  a.act.day !== b.act.day ? a.act.day - b.act.day : a.act.localSlot - b.act.localSlot)
                .map((e: { act: ActivityInstance; role?: string }, i: number) => {
                  const color = colors[e.act.baseName] ?? REPORT_PALETTE[0];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 16px', borderBottom: i < entries.length - 1 ? '1px solid var(--border-subtle)' : 'none', fontSize: 13 }}>
                      <div style={{ minWidth: 110, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {e.act.dayName} <span style={{ color: 'var(--border-default)' }}>·</span> Créneau {e.act.localSlot}
                      </div>
                      <Pill act={e.act} color={color} small />
                      {e.role && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '1px 8px', borderRadius: 999, border: '1px solid var(--border-subtle)' }}>
                          {e.role}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'calendar' | 'table' | 'resources';

const VIEWS: Array<{ id: ViewMode; icon: string; label: string }> = [
  { id: 'calendar',  icon: '▦', label: 'Calendrier' },
  { id: 'table',     icon: '≡', label: 'Tableau' },
  { id: 'resources', icon: '◎', label: 'Par ressource' },
];

export const ReportWorkshopPage: React.FC = () => {
  const { selectedPlanning, navigate } = useApp();
  const { isMobile, isCompact } = useResponsive();
  const previewRef = useRef<HTMLDivElement>(null);

  const rawData = selectedPlanning?.data as Record<string, any> | undefined;
  const days: string[] = rawData?.time?.days ?? [];
  const slotsPerDay: number = rawData?.time?.slotsPerDay ?? 0;

  const activities = useMemo(() => {
    if (!selectedPlanning?.solutionOutput) return [];
    return parseOutput(selectedPlanning.solutionOutput, days, slotsPerDay);
  }, [selectedPlanning, days, slotsPerDay]);

  const baseNames = useMemo(() => Array.from(new Set(activities.map(a => a.baseName))), [activities]);

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [reportTitle, setReportTitle] = useState(
    selectedPlanning ? `Rapport — ${selectedPlanning.title}` : 'Rapport de planification',
  );
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  const colors = useMemo(
    () => ({ ...buildColorMap(baseNames), ...customColors }),
    [baseNames, customColors],
  );

  const handleExportMD = useCallback(() => {
    const md = toMarkdown(activities, days, slotsPerDay, reportTitle);
    downloadBlob(md, `${reportTitle}.md`, 'text/markdown');
  }, [activities, days, slotsPerDay, reportTitle]);

  const handleExportPDF = useCallback(() => {
    const html = buildExportHTML(activities, days, slotsPerDay, colors, reportTitle, viewMode);
    exportPDF(reportTitle, html);
  }, [activities, days, slotsPerDay, colors, reportTitle, viewMode]);

  const handleExportWord = useCallback(() => {
    const html = buildExportHTML(activities, days, slotsPerDay, colors, reportTitle, viewMode);
    exportWord(reportTitle, html);
  }, [activities, days, slotsPerDay, colors, reportTitle, viewMode]);

  if (!selectedPlanning || !selectedPlanning.solutionOutput) {
    return (
      <AppLayout>
        <Topbar
          title="Atelier de rapport"
          subtitle="Aucune planification résolue sélectionnée"
          actions={<Button variant="secondary" size="sm" onClick={() => navigate('plannings')}>← Retour</Button>}
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Aucun résultat disponible</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Cette planification n'a pas encore été résolue.</div>
            <Button variant="primary" onClick={() => navigate('plannings')}>Retour à mes planifications</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const exportActions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button variant="secondary" size="sm" onClick={() => navigate('editor', { planningId: selectedPlanning.id })}>
        ← Retour
      </Button>
      <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />
      <Button variant="secondary" size="sm" onClick={handleExportMD} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13 }}>↓</span> Markdown
      </Button>
      <Button variant="secondary" size="sm" onClick={handleExportWord} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13 }}>↓</span> Word
      </Button>
      <Button variant="primary" size="sm" onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13 }}>⎙</span> PDF
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <Topbar
        title="Atelier de rapport"
        subtitle={selectedPlanning.title}
        actions={exportActions}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: isCompact ? 'column' : 'row' }}>

        {/* ── Left: settings panel ── */}
        <div style={{
          width: isCompact ? '100%' : 270,
          background: 'var(--bg-surface)',
          borderRight: isCompact ? 'none' : '1px solid var(--border-subtle)',
          borderBottom: isCompact ? '1px solid var(--border-subtle)' : 'none',
          overflowY: 'auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: isCompact ? 'row' : 'column',
          flexWrap: isCompact ? 'wrap' : 'nowrap',
          gap: 20,
          flexShrink: 0,
        }}>

          {/* View selector */}
          <div style={{ minWidth: isCompact ? 200 : undefined }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Vue
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {VIEWS.map(v => (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: viewMode === v.id ? '2px solid var(--accent)' : '1px solid var(--border-default)',
                    background: viewMode === v.id ? 'rgba(59,130,246,0.08)' : 'var(--bg-elevated)',
                    color: viewMode === v.id ? 'var(--accent)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: viewMode === v.id ? 700 : 400,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{v.icon}</span>
                  {v.label}
                  {viewMode === v.id && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 -16px', display: isCompact ? 'none' : 'block' }} />

          {/* Title */}
          <div style={{ minWidth: isCompact ? 220 : undefined }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Titre du rapport
            </div>
            <input
              value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 7,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 -16px', display: isCompact ? 'none' : 'block' }} />

          {/* Colors */}
          {baseNames.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
                Couleurs des activités
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {baseNames.map(name => {
                  const color = colors[name] ?? REPORT_PALETTE[0];
                  return (
                    <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="color"
                        value={color}
                        onChange={e => setCustomColors(prev => ({ ...prev, [name]: e.target.value }))}
                        style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--border-default)', borderRadius: 6, cursor: 'pointer', background: 'transparent', flexShrink: 0 }}
                      />
                      <span style={{
                        flex: 1,
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: hexToRgba(color, 0.12),
                        color,
                        border: `1px solid ${hexToRgba(color, 0.3)}`,
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap' as const,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats */}
          {!isCompact && (
            <>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 -16px' }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Statistiques
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Instances', value: activities.length },
                    { label: 'Types', value: baseNames.length },
                    { label: 'Jours', value: Math.max(...activities.map(a => a.day), 0) },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                      <span style={{ fontWeight: 700 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Right: preview ── */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-elevated)' }}>
          {/* Preview header */}
          <div style={{
            padding: isMobile ? '12px 16px' : '14px 24px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Aperçu</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
              {activities.length} instance{activities.length > 1 ? 's' : ''} · {VIEWS.find(v => v.id === viewMode)?.label}
            </span>
          </div>

          {/* Report preview */}
          <div
            ref={previewRef}
            id="report-preview"
            style={{
              margin: isMobile ? '16px' : '24px',
              background: 'var(--bg-card)',
              borderRadius: 12,
              border: '1px solid var(--border-default)',
              overflow: 'hidden',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            }}
          >
            {/* Report header */}
            <div style={{ padding: isMobile ? '16px' : '24px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{reportTitle}</h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <span>Généré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span>·</span>
                <span>{activities.length} instance{activities.length > 1 ? 's' : ''} planifiée{activities.length > 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{baseNames.join(', ')}</span>
              </div>
            </div>

            {/* View content */}
            {viewMode === 'calendar' && (
              <CalendarView
                activities={activities}
                days={days.length > 0 ? days : Array.from({ length: Math.max(...activities.map(a => a.day), 1) }, (_, i) => `Jour ${i + 1}`)}
                slotsPerDay={slotsPerDay}
                colors={colors}
              />
            )}
            {viewMode === 'table' && (
              <TableView activities={activities} colors={colors} />
            )}
            {viewMode === 'resources' && (
              <ResourcesView activities={activities} colors={colors} />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
