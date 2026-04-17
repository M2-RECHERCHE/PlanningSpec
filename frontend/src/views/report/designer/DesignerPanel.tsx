import React, { useState } from 'react';
import type { PlanningReport } from '../../../lib/reportApi';
import type {
  ReportDesignOptions, ReportPageSize, PageOrientation,
  FontFamily, TableStyle, HeaderStyle, PageMargin,
} from './types';
import { PALETTE } from '../palette';

// ─── Shared styles ────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  marginBottom: 6,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  userSelect: 'none',
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: 'var(--border-subtle)',
  margin: '4px -16px',
};

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  padding: '3px 0',
  gap: 8,
};

const SELECT: React.CSSProperties = {
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: 12,
  cursor: 'pointer',
  flexShrink: 0,
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

const RANGE: React.CSSProperties = { width: 80, cursor: 'pointer' };
const COLOR_SWATCH: React.CSSProperties = {
  width: 28, height: 28, padding: 2,
  border: '1px solid var(--border-default)',
  borderRadius: 6, cursor: 'pointer',
  background: 'transparent', flexShrink: 0,
};

// ─── Small components ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 34, height: 18, borderRadius: 9,
        background: checked ? 'var(--accent)' : 'var(--border-default)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', width: 12, height: 12,
        borderRadius: '50%', background: '#fff',
        top: 3, left: checked ? 19 : 3,
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </div>
  );
}

function Section({
  title, icon, children, defaultOpen = true,
}: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div style={SECTION_TITLE} onClick={() => setOpen(o => !o)}>
        <span>{icon}</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
      </div>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>}
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={ROW}>
      <span style={{ color: 'var(--text-secondary)', flex: 1, fontSize: 12 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{value}</span>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={COLOR_SWATCH} />
      </div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-base)', borderRadius: 7, padding: 2 }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 500,
            borderRadius: 5, border: 'none', cursor: 'pointer',
            background: value === o.value ? 'var(--bg-elevated)' : 'transparent',
            color: value === o.value ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: value === o.value ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
            transition: 'all 0.12s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  report: PlanningReport;
  opts: ReportDesignOptions;
  onChange: (patch: Partial<ReportDesignOptions>) => void;
}

