import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_X  = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-1';

const NAV_SECTIONS = [
  { href: '#use-cases',    label: "Cas d'usage"       },
  { href: '#how-it-works', label: 'Processus'          },
  { href: '#features',     label: 'Fonctionnalités'    },
  { href: '#constraints',  label: 'Contraintes'        },
  { href: '#faq',          label: 'FAQ'                },
];

const TRUST_ITEMS = [
  { name: 'MiniZinc', detail: 'Solveur de contraintes' },
  { name: 'Langium',  detail: 'Langage DSL'             },
  { name: 'HiGHS',    detail: 'Optimisation linéaire'  },
  { name: 'React 18', detail: 'Interface utilisateur'  },
  { name: 'MySQL',    detail: 'Persistance des données' },
];

const USE_CASES = [
  { tag: 'Académique',   title: 'Emplois du temps',         desc: "Assignez enseignants, salles et créneaux pour cours et examens. Gérez prérequis et incompatibilités." },
  { tag: 'Hospitalier',  title: 'Gardes & rotations',       desc: "Planifiez équipes soignantes en respectant les contraintes légales, qualifications et préférences." },
  { tag: 'Industriel',   title: 'Production en séquence',   desc: "Optimisez l'utilisation de machines, opérateurs et matières premières par équipe et par jour." },
  { tag: 'Construction', title: 'Chantiers & corps de métier', desc: "Coordonnez intervenants et équipements pour respecter jalons, dépendances et fenêtres d'intervention." },
  { tag: 'Logistique',   title: 'Tournées & livraisons',    desc: "Affectez véhicules et chauffeurs aux tournées en minimisant coûts et délais." },
  { tag: 'Événementiel', title: 'Sessions & intervenants',  desc: "Organisez conférences, ateliers et speakers sur plusieurs salles et créneaux." },
];

const HOW_IT_WORKS = [
  { n: '01', title: 'Créez un projet',         desc: "Organisez vos problèmes de planification en projets distincts. Nom, couleur et description." },
  { n: '02', title: "Définissez l'horizon",    desc: "Précisez les jours travaillés, les créneaux horaires, les horaires de début et de fin." },
  { n: '03', title: 'Ajoutez les activités',   desc: "Listez chaque activité avec son nombre d'instances et la durée en créneaux." },
  { n: '04', title: 'Déclarez les ressources', desc: "Créez des groupes (Enseignants, Salles, Machines) et listez leurs instances nommées." },
  { n: '05', title: 'Posez les contraintes',   desc: "Cardinalité, exclusivité, affectations fixes ou interdites — toutes vos règles." },
  { n: '06', title: 'Lancez la résolution',    desc: "Le solveur génère le planning optimal. Consultez les résultats et exportez." },
];

const FEATURE_LIST = [
  "Sauvegarde automatique à chaque étape",
  "Numéro d'étape courant mémorisé",
  "Données de planification entièrement préservées",
  "Reprise instantanée depuis le tableau de bord",
];

const CONSTRAINTS_LIST = [
  { label: 'Cardinalité',   desc: "Min. et max. de ressources d'un rôle par instance d'activité" },
  { label: 'Exclusivité',   desc: "Nombre max. d'utilisations simultanées d'une ressource" },
  { label: 'Fixe',          desc: "Forcer l'affectation d'une ressource spécifique à une instance" },
  { label: 'Interdit',      desc: "Empêcher l'affectation d'une ressource à une instance" },
  { label: 'Disponibilité', desc: "Éviter la participation d'une ressource à une date donnée" },
  { label: 'Charge max',    desc: "Limiter le nombre de participations par ressource et par scope" },
];

const ACTIVE_CONSTRAINTS = [
  { type: 'Cardinalité',   label: 'Cours magistral — 1 enseignant requis',       color: '#38bdf8' },
  { type: 'Exclusivité',   label: 'Salle B102 — 1 seul cours simultané',         color: '#a78bfa' },
  { type: 'Disponibilité', label: 'Prof. Martin — indisponible mer. AP',          color: '#fb923c' },
  { type: 'Interdit',      label: 'Prof. Dupont ne peut pas assurer TP Info',     color: '#f87171' },
  { type: 'Charge max',    label: 'Enseignants — max 3 créneaux par semaine',     color: '#34d399' },
];

