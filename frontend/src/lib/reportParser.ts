// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityInstance {
  instance: string;     // "Soutenance_1"
  baseName: string;     // "Soutenance"
  instanceNum: number;
  globalSlot: number;
  localSlot: number;    // slot dans la journée (1-based)
  day: number;          // numéro du jour (1-based)
  dayName: string;      // "Lundi"
  assignments: string[];
  roles: Array<{ role: string; resource: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitBaseName(instance: string): { baseName: string; instanceNum: number } {
  const m = instance.match(/^(.+)_(\d+)$/);
  return m ? { baseName: m[1], instanceNum: parseInt(m[2], 10) } : { baseName: instance, instanceNum: 1 };
}

function toLocalSlot(globalSlot: number, day: number, slotsPerDay: number): number {
  return slotsPerDay > 0 ? globalSlot - (day - 1) * slotsPerDay : globalSlot;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse les deux formats de sortie MiniZinc :
 *   Nouveau (après fix generator) : "ACTIVITY: Soutenance_1 slot=1 day=1"
 *   Ancien                        : "Soutenance_1 starts=1 day=1"
 */
export function parseOutput(
  raw: string,
  days: string[],
  slotsPerDay: number,
): ActivityInstance[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const useNewFormat = lines.some(l => l.startsWith('ACTIVITY:'));
  const map = new Map<string, ActivityInstance>();

  for (const line of lines) {
    if (useNewFormat) {
      const actM = line.match(/^ACTIVITY:\s+(\S+)\s+slot=(\d+)\s+day=(\d+)/);
      if (actM) {
        const [, instance, slotStr, dayStr] = actM;
        const globalSlot = parseInt(slotStr, 10);
        const day = parseInt(dayStr, 10);
        const { baseName, instanceNum } = splitBaseName(instance);
        map.set(instance, {
          instance, baseName, instanceNum,
          globalSlot, localSlot: toLocalSlot(globalSlot, day, slotsPerDay),
          day, dayName: days[day - 1] ?? `Jour ${day}`,
          assignments: [], roles: [],
        });
        continue;
      }
      const asM = line.match(/^ASSIGNMENT:\s+(\S+)\s+resource=(.+)$/);
      if (asM) { map.get(asM[1])?.assignments.push(asM[2]); continue; }
      const rlM = line.match(/^ROLE:\s+(\S+)\s+role=(\S+)\s+resource=(.+)$/);
      if (rlM) { map.get(rlM[1])?.roles.push({ role: rlM[2], resource: rlM[3] }); }
    } else {
      // Ancien format : "Soutenance_1 starts=24 day=3"
      const m = line.match(/^(\S+)\s+starts=(\d+)\s+day=(\d+)/);
      if (m) {
        const [, instance, slotStr, dayStr] = m;
        const globalSlot = parseInt(slotStr, 10);
        const day = parseInt(dayStr, 10);
        const { baseName, instanceNum } = splitBaseName(instance);
        map.set(instance, {
          instance, baseName, instanceNum,
          globalSlot, localSlot: toLocalSlot(globalSlot, day, slotsPerDay),
          day, dayName: days[day - 1] ?? `Jour ${day}`,
          assignments: [], roles: [],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.localSlot - b.localSlot,
  );
}

// ─── Palette ──────────────────────────────────────────────────────────────────

export const REPORT_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#f97316',
  '#14b8a6', '#84cc16', '#a78bfa', '#fb7185',
];

export function buildColorMap(baseNames: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  Array.from(new Set(baseNames)).forEach((name, i) => {
    map[name] = REPORT_PALETTE[i % REPORT_PALETTE.length];
  });
  return map;
}

// ─── Markdown export ──────────────────────────────────────────────────────────

export function toMarkdown(
  activities: ActivityInstance[],
  days: string[],
  slotsPerDay: number,
  title: string,
): string {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const hasAssignments = activities.some(a => a.assignments.length > 0 || a.roles.length > 0);
  const baseNames = Array.from(new Set(activities.map(a => a.baseName)));
  const maxLocalSlot = slotsPerDay > 0 ? slotsPerDay : Math.max(...activities.map(a => a.localSlot));
  const activeDays = days.length > 0 ? days : Array.from(new Set(activities.map(a => a.dayName)));
  const dayCount = Math.max(...activities.map(a => a.day));

  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push(`> Généré le ${date}`);
  lines.push('');
  lines.push('## Résumé');
  lines.push(`- **Jours :** ${activeDays.join(', ')}`);
  lines.push(`- **Créneaux par jour :** ${maxLocalSlot}`);
  lines.push(`- **Types d'activité :** ${baseNames.join(', ')}`);
  lines.push(`- **Instances planifiées :** ${activities.length}`);
  lines.push('');

  // Calendar section
  lines.push('## Calendrier');
  lines.push('');

  const header = ['| Créneau', ...Array.from({ length: dayCount }, (_, i) => activeDays[i] ?? `Jour ${i + 1}`), ''].join(' | ');
  const sep = ['|:-------:', ...Array(dayCount).fill('-------'), ''].join('|');
  lines.push(header);
  lines.push(sep);

  for (let slot = 1; slot <= maxLocalSlot; slot++) {
    const cells: string[] = [`**${slot}**`];
    for (let d = 1; d <= dayCount; d++) {
      const acts = activities.filter(a => a.day === d && a.localSlot === slot);
      cells.push(acts.length > 0 ? acts.map(a => a.instance).join(', ') : '');
    }
    lines.push(['|', ...cells, ''].join(' | '));
  }
  lines.push('');

  // Detail table
  lines.push('## Détail des instances');
  lines.push('');

  if (hasAssignments) {
    lines.push('| Instance | Activité | Jour | Créneau | Ressources | Rôles |');
    lines.push('|----------|----------|------|---------|------------|-------|');
    for (const act of activities) {
      const resources = act.assignments.length > 0 ? act.assignments.join(', ') : '—';
      const roles = act.roles.length > 0 ? act.roles.map(r => `${r.role} → ${r.resource}`).join(', ') : '—';
      lines.push(`| ${act.instance} | ${act.baseName} | ${act.dayName} | ${act.localSlot} | ${resources} | ${roles} |`);
    }
  } else {
    lines.push('| Instance | Activité | Jour | Créneau |');
    lines.push('|----------|----------|------|---------|');
    for (const act of activities) {
      lines.push(`| ${act.instance} | ${act.baseName} | ${act.dayName} | ${act.localSlot} |`);
    }
  }

  return lines.join('\n');
}