export const DesignerPanel: React.FC<Props> = ({ report, opts, onChange }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Page ── */}
      <Section title="Page" icon="📄">
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Format</span>
          <select value={opts.pageSize} onChange={e => onChange({ pageSize: e.target.value as ReportPageSize })} style={SELECT}>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="LETTER">Letter</option>
          </select>
        </div>
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Orientation</span>
          <select value={opts.orientation} onChange={e => onChange({ orientation: e.target.value as PageOrientation })} style={SELECT}>
            <option value="portrait">Portrait</option>
            <option value="landscape">Paysage</option>
          </select>
        </div>
        <div style={{ ...ROW }}>
          <span style={{ color: 'var(--text-secondary)' }}>Marges</span>
          <SegmentedControl<PageMargin>
            value={opts.pageMargin}
            onChange={v => onChange({ pageMargin: v })}
            options={[
              { value: 'tight', label: 'Serré' },
              { value: 'normal', label: 'Normal' },
              { value: 'wide', label: 'Large' },
            ]}
          />
        </div>
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>N° de page</span>
          <Toggle checked={opts.showPageNumbers} onChange={v => onChange({ showPageNumbers: v })} />
        </div>
      </Section>

      <div style={DIVIDER} />

      {/* ── Texte ── */}
      <Section title="Contenu" icon="✏️">
        <div style={LABEL}>Titre</div>
        <input style={INPUT} placeholder={report.title} value={opts.title} onChange={e => onChange({ title: e.target.value })} />
        <div style={LABEL}>Sous-titre</div>
        <input style={INPUT} placeholder="Sous-titre optionnel…" value={opts.subtitle} onChange={e => onChange({ subtitle: e.target.value })} />
        <div style={LABEL}>Texte de pied de page</div>
        <input style={INPUT} placeholder={opts.title || report.title} value={opts.footerText} onChange={e => onChange({ footerText: e.target.value })} />
      </Section>

      <div style={DIVIDER} />

      {/* ── Sections ── */}
      <Section title="Sections" icon="🗂️">
        {([
          { key: 'showCoverPage', label: 'Page de garde' },
          { key: 'showCalendar', label: 'Calendrier' },
          { key: 'showDetailTable', label: 'Tableau détail' },
          { key: 'showResourcesView', label: 'Par ressource' },
          { key: 'showSolveTime', label: 'Temps de résolution' },
          { key: 'showWarnings', label: 'Avertissements' },
        ] as Array<{ key: keyof ReportDesignOptions; label: string }>).map(({ key, label }) => (
          <div key={key} style={ROW}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <Toggle checked={opts[key] as boolean} onChange={v => onChange({ [key]: v })} />
          </div>
        ))}
      </Section>

      <div style={DIVIDER} />

      {/* ── Typographie ── */}
      <Section title="Typographie" icon="🔤">
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Police</span>
          <select value={opts.font} onChange={e => onChange({ font: e.target.value as FontFamily })} style={SELECT}>
            <option value="Helvetica">Helvetica</option>
            <option value="Times-Roman">Times Roman</option>
            <option value="Courier">Courier</option>
          </select>
        </div>
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Corps ({opts.bodyFontSize}pt)</span>
          <input type="range" min={7} max={12} step={1} value={opts.bodyFontSize}
            onChange={e => onChange({ bodyFontSize: Number(e.target.value) })}
            style={RANGE}
          />
        </div>
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Titres ({opts.headerFontSize}pt)</span>
          <input type="range" min={10} max={18} step={1} value={opts.headerFontSize}
            onChange={e => onChange({ headerFontSize: Number(e.target.value) })}
            style={RANGE}
          />
        </div>
      </Section>

      <div style={DIVIDER} />

      {/* ── Tableaux ── */}
      <Section title="Tableaux" icon="📊">
        <div style={{ ...ROW, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div style={LABEL}>Style de tableau</div>
          <SegmentedControl<TableStyle>
            value={opts.tableStyle}
            onChange={v => onChange({ tableStyle: v })}
            options={[
              { value: 'striped', label: 'Zébré' },
              { value: 'bordered', label: 'Bordures' },
              { value: 'minimal', label: 'Minimal' },
            ]}
          />
        </div>
        <div style={{ ...ROW, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div style={LABEL}>Style d'en-tête</div>
          <SegmentedControl<HeaderStyle>
            value={opts.headerStyle}
            onChange={v => onChange({ headerStyle: v })}
            options={[
              { value: 'filled', label: 'Plein' },
              { value: 'outline', label: 'Contour' },
              { value: 'underline', label: 'Souliqné' },
            ]}
          />
        </div>
        <ColorRow label="Lignes paires" value={opts.rowEvenColor}
          onChange={v => onChange({ rowEvenColor: v })} />
        <ColorRow label="Bordures" value={opts.tableBorderColor}
          onChange={v => onChange({ tableBorderColor: v })} />
      </Section>

      <div style={DIVIDER} />

      {/* ── Couleurs thème ── */}
      <Section title="Thème" icon="🎨">
        <ColorRow label="Couleur principale" value={opts.primaryColor}
          onChange={v => onChange({ primaryColor: v })} />
        <ColorRow label="Couleur accent" value={opts.accentColor}
          onChange={v => onChange({ accentColor: v })} />
        <ColorRow label="Fond de couverture" value={opts.coverBg}
          onChange={v => onChange({ coverBg: v })} />
      </Section>

      <div style={DIVIDER} />

      {/* ── Couleurs activités ── */}
      {report.stats.activityTypes.length > 0 && (
        <Section title="Activités" icon="🏷️" defaultOpen={false}>
          {report.stats.activityTypes.map((name, i) => {
            const color = opts.activityColors[name] ?? PALETTE[i % PALETTE.length];
            return (
              <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="color"
                  value={color}
                  onChange={e => onChange({ activityColors: { ...opts.activityColors, [name]: e.target.value } })}
                  style={{ ...COLOR_SWATCH, width: 24, height: 24 }}
                />
                <span style={{
                  flex: 1, padding: '2px 8px', borderRadius: 999,
                  background: color + '18', color,
                  border: `1px solid ${color}40`,
                  fontSize: 11, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {name}
                </span>
              </label>
            );
          })}
        </Section>
      )}

    </div>
  );
};