const FAQ_ITEMS = [
  { q: 'Dois-je connaître la programmation par contraintes pour utiliser Planify ?',
    a: "Non. Planify est conçu pour être utilisé sans aucune connaissance en optimisation. Vous remplissez des formulaires guidés et le moteur gère la résolution automatiquement." },
  { q: 'Quelle est la taille maximale des problèmes que Planify peut résoudre ?',
    a: "Planify est adapté aux problèmes de taille petite à moyenne. Pour des problèmes très larges, le temps de résolution peut dépasser 30 secondes. Le solveur HiGHS est un solveur professionnel de classe mondiale." },
  { q: "Mes données sont-elles sauvegardées si je ferme l'onglet ?",
    a: "Oui. Chaque action dans l'éditeur déclenche une sauvegarde automatique en base de données. Vous pouvez fermer la page et reprendre exactement là où vous vous êtes arrêté." },
  { q: 'Puis-je modifier un planning après la résolution ?',
    a: "Oui. Vous pouvez retourner à n'importe quelle étape, modifier les données et relancer la résolution. L'historique complet est conservé." },
  { q: 'Quels types de contraintes sont supportées ?',
    a: "Planify supporte 4 types de contraintes structurelles (cardinalité, exclusivité, affectation fixe, interdite) et 2 types de préférences pondérées (éviter participation sur une date, limiter la charge par scope)." },
];

