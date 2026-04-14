import React from 'react';
import { useApp } from '../context/AppContext';
import { AppLayout, Topbar } from '../components/layout/AppLayout';
import { StatusBadge, ProgressBar, Card, Button } from '../components/ui';
import { useResponsive } from '../hooks/useResponsive';

const formatDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const DashboardPage: React.FC = () => {
  const { user, plannings, navigate } = useApp();
  const { isMobile, isCompact } = useResponsive();

  const activePlannings = plannings.filter(p => p.status === 'active');
  const donePlannings = plannings.filter(p => p.status === 'done');
  const pausedPlannings = plannings.filter(p => p.status === 'paused');
  const draftPlannings = plannings.filter(p => p.status === 'draft');
  const recentPlannings = [...plannings].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  const inProgress = plannings.filter(p => p.status === 'active' || p.status === 'paused').slice(0, 4);

  const openPlanning = (planning: typeof plannings[number]) => navigate('editor', { planning });

  const stats = [
    { label: 'En cours', value: activePlannings.length, color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', icon: '▶', onClick: () => navigate('plannings') },
    { label: 'En pause', value: pausedPlannings.length, color: '#fb923c', bg: 'rgba(251,146,60,0.08)', icon: '⏸', onClick: () => navigate('plannings') },
    { label: 'Terminées', value: donePlannings.length, color: '#34d399', bg: 'rgba(52,211,153,0.08)', icon: '✓', onClick: () => navigate('plannings') },
    { label: 'Brouillons', value: draftPlannings.length, color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', icon: '◎', onClick: () => navigate('plannings') },
  ];

  return (
    <AppLayout>
      <Topbar
        title={`Bonjour, ${user?.name?.split(' ')[0]} 👋`}
        subtitle={`${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('newPlanning')}
            style={{ width: isMobile ? '100%' : undefined }}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
            Nouvelle planification
          </Button>
        }
      />

      <div style={{ flex: 1, padding: isMobile ? '16px' : '24px', overflowY: 'auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? 140 : 180}px, 1fr))`, gap: '12px', marginBottom: '24px' }} className="stagger">
          {stats.map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-default)',
              borderRadius: '14px', padding: '18px',
              display: 'flex', flexDirection: 'column', gap: '12px',
              transition: 'all 0.2s ease', cursor: 'pointer',
            }}
            role="button"
            tabIndex={0}
            onClick={s.onClick}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                s.onClick();
              }
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: s.color }}>
                  {s.icon}
                </div>
                <span style={{ fontSize: '32px', fontWeight: 800, color: s.color, fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>{s.value}</span>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 300px', gap: '16px', alignItems: 'start' }}>
          {/* In progress */}
          <div>
            <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Planifications en cours</h2>
              <button onClick={() => navigate('plannings')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, padding: '4px 8px' }}>Voir tout →</button>
            </div>

            {inProgress.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>≡</div>
                <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>Aucune planification en cours.</p>
                <Button variant="primary" size="sm" onClick={() => navigate('newPlanning')}>Créer une planification</Button>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} className="stagger">
                {inProgress.map(pl => (
                  <div key={pl.id} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    borderRadius: '14px', padding: '16px',
                    display: 'flex', flexDirection: 'column', gap: '12px',
                    transition: 'all 0.2s ease', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)'; }}
                  onClick={() => openPlanning(pl)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.title}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '2px' }}>
                          {(pl.badges ?? []).map(b => (
                            <span key={b.id} style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: `${b.color}20`, border: `1px solid ${b.color}40`, color: b.color }}>{b.name}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Étape {pl.currentStep}/{pl.totalSteps}</div>
                      </div>
                      <StatusBadge status={pl.status} pulse />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Progression</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: pl.status === 'active' ? 'var(--accent)' : 'var(--text-secondary)' }}>{pl.progress}%</span>
                      </div>
                      <ProgressBar value={pl.progress} color={pl.status === 'paused' ? '#fb923c' : 'var(--accent)'} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
                      <button onClick={e => { e.stopPropagation(); openPlanning(pl); }} style={{
                        padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-default)',
                        background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 500, fontFamily: 'Inter, sans-serif',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        width: isMobile ? '100%' : undefined,
                        justifyContent: 'center',
                      }}>
                        {pl.status === 'paused' ? '▶ Reprendre' : '→ Continuer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column — recent activity */}
          <div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700 }}>Activité récente</h3>
              {recentPlannings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Aucune activité récente.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentPlannings.slice(0, 6).map(pl => (
                    <div key={pl.id}
                      onClick={() => openPlanning(pl)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px', borderRadius: '10px', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: pl.status === 'done' ? '#34d399' : pl.status === 'active' ? 'var(--accent)' : pl.status === 'paused' ? '#fb923c' : 'var(--text-muted)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(pl.updatedAt)}</div>
                      </div>
                      <StatusBadge status={pl.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
