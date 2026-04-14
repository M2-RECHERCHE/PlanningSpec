import React from 'react';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'plannings', label: 'Planifications', icon: '≡' },
  { id: 'profile', label: 'Profil', icon: '○' },
];

export const Sidebar: React.FC = () => {
  const { user, currentPage, navigate, logout, sidebarOpen, setSidebarOpen } = useApp();
  const { isCompact, isMobile } = useResponsive();
  const showLabels = isCompact || sidebarOpen;

  React.useEffect(() => {
    if (isCompact) {
      setSidebarOpen(false);
    }
  }, [isCompact, setSidebarOpen]);

  const handleNavigate = (page: string) => {
    navigate(page);
    if (isCompact) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isCompact && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 99,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
        }} className="mobile-overlay" />
      )}

      <aside style={{
        width: isCompact ? 'min(82vw, 280px)' : sidebarOpen ? 240 : 68,
        minHeight: '100vh', height: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column',
        transition: isCompact
          ? 'transform 0.3s cubic-bezier(0.4,0,0.2,1)'
          : 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0, position: isCompact ? 'fixed' : 'sticky', zIndex: 100,
        top: 0, left: 0, bottom: 0,
        overflow: 'hidden',
        transform: isCompact ? (sidebarOpen ? 'translateX(0)' : 'translateX(-105%)') : 'none',
        pointerEvents: isCompact && !sidebarOpen ? 'none' : 'auto',
        boxShadow: isCompact && sidebarOpen ? '0 20px 60px rgba(2,6,23,0.45)' : 'none',
      }}>
        {/* Logo */}
        <div style={{
          padding: isMobile ? '18px 16px 14px' : '20px 16px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: '12px',
          justifyContent: showLabels ? 'space-between' : 'center',
        }}>
          {showLabels && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '8px',
                background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', color: '#fff', fontWeight: 700, flexShrink: 0,
                boxShadow: '0 4px 12px rgba(56,189,248,0.4)',
              }}>P</div>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '17px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Planify</span>
            </div>
          )}
          {!showLabels && (
            <div style={{
              width: 32, height: 32, borderRadius: '8px',
              background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', color: '#fff', fontWeight: 700,
              boxShadow: '0 4px 12px rgba(56,189,248,0.3)',
            }}>P</div>
          )}
          {showLabels && (
            <button onClick={() => setSidebarOpen(false)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV_ITEMS.map(item => {
            const active = currentPage === item.id;
            return (
              <button key={item.id} onClick={() => handleNavigate(item.id)}
                title={!showLabels ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: showLabels ? '12px' : '0', justifyContent: showLabels ? 'flex-start' : 'center',
                  padding: isMobile ? '12px' : '10px 12px', borderRadius: '10px',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  border: active ? '1px solid rgba(56,189,248,0.2)' : '1px solid transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '18px', transition: 'all 0.15s ease',
                  width: '100%', textAlign: 'left',
                  boxShadow: active ? '0 0 12px rgba(56,189,248,0.08)' : 'none',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                {showLabels && <span style={{ fontSize: '14px', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{item.label}</span>}
                {active && showLabels && (
                  <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                )}
              </button>
            );
          })}

          {/* Toggle collapse when closed */}
          {!isCompact && !sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{
              marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px', borderRadius: '10px', background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
            }} title="Développer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>
            </button>
          )}
        </nav>

        {/* User area */}
        <div style={{
          padding: '12px 8px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {/* New Planning CTA */}
          {showLabels && (
            <button onClick={() => handleNavigate('newPlanning')} style={{
              width: '100%', padding: '9px 12px', borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(14,165,233,0.1))',
              border: '1px solid rgba(56,189,248,0.25)',
              color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px',
              fontFamily: 'Inter, sans-serif',
            }}>
              <span style={{ fontSize: '16px' }}>+</span> Nouvelle planification
            </button>
          )}

          <div style={{
            display: 'flex', alignItems: 'center',
            gap: showLabels ? '10px' : '0', justifyContent: showLabels ? 'flex-start' : 'center',
            padding: '8px', borderRadius: '10px',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--violet), #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 600, color: '#fff',
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {showLabels && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
              </div>
            )}
            {showLabels && (
              <button onClick={() => { void logout(); }} title="Déconnexion" style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                padding: '4px', borderRadius: '6px', display: 'flex', flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

// ─── Topbar ───────────────────────────────────────────────────────────────────
export const Topbar: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({
  title, subtitle, actions
}) => {
  const { setSidebarOpen, sidebarOpen } = useApp();
  const { isMobile, isCompact } = useResponsive();

  return (
    <div style={{
      minHeight: 60,
      padding: isMobile ? '0 16px' : '0 20px',   // ← plus de padding vertical asymétrique
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',                        // ← toujours centré, peu importe le breakpoint
      gap: '12px',
      flexWrap: 'nowrap',                          // ← jamais de wrap
      background: 'var(--bg-surface)',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backdropFilter: 'blur(10px)',
    }}>
      <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        cursor: 'pointer', padding: '6px', borderRadius: '8px',
        display: 'flex', flexShrink: 0,            // ← flexShrink:0 pour ne pas se comprimer
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>             {/* ← minWidth:0 pour truncate */}
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? '15px' : '16px',
          fontWeight: 700,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{title}</h1>
        {subtitle && (
          <p style={{
            margin: 0,
            fontSize: '12px',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{subtitle}</p>
        )}
      </div>

      {actions && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,                           // ← ne rétrécit jamais
        }}>
          {actions}
        </div>
      )}
    </div>
  );
};

// ─── AppLayout ────────────────────────────────────────────────────────────────
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isCompact } = useResponsive();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        marginLeft: isCompact ? 0 : undefined,
      }}>
        {children}
      </main>
    </div>
  );
};
