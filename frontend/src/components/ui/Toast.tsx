import React from 'react';
import { useApp } from '../../context/AppContext';

const ICONS: Record<string, string> = { success: '✓', error: '✕', info: 'ℹ' };
const COLORS: Record<string, string> = {
  success: '#34d399',
  error: '#f87171',
  info: '#38bdf8',
};
const BG: Record<string, string> = {
  success: 'rgba(52,211,153,0.1)',
  error: 'rgba(248,113,113,0.1)',
  info: 'rgba(56,189,248,0.1)',
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useApp();
  return (
    <div id="toast-container">
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px', borderRadius: '12px',
          background: 'var(--bg-elevated)',
          border: `1px solid ${COLORS[t.type]}30`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'toastIn 0.35s ease',
          pointerEvents: 'all', minWidth: 240, maxWidth: 360,
          backdropFilter: 'blur(12px)',
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: '50%',
            background: BG[t.type], color: COLORS[t.type],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, flexShrink: 0,
          }}>{ICONS[t.type]}</span>
          <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
};
