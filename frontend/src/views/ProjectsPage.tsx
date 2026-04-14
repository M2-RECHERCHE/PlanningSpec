import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppLayout, Topbar } from '../components/layout/AppLayout';
import { StatusBadge, Button, Input, Textarea, Modal, EmptyState } from '../components/ui';
import { useResponsive } from '../hooks/useResponsive';
import { Project } from '../types';

const PROJECT_COLORS = ['#38bdf8','#a78bfa','#34d399','#fb923c','#f472b6','#818cf8','#22d3ee','#fbbf24'];

const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Project Card ─────────────────────────────────────────────────────────────
const ProjectCard: React.FC<{ project: Project; onOpen: () => void; onDelete: () => void; onEdit: () => void }> = ({ project, onOpen, onDelete, onEdit }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { isMobile } = useResponsive();

  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border-default)'}`,
      borderRadius: '16px', padding: '20px', cursor: 'pointer',
      transition: 'all 0.2s ease', position: 'relative',
      transform: hovered ? 'translateY(-2px)' : 'none',
      boxShadow: hovered ? 'var(--shadow-md)' : 'none',
    }}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onClick={onOpen}>
      {/* Color bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '16px 16px 0 0', background: project.color, opacity: 0.8 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
        <div style={{ width: 44, height: 44, borderRadius: '12px', background: `${project.color}18`, border: `1px solid ${project.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: project.color, fontWeight: 700 }}>
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <StatusBadge status={project.status} />
          <div style={{ position: 'relative' }}>
            <button onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              padding: '4px 8px', borderRadius: '6px', fontSize: '16px', lineHeight: 1,
            }}>⋮</button>
            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={e => { e.stopPropagation(); setMenuOpen(false); }} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 100,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: '10px', overflow: 'hidden', boxShadow: 'var(--shadow-md)',
                  minWidth: 150,
                }}>
                  <button onClick={e => { e.stopPropagation(); onEdit(); setMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>✏ Modifier</button>
                  <button onClick={e => { e.stopPropagation(); onDelete(); setMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>✕ Supprimer</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</h3>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{project.description}</p>

      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <span>≡ {project.planCount} planification{project.planCount !== 1 ? 's' : ''}</span>
        <span>◷ {formatDate(project.updatedAt)}</span>
      </div>
    </div>
  );
};

// ─── New/Edit Project Modal ───────────────────────────────────────────────────
const ProjectModal: React.FC<{
  open: boolean; onClose: () => void; onSubmit: (name: string, desc: string, color: string) => Promise<Project | null>;
  initial?: Partial<Project>;
}> = ({ open, onClose, onSubmit, initial }) => {
  const [name, setName] = useState(initial?.name || '');
  const [desc, setDesc] = useState(initial?.description || '');
  const [color, setColor] = useState(initial?.color || PROJECT_COLORS[0]);

  React.useEffect(() => {
    if (open) { setName(initial?.name || ''); setDesc(initial?.description || ''); setColor(initial?.color || PROJECT_COLORS[0]); }
  }, [initial?.color, initial?.description, initial?.name, open]);

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Modifier le projet' : 'Nouveau projet'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input label="Nom du projet" placeholder="Mon projet de planification" value={name} onChange={setName} required />
        <Textarea label="Description" placeholder="Décrivez brièvement ce projet..." value={desc} onChange={setDesc} rows={3} />
        <div>
          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Couleur</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PROJECT_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${color === c ? '#fff' : 'transparent'}`,
                cursor: 'pointer', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s',
              }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={() => { if (name.trim()) { void onSubmit(name, desc, color).then(project => { if (project) { onClose(); } }); } }}>
            {initial?.id ? 'Enregistrer' : 'Créer le projet'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Projects List Page ───────────────────────────────────────────────────────
export const ProjectsPage: React.FC = () => {
  const { projects, navigate, createProject, deleteProject } = useApp();
  const { isMobile } = useResponsive();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [showNew, setShowNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = projects
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <Topbar title="Projets" subtitle={`${projects.length} projet${projects.length !== 1 ? 's' : ''} au total`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowNew(true)}
            style={{ width: isMobile ? '100%' : undefined }}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
            Nouveau projet
          </Button>
        }
      />

      <div style={{ flex: 1, padding: isMobile ? '16px' : '24px', overflowY: 'auto' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : undefined }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un projet..."
              style={{ width: '100%', padding: '9px 12px 9px 38px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: isMobile ? '100%' : undefined }}>
            {[['all', 'Tous'], ['active', 'Actifs'], ['completed', 'Terminés'], ['archived', 'Archivés']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${filter === v ? 'rgba(56,189,248,0.3)' : 'var(--border-default)'}`, background: filter === v ? 'var(--accent-dim)' : 'transparent', color: filter === v ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', flex: isMobile ? '1 1 calc(50% - 6px)' : undefined }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="◫" title="Aucun projet trouvé" description={search ? `Aucun résultat pour "${search}"` : "Créez votre premier projet pour commencer."}
            action={<Button variant="primary" onClick={() => setShowNew(true)}>Créer un projet</Button>}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 240 : 280}px, 1fr))`, gap: '14px' }} className="stagger">
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p}
                onOpen={() => navigate('projectDetail', { project: p })}
                onEdit={() => {}}
                onDelete={() => setDeleteConfirm(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectModal open={showNew} onClose={() => setShowNew(false)} onSubmit={createProject} />

      {/* Delete confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer le projet" width={400}>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Êtes-vous sûr de vouloir supprimer ce projet ? Toutes les planifications associées seront également supprimées. Cette action est irréversible.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => { if (deleteConfirm) { deleteProject(deleteConfirm); setDeleteConfirm(null); } }}>Supprimer</Button>
        </div>
      </Modal>
    </AppLayout>
  );
};

// ─── Project Detail Page ──────────────────────────────────────────────────────
export const ProjectDetailPage: React.FC = () => {
  const { selectedProject, plannings, navigate, createPlanning, deletePlanning } = useApp();
  const { isMobile, isCompact } = useResponsive();
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');

  if (!selectedProject) return null;

  const projectPlannings = plannings.filter(p => p.projectId === selectedProject.id);

  return (
    <AppLayout>
      <Topbar
        title={selectedProject.name}
        subtitle={`${projectPlannings.length} planification${projectPlannings.length !== 1 ? 's' : ''}`}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: isMobile ? '100%' : undefined }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('projects')} style={{ width: isMobile ? '100%' : undefined }}>← Projets</Button>
            <Button variant="primary" size="sm" onClick={() => setShowNewPlan(true)}
              style={{ width: isMobile ? '100%' : undefined }}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
              Nouvelle planification
            </Button>
          </div>
        }
      />

      <div style={{ flex: 1, padding: isMobile ? '16px' : '24px', overflowY: 'auto' }}>
        {/* Project info */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '20px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: selectedProject.color }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ width: 52, height: 52, borderRadius: '14px', background: `${selectedProject.color}18`, border: `1px solid ${selectedProject.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: selectedProject.color, fontWeight: 700, flexShrink: 0 }}>
              {selectedProject.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{selectedProject.name}</h2>
                <StatusBadge status={selectedProject.status} />
              </div>
              <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '14px' }}>{selectedProject.description}</p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>◫ {projectPlannings.length} planification{projectPlannings.length !== 1 ? 's' : ''}</span>
                <span>◷ Modifié le {formatDate(selectedProject.updatedAt)}</span>
                <span>✦ Créé le {formatDate(selectedProject.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Planifications</h3>
          {!isMobile && (
            <div style={{ display: 'flex', gap: '4px' }}>
            {(['cards', 'list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                padding: '6px 10px', borderRadius: '8px', border: 'none',
                background: viewMode === v ? 'var(--bg-elevated)' : 'transparent',
                color: viewMode === v ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '14px',
              }}>{v === 'cards' ? '⊞' : '≡'}</button>
            ))}
            </div>
          )}
        </div>

        {projectPlannings.length === 0 ? (
          <EmptyState icon="≡" title="Aucune planification" description="Ce projet n'a pas encore de planification."
            action={<Button variant="primary" onClick={() => setShowNewPlan(true)}>Créer une planification</Button>}
          />
        ) : (isMobile || viewMode === 'cards') ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 240 : 280}px, 1fr))`, gap: '12px' }} className="stagger">
            {projectPlannings.map(pl => (
              <div key={pl.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '16px', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.2)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.title}</h4>
                  <StatusBadge status={pl.status} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Étape {pl.currentStep}/{pl.totalSteps}</div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Progression</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>{pl.progress}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 999, background: 'var(--bg-elevated)' }}>
                    <div style={{ height: '100%', borderRadius: 999, width: `${pl.progress}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexDirection: isMobile ? 'column' : 'row' }}>
                  <button onClick={() => navigate('editor', { planning: pl })} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.06)', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                    {pl.status === 'done' ? 'Voir' : pl.status === 'draft' ? 'Démarrer' : 'Reprendre'}
                  </button>
                  <button onClick={() => setDeleteConfirm(pl.id)} style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.06)', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '14px', overflow: 'hidden' }}>
            {projectPlannings.map((pl, i) => (
              <div key={pl.id} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: i < projectPlannings.length - 1 ? '1px solid var(--border-subtle)' : 'none', transition: 'background 0.15s', flexWrap: isCompact ? 'wrap' : 'nowrap' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Étape {pl.currentStep}/{pl.totalSteps} · {formatDate(pl.updatedAt)}</div>
                </div>
                <div style={{ width: isCompact ? '100%' : 100 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pl.progress}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 999, background: 'var(--bg-elevated)' }}>
                    <div style={{ height: '100%', borderRadius: 999, width: `${pl.progress}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
                <StatusBadge status={pl.status} />
                <button onClick={() => navigate('editor', { planning: pl })} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
                  {pl.status === 'done' ? 'Voir' : 'Reprendre'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showNewPlan} onClose={() => setShowNewPlan(false)} title="Nouvelle planification">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Titre de la planification" placeholder="Ex: Planning Semestre 2 — Mathématiques" value={newPlanTitle} onChange={setNewPlanTitle} required />
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Projet : <strong style={{ color: 'var(--text-primary)' }}>{selectedProject.name}</strong></p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setShowNewPlan(false)}>Annuler</Button>
            <Button variant="primary" onClick={async () => {
              if (!newPlanTitle.trim()) {
                return;
              }

              const planning = await createPlanning(newPlanTitle, selectedProject.id);
              if (planning) {
                setShowNewPlan(false);
                setNewPlanTitle('');
                navigate('editor', { planning });
              }
            }}>Créer et ouvrir →</Button>
          </div>
        </div>
      </Modal>

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
