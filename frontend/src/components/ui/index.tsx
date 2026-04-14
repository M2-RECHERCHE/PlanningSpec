import React, { useState } from 'react';
import { PlanStatus, ProjectStatus } from '../../types';

export const FullScreenLoader: React.FC<{ message?: string }> = ({ message = 'Chargement...' }) => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top, rgba(56,189,248,0.1), transparent 32%), var(--bg-base)',
    padding: '24px',
  }}>
    <div style={{
      width: '100%',
      maxWidth: 360,
      borderRadius: '24px',
      padding: '32px 28px',
      background: 'rgba(8,12,20,0.92)',
      border: '1px solid var(--border-default)',
      boxShadow: '0 24px 80px rgba(2,6,23,0.45)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '18px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '18px',
        background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        fontWeight: 800,
        boxShadow: '0 12px 30px rgba(56,189,248,0.35)',
      }}>
        P
      </div>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '3px solid rgba(56,189,248,0.18)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 1s linear infinite',
      }} />
      <div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Planify</div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</div>
      </div>
    </div>
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PlanStatus | ProjectStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft:     { label: 'Brouillon',  color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', dot: '#64748b' },
  active:    { label: 'En cours',   color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  dot: '#38bdf8' },
  paused:    { label: 'En pause',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  dot: '#fb923c' },
  done:      { label: 'Terminé',    color: '#34d399', bg: 'rgba(52,211,153,0.12)',  dot: '#34d399' },
  error:     { label: 'Erreur',     color: '#f87171', bg: 'rgba(248,113,113,0.12)', dot: '#f87171' },
  completed: { label: 'Complété',   color: '#34d399', bg: 'rgba(52,211,153,0.12)',  dot: '#34d399' },
  archived:  { label: 'Archivé',    color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', dot: '#64748b' },
};

export const StatusBadge: React.FC<{ status: PlanStatus | ProjectStatus; pulse?: boolean }> = ({ status, pulse }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
      color: cfg.color, backgroundColor: cfg.bg, whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.dot, flexShrink: 0,
        ...(pulse && status === 'active' ? { animation: 'pulse 2s ease infinite' } : {})
      }} />
      {cfg.label}
    </span>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export const ProgressBar: React.FC<{ value: number; color?: string; height?: number; animated?: boolean }> = ({
  value, color = 'var(--accent)', height = 4, animated = true
}) => (
  <div style={{ height, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
    <div style={{
      height: '100%', width: `${value}%`, borderRadius: 999,
      background: `linear-gradient(90deg, ${color}, ${color}cc)`,
      transition: animated ? 'width 0.8s cubic-bezier(0.4,0,0.2,1)' : 'none',
      boxShadow: `0 0 8px ${color}50`,
    }} />
  </div>
);

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type BtnSize = 'sm' | 'md' | 'lg';

const BTN_STYLES: Record<BtnVariant, React.CSSProperties> = {
  primary:   { background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: '#fff', border: 'none', boxShadow: '0 4px 16px rgba(56,189,248,0.3)' },
  secondary: { background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' },
  ghost:     { background: 'transparent', color: 'var(--text-secondary)', border: 'none' },
  danger:    { background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' },
  success:   { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' },
};

const BTN_SIZES: Record<BtnSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '13px', borderRadius: '8px' },
  md: { padding: '9px 18px', fontSize: '14px', borderRadius: '10px' },
  lg: { padding: '13px 28px', fontSize: '15px', borderRadius: '12px' },
};

export const Button: React.FC<{
  children: React.ReactNode; variant?: BtnVariant; size?: BtnSize;
  onClick?: () => void; disabled?: boolean; icon?: React.ReactNode;
  fullWidth?: boolean; loading?: boolean; style?: React.CSSProperties;
}> = ({ children, variant = 'secondary', size = 'md', onClick, disabled, icon, fullWidth, loading, style }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        fontFamily: 'Inter, sans-serif', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, width: fullWidth ? '100%' : undefined,
        transition: 'all 0.2s ease', transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
        ...BTN_STYLES[variant], ...BTN_SIZES[size], ...style,
      }}
    >
      {loading ? <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} /> : icon}
      {children}
    </button>
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input: React.FC<{
  label?: string; placeholder?: string; value: string; onChange: (v: string) => void;
  type?: string; error?: string; hint?: string; icon?: React.ReactNode; required?: boolean;
  disabled?: boolean;
}> = ({ label, placeholder, value, onChange, type = 'text', error, hint, icon, required, disabled }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}{required && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>}
        <input
          type={type} value={value} placeholder={placeholder} disabled={disabled}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width: '100%', padding: icon ? '10px 14px 10px 38px' : '10px 14px',
            background: 'var(--bg-card)', border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : focused ? 'var(--accent)' : 'var(--border-default)'}`,
            borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px',
            fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 0.2s ease',
            boxShadow: focused ? `0 0 0 3px ${error ? 'rgba(248,113,113,0.1)' : 'rgba(56,189,248,0.08)'}` : 'none',
            opacity: disabled ? 0.6 : 1,
          }}
        />
      </div>
      {error && <span style={{ fontSize: '12px', color: '#f87171' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
};

// ─── Textarea ─────────────────────────────────────────────────────────────────
export const Textarea: React.FC<{
  label?: string; placeholder?: string; value: string; onChange: (v: string) => void;
  error?: string; rows?: number; required?: boolean;
}> = ({ label, placeholder, value, onChange, error, rows = 3, required }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}{required && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      <textarea
        value={value} placeholder={placeholder} rows={rows}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 14px', resize: 'vertical',
          background: 'var(--bg-card)', border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : focused ? 'var(--accent)' : 'var(--border-default)'}`,
          borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px',
          fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 0.2s ease',
          boxShadow: focused ? '0 0 0 3px rgba(56,189,248,0.08)' : 'none',
        }}
      />
      {error && <span style={{ fontSize: '12px', color: '#f87171' }}>{error}</span>}
    </div>
  );
};

