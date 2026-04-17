import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AppLayout, Topbar } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui';
import { useResponsive } from '../../hooks/useResponsive';
import {
  fetchReport,
  openPrintView,
  downloadMarkdown,
  type PlanningReport,
} from '../../lib/reportApi';
import { buildColorMap } from './palette';
import { ReportCalendarView } from './ReportCalendarView';
import { ReportTableView } from './ReportTableView';
import { ReportResourcesView } from './ReportResourcesView';

// ─── View mode ────────────────────────────────────────────────────────────────

type ViewMode = 'calendar' | 'table' | 'resources';

const VIEWS: Array<{ id: ViewMode; icon: string; label: string }> = [
  { id: 'calendar',  icon: '▦', label: 'Calendrier' },
  { id: 'table',     icon: '≡', label: 'Tableau' },
  { id: 'resources', icon: '◎', label: 'Par ressource' },
];

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m} min ${s} s`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export const ReportPage: React.FC = () => {
  const { selectedPlanning, navigate } = useApp();
  const { isMobile, isCompact } = useResponsive();

  const [report, setReport] = useState<PlanningReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [customColors, setCustomColors] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState<'print' | 'markdown' | null>(null);

  // Fetch report from backend on mount / planning change
  useEffect(() => {
    if (!selectedPlanning?.id) return;
    setLoading(true);
    setError(null);
    fetchReport(selectedPlanning.id)
      .then(r => { setReport(r); setCustomColors({}); })
      .catch(e => setError(e?.response?.data?.error?.message ?? e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [selectedPlanning?.id]);

  const baseNames = useMemo(
    () => report?.stats.activityTypes ?? [],
    [report],
  );

  const colors = useMemo(
    () => ({ ...buildColorMap(baseNames), ...customColors }),
    [baseNames, customColors],
  );

  const handlePrint = useCallback(async () => {
    if (!selectedPlanning?.id) return;
    setExporting('print');
    try {
      await openPrintView(selectedPlanning.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Impossible d\'ouvrir l\'aperçu';
      alert(msg);
    } finally {
      setExporting(null);
    }
  }, [selectedPlanning?.id]);

  const handleMarkdown = useCallback(async () => {
    if (!selectedPlanning?.id || !report) return;
    setExporting('markdown');
    try {
      await downloadMarkdown(selectedPlanning.id, report.title);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur de téléchargement';
      alert(msg);
    } finally {
      setExporting(null);
    }
  }, [selectedPlanning?.id, report]);

  // ── No planning selected ──
  if (!selectedPlanning) {
    return (
      <AppLayout>
        <Topbar
          title="Rapport de planification"
          subtitle="Aucune planification sélectionnée"
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate('plannings')}>
              ← Retour
            </Button>
          }
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Aucune planification sélectionnée</div>
            <Button variant="primary" onClick={() => navigate('plannings')}>Retour à mes planifications</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Export actions in topbar ──
  const exportActions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button variant="secondary" size="sm" onClick={() => navigate('editor', { planning: selectedPlanning })}>
        ← Retour
      </Button>
      <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />
      <Button
        variant="secondary"
        size="sm"
        loading={exporting === 'markdown'}
        disabled={!report || exporting !== null}
        onClick={handleMarkdown}
      >
        ↓ Markdown
      </Button>
      <Button
        variant="secondary"
        size="sm"
        loading={exporting === 'print'}
        disabled={!report || exporting !== null}
        onClick={handlePrint}
      >
        ⎙ Imprimer
      </Button>
      <Button
        variant="primary"
        size="sm"
        disabled={!report}
        onClick={() => navigate('reportDesigner', { planning: selectedPlanning })}
      >
        📐 Designer PDF
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <Topbar
        title="Rapport de planification"
        subtitle={selectedPlanning.title}
        actions={exportActions}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: isCompact ? 'column' : 'row' }}>

        {/* ── Left panel: settings ── */}
        <div style={{
          width: isCompact ? '100%' : 260,
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: isCompact ? 'none' : '1px solid var(--border-subtle)',
          borderBottom: isCompact ? '1px solid var(--border-subtle)' : 'none',
          overflowY: 'auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: isCompact ? 'row' : 'column',
          flexWrap: isCompact ? 'wrap' : 'nowrap',
          gap: 20,
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

          {!isCompact && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 -16px' }} />}

          {/* Color pickers */}
          {baseNames.length > 0 && (
            <div style={{ minWidth: isCompact ? 220 : undefined }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
                Couleurs
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {baseNames.map(name => {
                  const color = colors[name];
                  return (
                    <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="color"
                        value={color}
                        onChange={e => setCustomColors(prev => ({ ...prev, [name]: e.target.value }))}
                        style={{ width: 26, height: 26, padding: 2, border: '1px solid var(--border-default)', borderRadius: 5, cursor: 'pointer', background: 'transparent', flexShrink: 0 }}
                      />
                      <span style={{
                        flex: 1,
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: color + '18',
                        color,
                        border: `1px solid ${color}40`,
                        fontSize: 12,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
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
          {!isCompact && report && (
            <>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 -16px' }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Statistiques
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Instances', value: report.stats.totalInstances },
                    { label: 'Types', value: report.stats.activityTypes.length },
                    { label: 'Jours', value: report.stats.totalDays },
                    { label: 'Ressources', value: report.stats.assignedResources.length },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                      <span style={{ fontWeight: 700 }}>{s.value}</span>
                    </div>
                  ))}
                  {report.solveTimeMs !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Temps solve</span>
                      <span style={{ fontWeight: 700 }}>{formatMs(report.solveTimeMs)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Right panel: report preview ── */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-elevated)' }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 20, animation: 'spin 1s linear infinite' }}>⟳</span>
              <span style={{ fontSize: 14 }}>Chargement du rapport…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 36 }}>⚠</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{error}</div>
              <Button variant="secondary" size="sm" onClick={() => {
                if (!selectedPlanning?.id) return;
                setLoading(true); setError(null);
                fetchReport(selectedPlanning.id)
                  .then(r => setReport(r))
                  .catch(e => setError(e?.message ?? 'Erreur'))
                  .finally(() => setLoading(false));
              }}>
                Réessayer
              </Button>
            </div>
          )}

          {/* Report content */}
          {!loading && !error && report && (
            <>
              {/* Header bar */}
              <div style={{
                padding: isMobile ? '12px 16px' : '14px 24px',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Aperçu</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {report.stats.totalInstances} instance{report.stats.totalInstances > 1 ? 's' : ''}
                  {' · '}
                  {VIEWS.find(v => v.id === viewMode)?.label}
                </span>
                {report.warnings.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: '#92400e',
                    background: '#fef3c7',
                    padding: '2px 10px',
                    borderRadius: 999,
                    border: '1px solid #fde68a',
                  }}>
                    ⚠ {report.warnings.length} avertissement{report.warnings.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Card */}
              <div style={{
                margin: isMobile ? 16 : 24,
                background: 'var(--bg-card)',
                borderRadius: 12,
                border: '1px solid var(--border-default)',
                overflow: 'hidden',
                boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              }}>
                {/* Card header */}
                <div style={{ padding: isMobile ? 16 : '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{report.title}</h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <span>Généré le {new Date(report.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span>·</span>
                    <span>{report.stats.totalInstances} instance{report.stats.totalInstances > 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{report.stats.activityTypes.join(', ')}</span>
                    {report.solveTimeMs !== undefined && (
                      <>
                        <span>·</span>
                        <span>Résolu en {formatMs(report.solveTimeMs)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* View content */}
                {viewMode === 'calendar' && (
                  <ReportCalendarView
                    activities={report.activities}
                    days={report.days.length > 0 ? report.days : Array.from({ length: report.stats.totalDays }, (_, i) => `Jour ${i + 1}`)}
                    slotsPerDay={report.slotsPerDay}
                    colors={colors}
                  />
                )}
                {viewMode === 'table' && (
                  <ReportTableView activities={report.activities} colors={colors} />
                )}
                {viewMode === 'resources' && (
                  <ReportResourcesView activities={report.activities} colors={colors} />
                )}

                {/* Warnings section */}
                {report.warnings.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 20px' }}>
                    <details>
                      <summary style={{ fontSize: 12, color: '#92400e', cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10 }}>▶</span>
                        {report.warnings.length} avertissement{report.warnings.length > 1 ? 's' : ''} du solveur
                      </summary>
                      <ul style={{ margin: '8px 0 4px 16px', fontSize: 12, color: '#92400e', lineHeight: 1.7 }}>
                        {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </details>
                  </div>
                )}
              </div>
            </>
          )}

          {/* No solution yet */}
          {!loading && !error && !report && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Aucun résultat disponible</div>
              <div style={{ fontSize: 13 }}>Cette planification n'a pas encore été résolue.</div>
              <Button variant="primary" onClick={() => navigate('editor', { planning: selectedPlanning })}>
                Aller à l'éditeur
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};
