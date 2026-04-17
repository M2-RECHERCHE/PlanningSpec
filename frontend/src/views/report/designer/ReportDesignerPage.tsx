import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { useApp } from '../../../context/AppContext';
import { AppLayout, Topbar } from '../../../components/layout/AppLayout';
import { Button } from '../../../components/ui';
import { useResponsive } from '../../../hooks/useResponsive';
import { fetchReport, type PlanningReport } from '../../../lib/reportApi';
import { PALETTE } from '../palette';
import { DesignerPanel } from './DesignerPanel';
import { ReportDocument } from './ReportDocument';
import { DEFAULT_OPTIONS, type ReportDesignOptions } from './types';

// ─── Main page ────────────────────────────────────────────────────────────────

export const ReportDesignerPage: React.FC = () => {
  const { selectedPlanning, navigate } = useApp();
  useResponsive();

  const [report, setReport] = useState<PlanningReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [opts, setOpts] = useState<ReportDesignOptions>(() => ({
    ...DEFAULT_OPTIONS,
    title: selectedPlanning?.title ?? '',
  }));

  // Sync activity colors when report loads
  useEffect(() => {
    if (!selectedPlanning?.id) return;
    setLoading(true);
    setLoadError(null);
    fetchReport(selectedPlanning.id)
      .then(r => {
        setReport(r);
        setOpts(prev => {
          const activityColors: Record<string, string> = { ...prev.activityColors };
          r.stats.activityTypes.forEach((name, i) => {
            if (!activityColors[name]) activityColors[name] = PALETTE[i % PALETTE.length];
          });
          return { ...prev, title: prev.title || r.title, activityColors };
        });
      })
      .catch(e => setLoadError(e?.response?.data?.error?.message ?? e?.message ?? 'Erreur'))
      .finally(() => setLoading(false));
  }, [selectedPlanning?.id]);

  // Debounce opts → only re-render PDF 700 ms after last change
  const [deferredOpts, setDeferredOpts] = useState<ReportDesignOptions>(opts);
  const [pdfPending, setPdfPending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((patch: Partial<ReportDesignOptions>) => {
    setOpts(prev => {
      const next = { ...prev, ...patch };
      setPdfPending(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setDeferredOpts(next);
        setPdfPending(false);
      }, 700);
      return next;
    });
  }, []);

  // On first report load, sync deferredOpts too
  useEffect(() => {
    setDeferredOpts(prev => ({ ...prev }));
  }, [report]);

  const filename = useMemo(() => {
    const base = (opts.title || report?.title || 'rapport')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    return `${base}.pdf`;
  }, [opts.title, report?.title]);

  // ── Not authenticated / no planning ──
  if (!selectedPlanning) {
    return (
      <AppLayout>
        <Topbar
          title="Designer de rapport"
          subtitle="Aucune planification sélectionnée"
          actions={<Button variant="secondary" size="sm" onClick={() => navigate('plannings')}>← Retour</Button>}
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📐</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Aucune planification sélectionnée</div>
            <Button variant="primary" onClick={() => navigate('plannings')}>Retour à mes planifications</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const topbarActions = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button variant="secondary" size="sm" onClick={() => navigate('report', { planning: selectedPlanning })}>
        ← Rapport
      </Button>
      {report && (
        <PDFDownloadLink
          document={<ReportDocument report={report} opts={deferredOpts} />}
          fileName={filename}
          style={{ textDecoration: 'none' }}
        >
          {({ loading: pdfLoading }) => (
            <Button variant="primary" size="sm" loading={pdfLoading} disabled={pdfLoading}>
              ↓ Télécharger PDF
            </Button>
          )}
        </PDFDownloadLink>
      )}
    </div>
  );

  return (
    <AppLayout>
      <Topbar
        title="Designer de rapport"
        subtitle={selectedPlanning.title}
        actions={topbarActions}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: designer panel ── */}
        <div style={{
          width: 280,
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          overflowY: 'auto',
          padding: '20px 16px',
        }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Chargement…
            </div>
          )}
          {loadError && (
            <div style={{ padding: 16, background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
              {loadError}
            </div>
          )}
          {!loading && !loadError && report && (
            <DesignerPanel report={report} opts={opts} onChange={handleChange} />
          )}
          {!loading && !loadError && !report && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun résultat disponible.
              <br />
              <span style={{ fontSize: 11 }}>Résolvez d'abord la planification.</span>
            </div>
          )}
        </div>

        {/* ── Right: PDF preview ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#525659', position: 'relative' }}>
          {/* Debounce pending overlay */}
          {pdfPending && report && !loading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
            }}>
              <div style={{
                background: '#2a2a2a', borderRadius: 10, padding: '10px 20px',
                display: 'flex', alignItems: 'center', gap: 10,
                color: '#ddd', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                Mise à jour…
              </div>
            </div>
          )}
          {loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⟳</span>
              <span>Chargement du rapport…</span>
            </div>
          )}
          {!loading && report && (
            <PDFViewer
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
              showToolbar
            >
              <ReportDocument report={report} opts={deferredOpts} />
            </PDFViewer>
          )}
          {!loading && !report && !loadError && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa', gap: 12 }}>
              <div style={{ fontSize: 48 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Aucune donnée à afficher</div>
              <div style={{ fontSize: 13 }}>Résolvez d'abord la planification.</div>
              <button
                onClick={() => navigate('editor', { planning: selectedPlanning })}
                style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: '1px solid #666', background: '#3a3a3a', color: '#eee', cursor: 'pointer', fontSize: 13 }}
              >
                Aller à l'éditeur
              </button>
            </div>
          )}
          {loadError && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 14 }}>
              ⚠ {loadError}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};
