import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppLayout, Topbar } from '../components/layout/AppLayout';
import { Button, Input } from '../components/ui';
import { useResponsive } from '../hooks/useResponsive';
import { Badge } from '../types';

// ─── Profile Page ─────────────────────────────────────────────────────────────
export const ProfilePage: React.FC = () => {
  const { user, logout, updateProfile, isLoading } = useApp();
  const { isMobile } = useResponsive();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user]);

  const save = async () => {
    setError('');
    const backendError = await updateProfile(name, email);
    if (backendError) {
      setError(backendError.fieldErrors?.name || backendError.fieldErrors?.email || backendError.message);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout>
      <Topbar title="Profil" subtitle="Gérez vos informations personnelles" />
      <div style={{ flex: 1, padding: isMobile ? '16px' : '32px', overflowY: 'auto', maxWidth: 640 }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: '20px', flexDirection: isMobile ? 'column' : 'row', marginBottom: '24px', padding: isMobile ? '18px' : '24px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '16px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--violet), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{user?.name}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{user?.email}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Membre depuis {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'}</div>
          </div>
        </div>

        {/* Form */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: isMobile ? '18px' : '24px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700 }}>Informations personnelles</h3>
          <Input label="Nom complet" value={name} onChange={setName}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
          <Input label="Adresse email" type="email" value={email} onChange={setEmail}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} />
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '13px', color: '#f87171' }}>
              ⚠ {error}
            </div>
          )}
          <Button variant="primary" onClick={save} loading={isLoading} icon={saved ? <span>✓</span> : undefined}>
            {saved ? 'Sauvegardé !' : 'Enregistrer les modifications'}
          </Button>
        </div>

        {/* Danger zone */}
        <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#f87171' }}>Zone de danger</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>Ces actions sont irréversibles. Procédez avec précaution.</p>
          <Button variant="danger" onClick={() => { void logout(); }}>Se déconnecter</Button>
        </div>
      </div>
    </AppLayout>
  );
};

const BADGE_COLORS = ['#38bdf8','#a78bfa','#34d399','#fb923c','#f472b6','#818cf8','#22d3ee','#fbbf24','#e879f9','#4ade80'];

// ─── New Planning Page ────────────────────────────────────────────────────────
export const NewPlanningPage: React.FC = () => {
  const { badges, createPlanning, createBadge, navigate } = useApp();
  const { isMobile } = useResponsive();
  const [title, setTitle] = useState('');
  const [selectedBadges, setSelectedBadges] = useState<Badge[]>([]);
  const [showBadgePanel, setShowBadgePanel] = useState(false);
  const [newBadgeName, setNewBadgeName] = useState('');
  const [newBadgeColor, setNewBadgeColor] = useState(BADGE_COLORS[0]);
  const [creatingBadge, setCreatingBadge] = useState(false);
  const [error, setError] = useState('');

  const toggleBadge = (badge: Badge) => {
    setSelectedBadges(prev =>
      prev.some(b => b.id === badge.id)
        ? prev.filter(b => b.id !== badge.id)
        : [...prev, badge]
    );
  };

  const handleCreateBadge = async () => {
    if (!newBadgeName.trim()) return;
    setCreatingBadge(true);
    const badge = await createBadge(newBadgeName.trim(), newBadgeColor);
    if (badge) {
      setSelectedBadges(prev => [...prev, badge]);
      setNewBadgeName('');
      setNewBadgeColor(BADGE_COLORS[0]);
    }
    setCreatingBadge(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) { setError('Le titre est requis.'); return; }
    const planning = await createPlanning(title, selectedBadges.length > 0 ? selectedBadges : undefined);
    if (planning) {
      navigate('editor', { planning });
    }
  };

  return (
    <AppLayout>
      <Topbar title="Nouvelle planification" subtitle="Créez une planification guidée étape par étape"
        actions={<Button variant="secondary" size="sm" onClick={() => navigate('plannings')} style={{ width: isMobile ? '100%' : undefined }}>← Retour</Button>}
      />
      <div style={{ flex: 1, padding: isMobile ? '16px' : '40px', display: 'flex', justifyContent: 'center', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 520 }} className="animate-fade-in">
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '20px', padding: isMobile ? '20px' : '32px' }}>
            <div style={{ marginBottom: '28px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '14px', background: 'var(--accent-dim)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'var(--accent)', marginBottom: '16px' }}>≡</div>
              <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800 }}>Nouvelle planification</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                Donnez un titre à votre planification et ajoutez des badges pour l'étiqueter. Vous serez ensuite guidé étape par étape.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <Input label="Titre de la planification" placeholder="Ex : Planning Semestre 2 — Informatique" value={title} onChange={v => { setTitle(v); setError(''); }} required />

              {/* Badge section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Badges <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <button onClick={() => setShowBadgePanel(v => !v)} style={{
                    fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: '2px 6px',
                  }}>
                    {showBadgePanel ? '▲ Masquer' : '▼ Gérer'}
                  </button>
                </div>

                {/* Selected badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: 30 }}>
                  {selectedBadges.map(b => (
                    <span key={b.id} style={{
                      padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                      background: `${b.color}20`, border: `1px solid ${b.color}50`, color: b.color,
                      display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                    }} onClick={() => toggleBadge(b)}>
                      {b.name}
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>✕</span>
                    </span>
                  ))}
                  {selectedBadges.length === 0 && (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '30px' }}>Aucun badge sélectionné</span>
                  )}
                </div>

                {showBadgePanel && (
                  <div style={{ marginTop: '10px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                    {/* Existing badges */}
                    {badges.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Badges existants</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {badges.map(b => {
                            const active = selectedBadges.some(s => s.id === b.id);
                            return (
                              <button key={b.id} onClick={() => toggleBadge(b)} style={{
                                padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                                background: active ? `${b.color}30` : 'transparent',
                                border: `1px solid ${active ? b.color : b.color + '50'}`,
                                color: b.color, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                transition: 'all 0.15s',
                              }}>
                                {active ? '✓ ' : ''}{b.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Create new badge */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Créer un badge</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)}
                          placeholder="Nom du badge..." onKeyDown={e => e.key === 'Enter' && void handleCreateBadge()}
                          style={{ flex: '1 1 140px', padding: '7px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                          {BADGE_COLORS.slice(0, 6).map(c => (
                            <button key={c} onClick={() => setNewBadgeColor(c)} style={{
                              width: 22, height: 22, borderRadius: '50%', background: c,
                              border: `2px solid ${newBadgeColor === c ? '#fff' : 'transparent'}`,
                              cursor: 'pointer', boxShadow: newBadgeColor === c ? `0 0 0 2px ${c}` : 'none',
                            }} />
                          ))}
                        </div>
                        <button onClick={() => void handleCreateBadge()} disabled={!newBadgeName.trim() || creatingBadge} style={{
                          padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          background: 'var(--accent-dim)', border: '1px solid rgba(56,189,248,0.2)',
                          color: 'var(--accent)', cursor: newBadgeName.trim() ? 'pointer' : 'not-allowed',
                          opacity: newBadgeName.trim() ? 1 : 0.5, fontFamily: 'Inter, sans-serif',
                        }}>
                          {creatingBadge ? '...' : '+ Créer'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '13px', color: '#f87171' }}>
                  ⚠ {error}
                </div>
              )}

              {/* Stepper preview */}
              <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Étapes du processus</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['Informations générales', 'Horizon temporel', 'Activités', 'Ressources', 'Contraintes', 'Règles avancées', 'Préférences', 'Récapitulatif'].map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="primary" fullWidth onClick={() => void handleCreate()}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}>
                Créer et commencer →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