// ─── Global styles injected once ───────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes orb-drift-a {
    0%   { transform: translate(0px,   0px)   scale(1);    }
    33%  { transform: translate(60px,  -40px) scale(1.08); }
    66%  { transform: translate(-30px, 50px)  scale(0.95); }
    100% { transform: translate(0px,   0px)   scale(1);    }
  }
  @keyframes orb-drift-b {
    0%   { transform: translate(0px,  0px)   scale(1);    }
    40%  { transform: translate(-50px,35px)  scale(1.06); }
    70%  { transform: translate(40px, -25px) scale(0.97); }
    100% { transform: translate(0px,  0px)   scale(1);    }
  }
  @keyframes orb-drift-c {
    0%   { transform: translate(0,  0)   scale(1);    }
    50%  { transform: translate(20px,55px) scale(1.12); }
    100% { transform: translate(0,  0)   scale(1);    }
  }
  @keyframes grid-pan {
    from { background-position: 0 0; }
    to   { background-position: 40px 40px; }
  }
  @keyframes dot-drift {
    0%   { transform: translate(0,0);  }
    50%  { transform: translate(18px,-14px); }
    100% { transform: translate(0,0);  }
  }
  @keyframes beam-pulse {
    0%,100% { opacity: 0.12; }
    50%      { opacity: 0.28; }
  }
  @keyframes ring-expand {
    0%   { transform: scale(0.85); opacity: 0.5; }
    100% { transform: scale(1.6);  opacity: 0;   }
  }
  @keyframes spark-float {
    0%   { transform: translateY(0)   scale(1);   opacity: 0.7; }
    100% { transform: translateY(-80px) scale(0.3); opacity: 0; }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes badge-glow {
    0%,100% { box-shadow: 0 0 0 0 rgba(56,189,248,0); }
    50%      { box-shadow: 0 0 18px 4px rgba(56,189,248,0.18); }
  }
  .planify-hero-badge    { animation: badge-glow 3s ease-in-out infinite; }
  .planify-fade-up       { animation: fade-up 0.7s cubic-bezier(.22,1,.36,1) both; }
  .planify-fade-up-d1    { animation-delay: 0.12s; }
  .planify-fade-up-d2    { animation-delay: 0.22s; }
  .planify-fade-up-d3    { animation-delay: 0.32s; }
  .planify-fade-up-d4    { animation-delay: 0.42s; }
  .planify-card-hover    { transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease; }
  .planify-card-hover:hover { transform: translateY(-3px); border-color: rgba(56,189,248,0.22) !important; }
`;

// ─── Background FX ─────────────────────────────────────────────────────────────
const BackgroundFX: React.FC = () => (
  <>
    <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>

      {/* Deep base gradient */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 120% 80% at 50% -20%, #071222 0%, #04080f 55%, #020609 100%)',
      }} />

      {/* Animated grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: [
          'linear-gradient(rgba(148,163,184,0.055) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(148,163,184,0.055) 1px, transparent 1px)',
        ].join(','),
        backgroundSize: '40px 40px',
        animation: 'grid-pan 32s linear infinite',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 80%)',
      }} />

      {/* Dot matrix */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(rgba(56,189,248,0.22) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        animation: 'dot-drift 14s ease-in-out infinite',
        maskImage: 'radial-gradient(circle at 50% 35%, black, transparent 65%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 35%, black, transparent 65%)',
        opacity: 0.5,
      }} />

      {/* Coloured light orbs */}
      <div className="absolute" style={{
        top: '-10%', left: '-8%', width: '55vw', height: '55vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,189,248,0.13) 0%, transparent 65%)',
        animation: 'orb-drift-a 22s ease-in-out infinite',
      }} />
      <div className="absolute" style={{
        top: '10%', right: '-12%', width: '45vw', height: '45vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.11) 0%, transparent 65%)',
        animation: 'orb-drift-b 26s ease-in-out infinite',
      }} />
      <div className="absolute" style={{
        bottom: '-15%', left: '20%', width: '50vw', height: '50vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 65%)',
        animation: 'orb-drift-c 18s ease-in-out infinite',
      }} />

      {/* Horizontal light beams */}
      <div className="absolute inset-x-0" style={{ top: '22%', height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.18) 30%, rgba(139,92,246,0.18) 70%, transparent 100%)', animation: 'beam-pulse 6s ease-in-out infinite' }} />
      <div className="absolute inset-x-0" style={{ top: '60%', height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.12) 40%, rgba(56,189,248,0.12) 70%, transparent 100%)', animation: 'beam-pulse 8s ease-in-out infinite 2s' }} />

      {/* Corner glow accents */}
      <div className="absolute" style={{ top: 0, left: 0, width: '35vw', height: '35vw', background: 'radial-gradient(circle at 0% 0%, rgba(56,189,248,0.07) 0%, transparent 60%)' }} />
      <div className="absolute" style={{ bottom: 0, right: 0, width: '30vw', height: '30vw', background: 'radial-gradient(circle at 100% 100%, rgba(139,92,246,0.07) 0%, transparent 60%)' }} />
    </div>
  </>
);

// ─── Inline SVG icons ───────────────────────────────────────────────────────────
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IconSave = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);
const IconCpu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);
const IconLayers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);
const IconSliders = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
    <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
    <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
  </svg>
);
const IconZap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

// Feature grid data
const FEATURE_GRID = [
  { Icon: IconLayers,  color: 'text-sky-400',     bg: 'bg-sky-400/[0.09]',     title: 'Multi-projets',             desc: "Gérez plusieurs problèmes en parallèle depuis un espace unique." },
  { Icon: IconCpu,     color: 'text-violet-400',  bg: 'bg-violet-400/[0.09]',  title: 'Solveur MiniZinc / HiGHS',  desc: "Moteur de résolution par contraintes éprouvé en R.O." },
  { Icon: IconSliders, color: 'text-emerald-400', bg: 'bg-emerald-400/[0.09]', title: '4 types de contraintes',    desc: "Cardinalité, exclusivité, fixe ou interdite — tout est couvert." },
  { Icon: IconZap,     color: 'text-orange-400',  bg: 'bg-orange-400/[0.09]',  title: 'Résultats en < 30 s',       desc: "La solution est générée en quelques secondes pour la plupart des problèmes." },
  { Icon: IconCalendar,color: 'text-sky-400',     bg: 'bg-sky-400/[0.09]',     title: 'Export & impression',       desc: "Consultez et exportez le planning directement depuis l'application." },
  { Icon: IconLayers,  color: 'text-violet-400',  bg: 'bg-violet-400/[0.09]',  title: 'Tableau de bord',           desc: "Suivez l'avancement de toutes vos planifications centralisées." },
];

// ─── Sub-components ─────────────────────────────────────────────────────────────

const LogoBrand: React.FC = () => (
  <div className="flex items-center gap-2.5">
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-[14px] text-[#03060c] flex-shrink-0"
      style={{
        background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
        boxShadow: '0 0 16px rgba(56,189,248,0.4)',
      }}
    >P</div>
    <span className="font-bold text-[16px] tracking-tight text-slate-50">Planify</span>
  </div>
);

const CtaPrimary: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full sm:w-auto px-7 py-3 rounded-xl text-[14px] font-semibold text-[#03060c] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
    style={{
      background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
      boxShadow: '0 4px 20px rgba(56,189,248,0.32), 0 1px 0 rgba(255,255,255,0.15) inset',
    }}
  >{children}</button>
);

const CtaGhost: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full sm:w-auto px-7 py-3 rounded-xl text-[14px] font-medium text-slate-300 border border-white/[0.1] bg-white/[0.03] hover:border-white/[0.22] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
  >{children}</button>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="inline-flex items-center gap-2 text-[11px] font-bold text-sky-400 uppercase tracking-[0.2em] mb-3">
    <span className="w-4 h-px bg-sky-400/50" />
    {children}
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-[26px] sm:text-[32px] font-bold tracking-tight text-slate-50 mb-3 leading-tight">{children}</h2>
);

const SectionDesc: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[14.5px] sm:text-[16px] text-slate-500 leading-relaxed max-w-2xl">{children}</p>
);

// ─── App Mockup ──────────────────────────────────────────────────────────────────
const MOCKUP_STEPS = [
  { n: 1, done: true,  active: false, locked: false },
  { n: 2, done: true,  active: false, locked: false },
  { n: 3, done: false, active: true,  locked: false },
  { n: 4, done: false, active: false, locked: true  },
  { n: 5, done: false, active: false, locked: true  },
  { n: 6, done: false, active: false, locked: true  },
  { n: 7, done: false, active: false, locked: true  },
];

const AppMockup: React.FC = () => (
  <div className="relative w-full">
    {/* Outer glow ring */}
    <div className="absolute -inset-px rounded-2xl" style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.3),rgba(139,92,246,0.2),transparent 60%)', padding: '1px' }}>
      <div className="w-full h-full rounded-2xl bg-[#080d16]" />
    </div>

    <div
      className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-[#080d16]"
      style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}
    >
      {/* Chrome */}
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#0b1120] border-b border-white/[0.055]">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-orange-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-2 flex items-center gap-1.5 flex-1">
          <div className="h-3.5 w-4 rounded bg-white/[0.04]" />
          <div className="h-3.5 flex-1 max-w-[160px] rounded bg-white/[0.04]" />
        </div>
      </div>

      <div className="flex min-h-[260px]">
        {/* Sidebar */}
        <div className="hidden sm:flex w-44 bg-[#0a0f1a] border-r border-white/[0.045] p-3 flex-col gap-1.5 flex-shrink-0">
          {MOCKUP_STEPS.map((s) => (
            <div key={s.n} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${s.active ? 'bg-sky-400/[0.09]' : ''} ${s.locked ? 'opacity-25' : ''}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${s.done ? 'bg-emerald-400 text-[#04080f]' : s.active ? 'bg-sky-400 text-[#04080f]' : 'bg-white/[0.07] text-slate-600'}`}>
                {s.done ? '✓' : s.n}
              </div>
              <div className={`h-1.5 flex-1 rounded-full ${s.active ? 'bg-sky-400/30' : s.done ? 'bg-emerald-400/25' : 'bg-white/[0.05]'}`} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-5 min-w-0">
          <div className="h-2.5 rounded bg-white/10 w-36 mb-1.5" />
          <div className="h-1.5 rounded bg-white/[0.04] w-52 mb-5" />
          {[72, 50, 84].map((w, i) => (
            <div key={i} className="mb-3.5">
              <div className="h-1.5 rounded bg-white/[0.06] mb-1.5" style={{ width: `${w}%` }} />
              <div className="h-8 rounded-lg border border-white/[0.07] bg-white/[0.025]" />
            </div>
          ))}
          <div className="flex gap-2 justify-end mt-5">
            <div className="h-7 w-18 rounded-lg border border-white/[0.07] bg-white/[0.035]" style={{ width: 68 }} />
            <div className="h-7 rounded-lg" style={{ width: 88, background: 'linear-gradient(135deg,rgba(56,189,248,0.85),rgba(14,165,233,0.85))' }} />
          </div>
        </div>
      </div>
    </div>

    {/* Bottom glow */}
    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-16 -z-10"
      style={{ background: 'rgba(56,189,248,0.08)', filter: 'blur(32px)', borderRadius: '50%' }} />
  </div>
);

