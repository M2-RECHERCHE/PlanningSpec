import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppLayout, Topbar } from '../components/layout/AppLayout';
import { StatusBadge, ProgressBar, Button, Modal, EmptyState } from '../components/ui';
import { useResponsive } from '../hooks/useResponsive';

const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export const PlanningsPage: React.FC = () => {
  const { plannings, projects, navigate, deletePlanning } = useApp();
  const { isMobile, isCompact } = useResponsive();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = plannings
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => projectFilter === 'all' || p.projectId === projectFilter)
    .filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.projectName.toLowerCase().includes(search.toLowerCase()));

  const statusCounts = {
    all: plannings.length,
    draft: plannings.filter(p => p.status === 'draft').length,
    active: plannings.filter(p => p.status === 'active').length,
    paused: plannings.filter(p => p.status === 'paused').length,
    done: plannings.filter(p => p.status === 'done').length,
  };

  return (
    <AppLayout>
      <Topbar
        title="Planifications"
        subtitle={`${plannings.length} planification${plannings.length !== 1 ? 's' : ''} au total`}
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('newPlanning')}
            style={{ width: isMobile ? '100%' : undefined }}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
            Nouvelle planification
          </Button>
        }
      />

      <div style={{ flex: 1, padding: isMobile ? '16px' : '24px', overflowY: 'auto' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {([['all','Toutes'], ['draft','Brouillon'], ['active','En cours'], ['paused','En pause'], ['done','Terminées']] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)} style={{
              padding: '7px 14px', borderRadius: '8px',
              border: `1px solid ${statusFilter === v ? 'rgba(56,189,248,0.3)' : 'var(--border-default)'}`,
              background: statusFilter === v ? 'var(--accent-dim)' : 'transparent',
              color: statusFilter === v ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: '6px',
              flex: isMobile ? '1 1 calc(50% - 6px)' : undefined,
            }}>
              {l}
              <span style={{
                padding: '1px 7px', borderRadius: '999px', fontSize: '11px',
                background: statusFilter === v ? 'rgba(56,189,248,0.2)' : 'var(--bg-elevated)',
                color: statusFilter === v ? 'var(--accent)' : 'var(--text-muted)',
              }}>{statusCounts[v as keyof typeof statusCounts]}</span>
            </button>
          ))}
        </div>

        {/* Search + Project filter */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: isMobile ? '100%' : 340, width: isMobile ? '100%' : undefined }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une planification..."
              style={{ width: '100%', padding: '9px 12px 9px 38px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
          </div>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} style={{
            padding: '9px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-default)',
            borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px',
            outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            width: isMobile ? '100%' : undefined,
          }}>
            <option value="all" style={{ background: 'var(--bg-card)' }}>Tous les projets</option>
            {projects.map(p => <option key={p.id} value={p.id} style={{ background: 'var(--bg-card)' }}>{p.name}</option>)}
          </select>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState icon="≡" title="Aucune planification" description={search ? `Aucun résultat pour "${search}"` : "Créez votre première planification pour commencer."}
            action={<Button variant="primary" onClick={() => navigate('newPlanning')}>Créer une planification</Button>}
          />
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map(pl => (
              <div key={pl.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{pl.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{pl.projectName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Modifié le {formatDate(pl.updatedAt)}</div>
                  </div>
                  <StatusBadge status={pl.status} pulse={pl.status === 'active'} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Étape</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{pl.currentStep} / {pl.totalSteps}</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Progression</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{pl.progress}%</div>
                  </div>
                </div>

                <ProgressBar value={pl.progress} height={4} color={pl.status === 'done' ? '#34d399' : pl.status === 'paused' ? '#fb923c' : 'var(--accent)'} />

                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  <button onClick={() => navigate('editor', { planning: pl })} style={{
                    padding: '10px 12px', borderRadius: '10px',
                    border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.06)',
                    color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {pl.status === 'done' ? 'Voir' : pl.status === 'draft' ? 'Démarrer' : 'Reprendre'}
                  </button>
                  <button onClick={() => setDeleteConfirm(pl.id)} style={{
                    padding: '10px 12px', borderRadius: '10px',
                    border: '1px solid rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.06)',
                    color: '#f87171', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif',
                  }}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '16px', overflowX: isCompact ? 'auto' : 'hidden', overflowY: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr 160px 100px 130px 120px 140px', gap: '12px', alignItems: 'center', minWidth: isCompact ? 760 : undefined }}>
              {['Titre', 'Projet', 'Étape', 'Progression', 'Statut', 'Actions'].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>

            {filtered.map((pl, i) => (
              <div key={pl.id} style={{
                padding: '14px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                display: 'grid', gridTemplateColumns: '1fr 160px 100px 130px 120px 140px', gap: '12px', alignItems: 'center',
                transition: 'background 0.15s', cursor: 'pointer',
                minWidth: isCompact ? 760 : undefined,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              onClick={() => navigate('editor', { planning: pl })}>
                {/* Title */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{pl.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Modifié le {formatDate(pl.updatedAt)}</div>
                </div>
                {/* Project */}
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pl.projectName}
                </div>
                {/* Step */}
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {pl.currentStep} / {pl.totalSteps}
                </div>
                {/* Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pl.progress}%</span>
                  </div>
                  <ProgressBar value={pl.progress} height={3} color={pl.status === 'done' ? '#34d399' : pl.status === 'paused' ? '#fb923c' : 'var(--accent)'} />
                </div>
                {/* Status */}
                <div onClick={e => e.stopPropagation()}>
                  <StatusBadge status={pl.status} pulse={pl.status === 'active'} />
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => navigate('editor', { planning: pl })} style={{
                    padding: '5px 10px', borderRadius: '7px',
                    border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.06)',
                    color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                  }}>
                    {pl.status === 'done' ? 'Voir' : pl.status === 'draft' ? 'Démarrer' : 'Reprendre'}
                  </button>
                  <button onClick={() => setDeleteConfirm(pl.id)} style={{
                    padding: '5px 8px', borderRadius: '7px',
                    border: '1px solid rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.06)',
                    color: '#f87171', cursor: 'pointer', fontSize: '12px',
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer la planification" width={400}>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Êtes-vous sûr de vouloir supprimer cette planification ? Cette action est irréversible.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => { if (deleteConfirm) { deletePlanning(deleteConfirm); setDeleteConfirm(null); } }}>Supprimer</Button>
        </div>
      </Modal>
    </AppLayout>
  );
};
