import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppLayout, Topbar } from '../components/layout/AppLayout';
import { Button, Input, Select } from '../components/ui';
import { useResponsive } from '../hooks/useResponsive';

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

// ─── New Planning Page (with project selection) ───────────────────────────────
export const NewPlanningPage: React.FC = () => {
  const { projects, createPlanning, navigate } = useApp();
  const { isMobile } = useResponsive();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) { setError('Le titre est requis.'); return; }
    if (!projectId) { setError('Veuillez sélectionner un projet.'); return; }
    const planning = await createPlanning(title, projectId);
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
                Donnez un titre à votre planification et associez-la à un projet. Vous serez ensuite guidé étape par étape.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <Input label="Titre de la planification" placeholder="Ex : Planning Semestre 2 — Informatique" value={title} onChange={v => { setTitle(v); setError(''); }} required />
              <Select label="Projet associé" value={projectId} onChange={v => { setProjectId(v); setError(''); }} required
                options={[{ value: '', label: '— Choisir un projet —' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
              />

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '13px', color: '#f87171' }}>
                  ⚠ {error}
                </div>
              )}

              {/* Stepper preview */}
              <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Étapes du processus</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['Informations générales', 'Horizon temporel', 'Activités', 'Ressources', 'Contraintes', 'Récapitulatif'].map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="primary" fullWidth onClick={handleCreate}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}>
                Créer et commencer →
              </Button>
            </div>
          </div>

          {projects.length === 0 && (
            <div style={{ marginTop: '14px', padding: '14px 16px', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: '12px', fontSize: '13px', color: '#fb923c' }}>
              ⚠ Vous n'avez aucun projet. <button onClick={() => navigate('newProject')} style={{ background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', fontSize: '13px' }}>Créez un projet</button> d'abord.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

// ─── New Project Page ─────────────────────────────────────────────────────────
const PROJECT_COLORS = ['#38bdf8','#a78bfa','#34d399','#fb923c','#f472b6','#818cf8','#22d3ee','#fbbf24'];

export const NewProjectPage: React.FC = () => {
  const { createProject, navigate } = useApp();
  const { isMobile } = useResponsive();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!name.trim()) { setError('Le nom du projet est requis.'); return; }
    const project = await createProject(name, desc, color);
    if (project) {
      navigate('projects');
    }
  };

  return (
    <AppLayout>
      <Topbar title="Nouveau projet" subtitle="Créez un espace pour vos planifications"
        actions={<Button variant="secondary" size="sm" onClick={() => navigate('projects')} style={{ width: isMobile ? '100%' : undefined }}>← Retour</Button>}
      />
      <div style={{ flex: 1, padding: isMobile ? '16px' : '40px', display: 'flex', justifyContent: 'center', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 480 }} className="animate-fade-in">
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '20px', padding: isMobile ? '20px' : '32px' }}>
            <div style={{ marginBottom: '28px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '14px', background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color, marginBottom: '16px', transition: 'all 0.3s' }}>◫</div>
              <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800 }}>Nouveau projet</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Un projet regroupe plusieurs planifications liées.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <Input label="Nom du projet" placeholder="Ex : Projet Académique 2025" value={name} onChange={v => { setName(v); setError(''); }} required />
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Description (optionnelle)</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Décrivez ce projet brièvement..." rows={3}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Couleur d'identification</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {PROJECT_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} style={{
                      width: 30, height: 30, borderRadius: '50%', background: c,
                      border: `3px solid ${color === c ? '#fff' : 'transparent'}`,
                      cursor: 'pointer', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s',
                    }} />
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '13px', color: '#f87171' }}>⚠ {error}</div>
              )}

              <Button variant="primary" fullWidth onClick={handle}>Créer le projet</Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