// ─── Main LandingPage ────────────────────────────────────────────────────────────
export const LandingPage: React.FC = () => {
  const { navigate } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq]       = useState<number | null>(null);
  const [scrolled, setScrolled]     = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="relative min-h-screen bg-[#04080f] text-slate-200 overflow-x-hidden antialiased">
      <BackgroundFX />

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
        style={{
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
          background: scrolled ? 'rgba(4,8,15,0.88)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        }}
      >
        <div className={`${PAGE_X} h-16 flex items-center gap-4`}>
          <button onClick={() => window.scrollTo(0,0)} className="flex-shrink-0" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><LogoBrand /></button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-0.5 ml-6">
            {NAV_SECTIONS.map(s => (
              <a key={s.href} href={s.href}
                className="px-3.5 py-2 rounded-lg text-[13.5px] font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] transition-all duration-150">
                {s.label}
              </a>
            ))}
          </div>

          <div className="flex-1" />

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => navigate('login')}
              className="px-4 py-2 rounded-lg text-[13.5px] text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
              Connexion
            </button>
            <button onClick={() => navigate('register')}
              className="px-5 py-2 rounded-xl text-[13.5px] font-semibold text-[#03060c] transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', boxShadow: '0 4px 14px rgba(56,189,248,0.28)' }}>
              Créer un compte
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(o => !o)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Menu">
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/[0.07] bg-[#070d18]/97 backdrop-blur-xl">
            <div className={`${PAGE_X} py-3 flex flex-col gap-1`}>
              {NAV_SECTIONS.map(s => (
                <a key={s.href} href={s.href} onClick={closeMobile}
                  className="block px-3 py-3 rounded-xl text-[14px] font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors">
                  {s.label}
                </a>
              ))}
              <div className="mt-3 pt-3 border-t border-white/[0.07] flex flex-col gap-2.5">
                <button onClick={() => { navigate('login'); closeMobile(); }}
                  className="w-full py-3 text-[14px] font-medium text-slate-100 border border-white/[0.1] rounded-xl hover:bg-white/[0.05] transition-colors">
                  Connexion
                </button>
                <button onClick={() => { navigate('register'); closeMobile(); }}
                  className="w-full py-3 text-[14px] font-semibold text-[#03060c] rounded-xl transition-colors"
                  style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)' }}>
                  Créer un compte
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Spacer */}
      <div className="h-16" />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative z-[1] pt-12 pb-16 sm:pt-20 sm:pb-20">
        <div className={`${PAGE_X} grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-16 items-center`}>

          {/* Left copy */}
          <div className="text-center xl:text-left">
            {/* Badge */}
            <div className="planify-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sky-400 text-[12px] font-medium tracking-wide mb-7 planify-hero-badge"
              style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" style={{ boxShadow: '0 0 6px #38bdf8' }} />
              Résolution automatique · Moteur MiniZinc · Gratuit
            </div>

            <h1 className="planify-fade-up planify-fade-up-d1 text-[clamp(34px,5.5vw,60px)] font-extrabold tracking-tighter leading-[1.04] mb-5 text-white">
              Planification de ressources
              <br />
              <span style={{ background: 'linear-gradient(95deg,#38bdf8 0%,#a5f3fc 40%,#a78bfa 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                pilotée par contraintes
              </span>
            </h1>

            <p className="planify-fade-up planify-fade-up-d2 text-[15.5px] sm:text-[17px] text-slate-400 leading-relaxed mb-8 xl:pr-6">
              Décrivez vos activités, ressources et règles métier en quelques étapes.
              Notre solveur génère automatiquement le planning optimal, que vous pouvez
              visualiser et exporter.
            </p>

            <div className="planify-fade-up planify-fade-up-d3 flex flex-col sm:flex-row xl:justify-start items-center justify-center gap-3 mb-10">
              <CtaPrimary onClick={() => navigate('register')}>Commencer gratuitement</CtaPrimary>
              <CtaGhost   onClick={() => navigate('login')}>Se connecter</CtaGhost>
            </div>

            {/* Stats */}
            <div className="planify-fade-up planify-fade-up-d4 grid grid-cols-3 rounded-2xl overflow-hidden border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.018)' }}>
              {[
                { value: '15+',   label: 'Types de contraintes' },
                { value: '< 30s', label: 'Temps de résolution'  },
                { value: '100%',  label: 'Gratuit'              },
              ].map((s, i) => (
                <div key={s.label} className={`py-4 text-center ${i < 2 ? 'border-r border-white/[0.06]' : ''}`}>
                  <div className="text-[17px] font-bold text-slate-50 tracking-tight">{s.value}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right mockup */}
          <div className="w-full planify-fade-up planify-fade-up-d2">
            <AppMockup />
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ────────────────────────────────────────────────────────── */}
      <div className="relative z-[1] border-y border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.012)' }}>
        <div className={`${PAGE_X} py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3`}>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Propulsé par</span>
          {TRUST_ITEMS.map(t => (
            <div key={t.name} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-sky-400/40" />
              <span className="text-[13px] text-slate-400">{t.name}</span>
              <span className="text-[12px] text-slate-700 hidden sm:inline">— {t.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── USE CASES ────────────────────────────────────────────────────────── */}
      <section id="use-cases" className="relative z-[1] scroll-mt-20 border-b border-white/[0.048] py-16 sm:py-20">
        <div className={PAGE_X}>
          <SectionLabel>Cas d'usage</SectionLabel>
          <SectionTitle>Adapté à tous les secteurs</SectionTitle>
          <SectionDesc>Tout contexte où des ressources doivent être affectées à des tâches en respectant des règles complexes et des contraintes temporelles.</SectionDesc>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {USE_CASES.map((u) => (
              <div key={u.title} className="planify-card-hover p-6 rounded-2xl border border-white/[0.055] bg-white/[0.02] group cursor-default">
                <span className="inline-block px-2.5 py-1 mb-4 rounded-lg text-[10.5px] font-bold uppercase tracking-wider text-sky-400 border border-sky-400/[0.2]"
                  style={{ background: 'rgba(56,189,248,0.06)' }}>
                  {u.tag}
                </span>
                <div className="font-semibold text-[15px] text-slate-200 mb-2 group-hover:text-white transition-colors">{u.title}</div>
                <div className="text-[13.5px] text-slate-500 leading-relaxed">{u.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center xl:justify-start">
            <a href="#how-it-works" className="inline-flex items-center gap-2 text-sky-400 text-[13.5px] font-medium hover:text-sky-300 transition-colors">
              Voir comment ça fonctionne <IconArrow />
            </a>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-[1] scroll-mt-20 border-b border-white/[0.048] py-16 sm:py-20" style={{ background: 'rgba(255,255,255,0.008)' }}>
        <div className={PAGE_X}>
          <SectionLabel>Processus</SectionLabel>
          <SectionTitle>Six étapes vers un planning optimal</SectionTitle>
          <SectionDesc>Un assistant guidé pour décrire entièrement votre problème de planification, puis le moteur s'occupe du reste.</SectionDesc>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.n} className="planify-card-hover relative p-6 rounded-xl border border-white/[0.055] bg-white/[0.02]">
                {/* Step number — decorative */}
                <div className="text-[11px] font-bold text-sky-400/35 tracking-widest mb-3 font-mono">{s.n}</div>
                {/* Connecting arrow (desktop only) */}
                {i < 5 && (i + 1) % 3 !== 0 && (
                  <div className="hidden lg:flex absolute top-6 -right-2 z-10 text-sky-400/20">
                    <IconArrow />
                  </div>
                )}
                <div className="font-semibold text-[15px] text-slate-100 mb-2">{s.title}</div>
                <div className="text-[13.5px] text-slate-500 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center xl:justify-start">
            <CtaPrimary onClick={() => navigate('register')}>
              <span className="inline-flex items-center gap-2">Démarrer maintenant <IconArrow /></span>
            </CtaPrimary>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" className="relative z-[1] scroll-mt-20 border-b border-white/[0.048] py-16 sm:py-20">
        <div className={PAGE_X}>
          <SectionLabel>Fonctionnalités</SectionLabel>
          <SectionTitle>Tout ce qu'il vous faut</SectionTitle>

          <div className="mt-10 grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Highlight card */}
            <div className="p-7 rounded-2xl border border-sky-400/[0.14]" style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.04) 0%,rgba(139,92,246,0.03) 100%)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sky-400 mb-4" style={{ background: 'rgba(56,189,248,0.1)' }}>
                <IconSave />
              </div>
              <div className="font-bold text-[17px] text-slate-50 mb-2">Reprise automatique à chaque étape</div>
              <div className="text-[14px] text-slate-400 leading-relaxed mb-5">
                Quittez à n'importe quelle étape du wizard. Votre progression est sauvegardée automatiquement — revenez exactement là où vous vous êtes arrêté, sans perdre aucune donnée.
              </div>
              <ul className="flex flex-col gap-2.5">
                {FEATURE_LIST.map(f => (
                  <li key={f} className="flex items-center gap-3 text-[13.5px] text-slate-300">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-emerald-400 flex-shrink-0"
                      style={{ background: 'rgba(52,211,153,0.1)' }}>
                      <IconCheck />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURE_GRID.map(({ Icon, color, bg, title, desc }) => (
                <div key={title} className="planify-card-hover p-5 rounded-xl border border-white/[0.055] bg-white/[0.02]">
                  <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center mb-3`}>
                    <Icon />
                  </div>
                  <div className="font-semibold text-[13.5px] text-slate-200 mb-1.5">{title}</div>
                  <div className="text-[12.5px] text-slate-500 leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONSTRAINTS ──────────────────────────────────────────────────────── */}
      <section id="constraints" className="relative z-[1] scroll-mt-20 border-b border-white/[0.048] py-16 sm:py-20" style={{ background: 'rgba(255,255,255,0.008)' }}>
        <div className={`${PAGE_X} grid grid-cols-1 xl:grid-cols-2 gap-12 xl:gap-16 items-start`}>
          <div>
            <SectionLabel>Contraintes</SectionLabel>
            <h2 className="text-[26px] sm:text-[30px] font-bold mb-3 tracking-tight text-slate-50 leading-tight">
              Exprimez toutes vos règles métier
            </h2>
            <p className="text-[14px] sm:text-[15px] text-slate-500 leading-relaxed mb-7">
              Planify prend en charge une large variété de contraintes pour modéliser fidèlement votre problème réel, des plus simples aux plus complexes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONSTRAINTS_LIST.map(c => (
                <div key={c.label} className="flex gap-3 items-start p-3.5 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                  <span className="flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-sky-400 border border-sky-400/[0.18]"
                    style={{ background: 'rgba(56,189,248,0.06)' }}>
                    {c.label}
                  </span>
                  <span className="text-[12.5px] text-slate-500 leading-relaxed">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Constraint demo */}
          <div className="rounded-2xl border border-white/[0.07] p-5 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.018)' }}>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Contraintes actives — 5 règles</span>
              <span className="text-[10.5px] px-2.5 py-1 rounded-lg font-medium text-emerald-400"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
                Modèle valide
              </span>
            </div>

            {ACTIVE_CONSTRAINTS.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.022)' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}60` }} />
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                  style={{ color: c.color, background: `${c.color}14` }}>
                  {c.type}
                </span>
                <span className="text-[13px] text-slate-400 flex-1 truncate">{c.label}</span>
                <span className="text-emerald-400 text-[11px] font-bold flex-shrink-0">✓</span>
              </div>
            ))}

            {/* Progress */}
            <div className="mt-1 px-4 py-3.5 rounded-xl border border-emerald-400/[0.16]" style={{ background: 'rgba(52,211,153,0.04)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[12.5px] font-semibold text-emerald-400">Résolution en cours — MiniZinc · HiGHS</span>
                <span className="text-[11px] text-emerald-400/60">72%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(52,211,153,0.1)' }}>
                <div className="h-full w-[72%] rounded-full" style={{ background: 'linear-gradient(90deg,#34d399,#10b981)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section id="faq" className="relative z-[1] scroll-mt-20 border-b border-white/[0.048] py-16 sm:py-20">
        <div className={PAGE_X}>
          <SectionLabel>FAQ</SectionLabel>
          <SectionTitle>Questions fréquentes</SectionTitle>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="rounded-xl border border-white/[0.055] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
                  style={{ background: openFaq === i ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.018)' }}
                >
                  <span className="text-[14px] font-medium text-slate-200">{item.q}</span>
                  <span className={`text-slate-500 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}>
                    <IconChevronDown />
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 pt-0 text-[13.5px] text-slate-400 leading-relaxed border-t border-white/[0.04]"
                    style={{ background: 'rgba(255,255,255,0.01)' }}>
                    <p className="mt-4">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ──────────────────────────────────────────────────────── */}
      <section className="relative z-[1] py-20 sm:py-28 overflow-hidden">
        {/* Radial glow behind CTA */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(56,189,248,0.06) 0%, transparent 70%)' }} />

        <div className={`${PAGE_X} text-center relative`}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sky-400 text-[12px] font-medium mb-6"
            style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.18)' }}>
            Gratuit · Sans carte de crédit
          </div>
          <h2 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight text-white mb-4 leading-tight">
            Prêt à automatiser votre planification ?
          </h2>
          <p className="text-[15px] sm:text-[16px] text-slate-400 leading-relaxed mb-9 max-w-lg mx-auto">
            Créez votre compte, décrivez votre problème et obtenez un planning optimal en quelques minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <CtaPrimary onClick={() => navigate('register')}>Créer mon compte gratuitement</CtaPrimary>
            <CtaGhost   onClick={() => navigate('login')}>J'ai déjà un compte</CtaGhost>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-[1] border-t border-white/[0.06]" style={{ background: '#030609' }}>
        <div className={`${PAGE_X} py-12`}>

          {/* Top grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-10 mb-10">

            {/* Brand column */}
            <div className="xl:col-span-1">
              <LogoBrand />
              <p className="mt-4 text-[13px] text-slate-600 leading-relaxed max-w-[220px]">
                Créez, modélisez et résolvez vos problèmes de planification dans une interface claire et moderne.
              </p>
            </div>

            {/* Nav column */}
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-4">Navigation</h3>
              <div className="flex flex-col gap-2.5">
                {NAV_SECTIONS.map(s => (
                  <a key={s.href} href={s.href}
                    className="text-[13.5px] text-slate-600 hover:text-slate-300 transition-colors">
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-4">Ressources</h3>
              <div className="flex flex-col gap-2.5">
                {['Documentation', 'API', 'Support', 'Contact'].map(l => (
                  <button key={l} className="text-[13.5px] text-slate-600 hover:text-slate-300 transition-colors" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-4">Légal</h3>
              <div className="flex flex-col gap-2.5">
                {['Confidentialité', 'Conditions', 'Mentions légales'].map(l => (
                  <button key={l} className="text-[13.5px] text-slate-600 hover:text-slate-300 transition-colors" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.05]" />

          {/* Bottom bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[12.5px] text-slate-700">© 2026 Planify — Tous droits réservés</span>
            <div className="flex items-center gap-2 text-[12px] text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60"
                style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
              Tous les systèmes opérationnels
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;