// ─── Select ───────────────────────────────────────────────────────────────────
export const Select: React.FC<{
  label?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; error?: string; required?: boolean;
}> = ({ label, value, onChange, options, error, required }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}{required && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      <select
        value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 14px',
          background: 'var(--bg-card)', border: `1px solid ${focused ? 'var(--accent)' : 'var(--border-default)'}`,
          borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px',
          fontFamily: 'Inter, sans-serif', outline: 'none', cursor: 'pointer',
          boxShadow: focused ? '0 0 0 3px rgba(56,189,248,0.08)' : 'none',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value} style={{ background: 'var(--bg-card)' }}>{o.label}</option>)}
      </select>
      {error && <span style={{ fontSize: '12px', color: '#f87171' }}>{error}</span>}
    </div>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────
export const Card: React.FC<{
  children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties;
  padding?: string; hoverable?: boolean;
}> = ({ children, onClick, style, padding = '20px', hoverable = false }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && hoverable ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        border: `1px solid ${hovered && hoverable ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderRadius: '16px', padding,
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: hovered && hoverable ? 'var(--shadow-md)' : 'none',
        transform: hovered && hoverable ? 'translateY(-1px)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────
export const Modal: React.FC<{
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number;
}> = ({ open, onClose, title, children, width = 480 }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(8,12,20,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', animation: 'fadeIn 0.25s ease',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
        borderRadius: '20px', width: `min(${width}px, 94vw)`, boxShadow: 'var(--shadow-lg)',
        animation: 'scaleIn 0.25s ease',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '2px 6px', borderRadius: '6px' }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
export const EmptyState: React.FC<{
  icon: React.ReactNode; title: string; description: string; action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
    <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '28px' }}>{icon}</div>
    <div>
      <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: 320 }}>{description}</p>
    </div>
    {action}
  </div>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export const Skeleton: React.FC<{ width?: string | number; height?: string | number; style?: React.CSSProperties }> = ({
  width = '100%', height = 16, style
}) => (
  <div className="skeleton" style={{ width, height: typeof height === 'number' ? height : height, ...style }} />
);

// ─── Divider ──────────────────────────────────────────────────────────────────
export const Divider: React.FC<{ label?: string }> = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
    <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    {label && <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>}
    <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
  </div>
);

// ─── Number Input ─────────────────────────────────────────────────────────────
export const NumberInput: React.FC<{
  label?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}> = ({ label, value, onChange, min = 0, max = 999, step = 1 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    {label && <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button onClick={() => onChange(Math.max(min, value - step))}
        style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 70, textAlign: 'center', padding: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
      <button onClick={() => onChange(Math.min(max, value + step))}
        style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
    </div>
  </div>
);

// ─── Toggle ───────────────────────────────────────────────────────────────────
export const Toggle: React.FC<{ label?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => onChange(!checked)}>
    <div style={{
      width: 40, height: 22, borderRadius: 999, padding: 2,
      background: checked ? 'var(--accent)' : 'var(--bg-elevated)',
      border: `1px solid ${checked ? 'transparent' : 'var(--border-default)'}`,
      transition: 'all 0.2s ease', position: 'relative',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: checked ? 20 : 2, transition: 'left 0.2s ease',
      }} />
    </div>
    {label && <span style={{ fontSize: '14px', color: 'var(--text-secondary)', userSelect: 'none' }}>{label}</span>}
  </div>
);

// ─── Tag Input ────────────────────────────────────────────────────────────────
export const TagInput: React.FC<{
  label?: string; tags: string[]; onChange: (tags: string[]) => void; placeholder?: string;
}> = ({ label, tags, onChange, placeholder = 'Ajouter...' }) => {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); setInput(''); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '10px', minHeight: 42 }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '6px', fontSize: '13px' }}>
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input value={input} placeholder={placeholder} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'Inter, sans-serif', flex: 1, minWidth: 80 }} />
      </div>
    </div>
  );
};
