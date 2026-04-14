import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Input } from '../components/ui';

const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    minHeight: '100vh', display: 'flex', background: 'var(--bg-base)',
    position: 'relative', overflow: 'hidden',
  }}>
    {/* Ambient */}
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: `
        radial-gradient(ellipse 60% 50% at 10% 20%, rgba(56,189,248,0.07) 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 90% 80%, rgba(167,139,250,0.06) 0%, transparent 55%)
      `,
    }} />
    <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />

    {/* Left branding panel */}
    <div style={{
      display: 'none', flex: 1, padding: '48px',
      flexDirection: 'column', justifyContent: 'space-between',
      background: 'rgba(255,255,255,0.01)', borderRight: '1px solid var(--border-subtle)',
    }} className="auth-branding">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#fff', boxShadow: '0 4px 16px rgba(56,189,248,0.4)' }}>P</div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '20px' }}>Planify</span>
      </div>
      <div>
        <h2 style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1.2, marginBottom: '16px' }}>
          Planification<br />intelligente pour<br />les pros.
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.7 }}>
          Créez, gérez et reprenez vos planifications sans jamais perdre votre progression.
        </p>
        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {['Sauvegarde automatique à chaque étape', 'Reprise instantanée de vos planifications', 'Interface guidée, claire et intuitive'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#34d399', flexShrink: 0 }}>✓</div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>© 2025 Planify</p>
    </div>

    {/* Right form panel */}
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px', position: 'relative', zIndex: 1,
    }}>
      {children}
    </div>
  </div>
);

// ─── Login ────────────────────────────────────────────────────────────────────
export const LoginPage: React.FC = () => {
  const { login, navigate, isLoading } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) { setError('Veuillez remplir tous les champs.'); return; }
    const backendError = await login(email, password);
    if (backendError) {
      setError(backendError.fieldErrors?.email || backendError.fieldErrors?.password || backendError.message);
    }
  };

  return (
    <AuthShell>
      <div style={{ width: '100%', maxWidth: 400 }} className="animate-fade-in">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#fff', boxShadow: '0 4px 16px rgba(56,189,248,0.3)' }}>P</div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '20px' }}>Planify</span>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px' }}>Bon retour</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px', fontSize: '15px' }}>Connectez-vous à votre espace de planification.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Email" type="email" placeholder="vous@exemple.com" value={email} onChange={setEmail} required
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
          />
          <div style={{ position: 'relative' }}>
            <Input label="Mot de passe" type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={setPassword} required
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
            />
            <button onClick={() => setShowPwd(!showPwd)} style={{
              position: 'absolute', right: 12, bottom: 10,
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px',
            }}>{showPwd ? 'Masquer' : 'Voir'}</button>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '13px', color: '#f87171' }}>
              ⚠ {error}
            </div>
          )}

          <button
            onClick={handleSubmit} disabled={isLoading}
            style={{
              width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
              color: '#fff', cursor: isLoading ? 'wait' : 'pointer',
              fontSize: '15px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 16px rgba(56,189,248,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s ease', opacity: isLoading ? 0.8 : 1,
            }}>
            {isLoading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Pas encore de compte ?{' '}
          <button onClick={() => navigate('register')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            S'inscrire
          </button>
        </p>
      </div>
    </AuthShell>
  );
};

// ─── Register ─────────────────────────────────────────────────────────────────
export const RegisterPage: React.FC = () => {
  const { register, navigate, isLoading } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Le nom est requis.';
    if (!email.includes('@')) e.email = 'Email invalide.';
    if (password.length < 6) e.password = 'Minimum 6 caractères.';
    if (password !== confirm) e.confirm = 'Les mots de passe ne correspondent pas.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const backendError = await register(name, email, password);
    if (backendError) {
      setErrors(prev => ({
        ...prev,
        ...(backendError.fieldErrors || {}),
        form: backendError.message,
      }));
    }
  };

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ['', '#f87171', '#fb923c', '#34d399'];
  const strengthLabels = ['', 'Faible', 'Moyen', 'Fort'];

  return (
    <AuthShell>
      <div style={{ width: '100%', maxWidth: 420 }} className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#fff', boxShadow: '0 4px 16px rgba(56,189,248,0.3)' }}>P</div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '20px' }}>Planify</span>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px' }}>Créer un compte</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px', fontSize: '15px' }}>Rejoignez Planify et commencez à planifier intelligemment.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Nom complet" placeholder="Jean Dupont" value={name} onChange={setName} required error={errors.name}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          />
          <Input label="Email" type="email" placeholder="vous@exemple.com" value={email} onChange={setEmail} required error={errors.email}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
          />
          <div>
            <Input label="Mot de passe" type="password" placeholder="Minimum 6 caractères" value={password} onChange={setPassword} required error={errors.password}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
            />
            {password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= strength ? strengthColors[strength] : 'var(--bg-elevated)', transition: 'all 0.3s ease' }} />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
              </div>
            )}
          </div>
          <Input label="Confirmer le mot de passe" type="password" placeholder="••••••••" value={confirm} onChange={setConfirm} required error={errors.confirm}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
          />

          {errors.form && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '13px', color: '#f87171' }}>
              ⚠ {errors.form}
            </div>
          )}

          <button
            onClick={handleSubmit} disabled={isLoading}
            style={{
              width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
              color: '#fff', cursor: isLoading ? 'wait' : 'pointer',
              fontSize: '15px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 16px rgba(56,189,248,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s ease', opacity: isLoading ? 0.8 : 1, marginTop: '4px',
            }}>
            {isLoading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
            {isLoading ? 'Création...' : 'Créer mon compte'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Déjà inscrit ?{' '}
          <button onClick={() => navigate('login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            Se connecter
          </button>
        </p>
      </div>
    </AuthShell>
  );
};
