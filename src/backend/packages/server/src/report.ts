import type { PlanningRecord } from './db.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityInstance {
    instance: string;
    baseName: string;
    instanceNum: number;
    globalSlot: number;
    localSlot: number;
    day: number;
    dayName: string;
    assignments: string[];
    roles: Array<{ role: string; resource: string }>;
}

export interface ReportStats {
    totalInstances: number;
    activityTypes: string[];
    totalDays: number;
    assignedResources: string[];
}

export interface PlanningReport {
    planningId: string;
    title: string;
    generatedAt: string;
    days: string[];
    slotsPerDay: number;
    activities: ActivityInstance[];
    stats: ReportStats;
    solveTimeMs?: number;
    warnings: string[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function splitBaseName(instance: string): { baseName: string; instanceNum: number } {
    const m = instance.match(/^(.+)_(\d+)$/);
    return m
        ? { baseName: m[1], instanceNum: parseInt(m[2], 10) }
        : { baseName: instance, instanceNum: 1 };
}

function toLocalSlot(globalSlot: number, day: number, slotsPerDay: number): number {
    return slotsPerDay > 0 ? globalSlot - (day - 1) * slotsPerDay : globalSlot;
}

export function parseSolutionOutput(
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
                    globalSlot,
                    localSlot: toLocalSlot(globalSlot, day, slotsPerDay),
                    day,
                    dayName: days[day - 1] ?? `Jour ${day}`,
                    assignments: [],
                    roles: [],
                });
                continue;
            }
            const asM = line.match(/^ASSIGNMENT:\s+(\S+)\s+resource=(.+)$/);
            if (asM) { map.get(asM[1])?.assignments.push(asM[2]); continue; }
            const rlM = line.match(/^ROLE:\s+(\S+)\s+role=(\S+)\s+resource=(.+)$/);
            if (rlM) { map.get(rlM[1])?.roles.push({ role: rlM[2], resource: rlM[3] }); }
        } else {
            const m = line.match(/^(\S+)\s+starts=(\d+)\s+day=(\d+)/);
            if (m) {
                const [, instance, slotStr, dayStr] = m;
                const globalSlot = parseInt(slotStr, 10);
                const day = parseInt(dayStr, 10);
                const { baseName, instanceNum } = splitBaseName(instance);
                map.set(instance, {
                    instance, baseName, instanceNum,
                    globalSlot,
                    localSlot: toLocalSlot(globalSlot, day, slotsPerDay),
                    day,
                    dayName: days[day - 1] ?? `Jour ${day}`,
                    assignments: [],
                    roles: [],
                });
            }
        }
    }

    return Array.from(map.values()).sort((a, b) =>
        a.day !== b.day ? a.day - b.day : a.localSlot - b.localSlot,
    );
}

// ─── Report builder ───────────────────────────────────────────────────────────

export function buildPlanningReportFromOutput(
    planning: PlanningRecord,
    solutionOutput: string,
    warnings: string[] = [],
    solveTimeMs?: number
): PlanningReport {
    const rawData = planning.data as Record<string, unknown> | undefined;
    const days: string[] = (rawData?.time as Record<string, unknown> | undefined)?.days as string[] ?? [];
    const slotsPerDay: number = (rawData?.time as Record<string, unknown> | undefined)?.slotsPerDay as number ?? 0;

    const activities = parseSolutionOutput(solutionOutput, days, slotsPerDay);

    const activityTypes = Array.from(new Set(activities.map(a => a.baseName)));
    const assignedResources = Array.from(new Set([
        ...activities.flatMap(a => a.assignments),
        ...activities.flatMap(a => a.roles.map(r => r.resource)),
    ]));
    const totalDays = activities.length > 0 ? Math.max(...activities.map(a => a.day)) : 0;

    return {
        planningId: planning.id,
        title: planning.title,
        generatedAt: new Date().toISOString(),
        days,
        slotsPerDay,
        activities,
        stats: { totalInstances: activities.length, activityTypes, totalDays, assignedResources },
        solveTimeMs,
        warnings,
    };
}

export function buildPlanningReport(planning: PlanningRecord): PlanningReport | null {
    if (!planning.solutionOutput) return null;

    return buildPlanningReportFromOutput(
        planning,
        planning.solutionOutput,
        planning.solutionWarnings ?? [],
        planning.solutionSolveTimeMs
    );
}

// ─── Markdown generator ───────────────────────────────────────────────────────

export function generateMarkdown(report: PlanningReport): string {
    const { title, activities, days, slotsPerDay, stats, generatedAt, solveTimeMs, warnings } = report;
    const date = new Date(generatedAt).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
    const hasAssignments = activities.some(a => a.assignments.length > 0 || a.roles.length > 0);
    const maxSlot = slotsPerDay > 0 ? slotsPerDay : Math.max(...activities.map(a => a.localSlot), 0);
    const activeDays = days.length > 0
        ? days
        : Array.from({ length: stats.totalDays }, (_, i) => `Jour ${i + 1}`);
    const dayCount = activeDays.length;
    const lines: string[] = [];

    lines.push(`# ${title}`);
    const solveInfo = solveTimeMs !== undefined
        ? ` · Résolu en ${(solveTimeMs / 1000).toFixed(1)} s`
        : '';
    lines.push(`> Généré le ${date}${solveInfo}`);
    lines.push('');
    lines.push('## Résumé');
    lines.push(`- **Jours :** ${activeDays.join(', ')}`);
    lines.push(`- **Créneaux par jour :** ${maxSlot}`);
    lines.push(`- **Types d'activité :** ${stats.activityTypes.join(', ')}`);
    lines.push(`- **Instances planifiées :** ${stats.totalInstances}`);
    if (stats.assignedResources.length > 0) {
        lines.push(`- **Ressources assignées :** ${stats.assignedResources.join(', ')}`);
    }
    lines.push('');
    lines.push('## Calendrier');
    lines.push('');

    const header = ['| Créneau', ...activeDays, ''].join(' | ');
    const sep = ['|:---:', ...Array(dayCount).fill(':---:'), ''].join('|');
    lines.push(header);
    lines.push(sep);
    for (let slot = 1; slot <= maxSlot; slot++) {
        const cells: string[] = [`**${slot}**`];
        for (let d = 1; d <= dayCount; d++) {
            const acts = activities.filter(a => a.day === d && a.localSlot === slot);
            cells.push(acts.length > 0 ? acts.map(a => a.instance).join(', ') : '');
        }
        lines.push(['|', ...cells, ''].join(' | '));
    }
    lines.push('');
    lines.push('## Détail des instances');
    lines.push('');

    if (hasAssignments) {
        lines.push('| Instance | Activité | Jour | Créneau | Ressources | Rôles |');
        lines.push('|---|---|---|---|---|---|');
        for (const act of activities) {
            const res = act.assignments.length > 0 ? act.assignments.join(', ') : '—';
            const roles = act.roles.length > 0
                ? act.roles.map(r => `${r.role} → ${r.resource}`).join(', ')
                : '—';
            lines.push(`| ${act.instance} | ${act.baseName} | ${act.dayName} | ${act.localSlot} | ${res} | ${roles} |`);
        }
    } else {
        lines.push('| Instance | Activité | Jour | Créneau |');
        lines.push('|---|---|---|---|');
        for (const act of activities) {
            lines.push(`| ${act.instance} | ${act.baseName} | ${act.dayName} | ${act.localSlot} |`);
        }
    }

    if (stats.assignedResources.length > 0) {
        lines.push('');
        lines.push('## Affectations par ressource');
        lines.push('');
        lines.push('| Ressource | Jour | Créneau | Instance | Rôle |');
        lines.push('|---|---|---|---|---|');
        const byRes = new Map<string, Array<{ act: ActivityInstance; role?: string }>>();
        for (const act of activities) {
            if (act.roles.length > 0) {
                for (const rr of act.roles) {
                    if (!byRes.has(rr.resource)) byRes.set(rr.resource, []);
                    byRes.get(rr.resource)!.push({ act, role: rr.role });
                }
            } else {
                for (const r of act.assignments) {
                    if (!byRes.has(r)) byRes.set(r, []);
                    byRes.get(r)!.push({ act });
                }
            }
        }
        Array.from(byRes.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([res, entries]) => {
            entries.sort((a, b) => a.act.day !== b.act.day ? a.act.day - b.act.day : a.act.localSlot - b.act.localSlot);
            for (const e of entries) {
                lines.push(`| ${res} | ${e.act.dayName} | ${e.act.localSlot} | ${e.act.instance} | ${e.role ?? '—'} |`);
            }
        });
    }

    if (warnings.length > 0) {
        lines.push('');
        lines.push('## Avertissements du solveur');
        lines.push('');
        for (const w of warnings) lines.push(`- ${w}`);
    }

    return lines.join('\n');
}

// ─── Print HTML generator ─────────────────────────────────────────────────────

const PALETTE = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ef4444', '#06b6d4', '#ec4899', '#f97316',
    '#14b8a6', '#84cc16', '#a78bfa', '#fb7185',
];

function buildColorMap(baseNames: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    Array.from(new Set(baseNames)).forEach((name, i) => {
        map[name] = PALETTE[i % PALETTE.length];
    });
    return map;
}

export function generatePrintHTML(report: PlanningReport): string {
    const { title, activities, days, slotsPerDay, stats, generatedAt, solveTimeMs, warnings } = report;
    const date = new Date(generatedAt).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
    const hasAssignments = activities.some(a => a.assignments.length > 0 || a.roles.length > 0);
    const maxSlot = slotsPerDay > 0 ? slotsPerDay : Math.max(...activities.map(a => a.localSlot), 0);
    const activeDays = days.length > 0
        ? days
        : Array.from({ length: stats.totalDays }, (_, i) => `Jour ${i + 1}`);
    const dayCount = activeDays.length;
    const colors = buildColorMap(stats.activityTypes);
    const solveInfo = solveTimeMs !== undefined
        ? ` &middot; Résolu en ${(solveTimeMs / 1000).toFixed(1)} s`
        : '';

    // Grid for calendar
    const grid: Record<string, ActivityInstance[]> = {};
    for (const act of activities) {
        const key = `${act.day}-${act.localSlot}`;
        (grid[key] ??= []).push(act);
    }

    // By-resource map
    const byRes = new Map<string, Array<{ act: ActivityInstance; role?: string }>>();
    for (const act of activities) {
        if (act.roles.length > 0) {
            for (const rr of act.roles) {
                (byRes.get(rr.resource) ?? byRes.set(rr.resource, []).get(rr.resource))!.push({ act, role: rr.role });
            }
        } else {
            for (const r of act.assignments) {
                (byRes.get(r) ?? byRes.set(r, []).get(r))!.push({ act });
            }
        }
    }

    // ── Calendar rows ──
    let calendarRows = '';
    for (let slot = 1; slot <= maxSlot; slot++) {
        let cells = `<td class="sn">${slot}</td>`;
        for (let d = 1; d <= dayCount; d++) {
            const acts = grid[`${d}-${slot}`] ?? [];
            if (acts.length > 0) {
                const pills = acts.map(a => {
                    const c = colors[a.baseName] ?? PALETTE[0];
                    const sub = a.assignments.length > 0
                        ? `<div class="ps">${escHtml(a.assignments.join(', '))}</div>`
                        : a.roles.length > 0
                            ? `<div class="ps">${escHtml(a.roles.map(r => r.resource).join(', '))}</div>`
                            : '';
                    return `<div class="pill" style="background:${c}20;border-left:3px solid ${c};color:${c}"><div class="pn">${escHtml(a.instance)}</div>${sub}</div>`;
                }).join('');
                cells += `<td>${pills}</td>`;
            } else {
                cells += `<td class="em">&middot;</td>`;
            }
        }
        calendarRows += `<tr class="${slot % 2 === 0 ? 'ev' : ''}">${cells}</tr>`;
    }

    // ── Detail rows ──
    let detailRows = '';
    for (const act of activities) {
        const c = colors[act.baseName] ?? PALETTE[0];
        const res = act.assignments.length > 0
            ? act.assignments.map(r => `<span class="chip">${escHtml(r)}</span>`).join(' ')
            : '<span class="nd">—</span>';
        const roles = act.roles.length > 0
            ? act.roles.map(r => `<span class="rb"><b>${escHtml(r.role)}</b> → ${escHtml(r.resource)}</span>`).join('')
            : '<span class="nd">—</span>';
        detailRows += `<tr>
      <td><span class="tag" style="background:${c}20;color:${c};border:1px solid ${c}40">${escHtml(act.instance)}</span></td>
      <td>${escHtml(act.baseName)}</td>
      <td>${escHtml(act.dayName)}</td>
      <td class="ct">${act.localSlot}</td>
      ${hasAssignments ? `<td>${res}</td><td>${roles}</td>` : ''}
    </tr>`;
    }

    // ── Resource rows ──
    let resourceSection = '';
    if (byRes.size > 0) {
        let rows = '';
        Array.from(byRes.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([res, entries]) => {
            entries.sort((a, b) => a.act.day !== b.act.day ? a.act.day - b.act.day : a.act.localSlot - b.act.localSlot);
            entries.forEach((e, i) => {
                const c = colors[e.act.baseName] ?? PALETTE[0];
                rows += `<tr>
          ${i === 0 ? `<td rowspan="${entries.length}" class="rn">${escHtml(res)}</td>` : ''}
          <td>${escHtml(e.act.dayName)}</td>
          <td class="ct">${e.act.localSlot}</td>
          <td><span class="tag" style="background:${c}20;color:${c};border:1px solid ${c}40">${escHtml(e.act.instance)}</span></td>
          <td>${escHtml(e.role ?? '—')}</td>
        </tr>`;
            });
        });
        resourceSection = `<h2>Affectations par ressource</h2>
    <table>
      <thead><tr><th>Ressource</th><th>Jour</th><th>Créneau</th><th>Instance</th><th>Rôle</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    }

    // ── Warnings ──
    let warningSection = '';
    if (warnings.length > 0) {
        warningSection = `<h2>Avertissements</h2><ul class="warn">${warnings.map(w => `<li>${escHtml(w)}</li>`).join('')}</ul>`;
    }

    const dayHeaders = activeDays.map(d => `<th>${escHtml(d)}</th>`).join('');
    const detailHeaders = hasAssignments
        ? '<th>Instance</th><th>Activité</th><th>Jour</th><th>Créneau</th><th>Ressources</th><th>Rôles</th>'
        : '<th>Instance</th><th>Activité</th><th>Jour</th><th>Créneau</th>';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(title)}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:32px 40px}
    h1{font-size:22px;font-weight:700;color:#0f172a;margin-bottom:4px}
    .meta{font-size:12px;color:#64748b;margin-bottom:20px}
    .stats{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:28px;padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
    .stat{font-size:12px;color:#475569}.stat strong{color:#1e293b}
    h2{font-size:14px;font-weight:700;color:#1e293b;margin:28px 0 12px;padding-bottom:7px;border-bottom:2px solid #e2e8f0}
    table{border-collapse:collapse;width:100%;margin-bottom:6px;font-size:12px}
    thead th{background:#f1f5f9;padding:7px 9px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#475569;border-bottom:2px solid #e2e8f0;white-space:nowrap}
    tbody td{padding:6px 9px;border-bottom:1px solid #f1f5f9;vertical-align:top}
    tr.ev td{background:#fafafa}
    .sn{text-align:center;font-weight:700;font-size:10px;color:#94a3b8;width:42px;border-right:1px solid #f1f5f9}
    .em{text-align:center;color:#e2e8f0;font-size:14px}
    .ct{text-align:center}
    .pill{border-radius:5px;padding:3px 7px;margin-bottom:3px;font-size:11px;line-height:1.4}
    .pn{font-weight:700}.ps{font-size:10px;opacity:.75;margin-top:1px}
    .tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
    .chip{display:inline-block;padding:1px 6px;border-radius:999px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:11px;margin-right:3px}
    .rb{display:block;font-size:11px;white-space:nowrap}
    .rn{font-weight:700;vertical-align:middle}
    .nd{color:#94a3b8}
    .warn{padding-left:18px;margin-top:8px;font-size:12px;color:#92400e}
    @media print{
      body{padding:12px 18px;font-size:11px}
      h1{font-size:18px}h2{font-size:12px;margin:16px 0 8px}
      .stats{padding:7px 10px;gap:10px}
      table{font-size:10px}
      thead th{font-size:8px;padding:4px 6px}
      tbody td{padding:3px 6px}
      tr{page-break-inside:avoid}
      h2{page-break-after:avoid}
    }
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  <p class="meta">Généré le ${date}${solveInfo}</p>
  <div class="stats">
    <div class="stat"><strong>${stats.totalInstances}</strong> instance${stats.totalInstances > 1 ? 's' : ''} planifiée${stats.totalInstances > 1 ? 's' : ''}</div>
    <div class="stat">Types : <strong>${stats.activityTypes.map(escHtml).join(', ')}</strong></div>
    <div class="stat">Jours : <strong>${activeDays.map(escHtml).join(', ')}</strong></div>
    ${stats.assignedResources.length > 0
        ? `<div class="stat"><strong>${stats.assignedResources.length}</strong> ressource${stats.assignedResources.length > 1 ? 's' : ''} assignée${stats.assignedResources.length > 1 ? 's' : ''}</div>`
        : ''}
  </div>

  <h2>Calendrier</h2>
  <table>
    <thead><tr><th>Crén.</th>${dayHeaders}</tr></thead>
    <tbody>${calendarRows}</tbody>
  </table>

  <h2>Détail des instances</h2>
  <table>
    <thead><tr>${detailHeaders}</tr></thead>
    <tbody>${detailRows}</tbody>
  </table>

  ${resourceSection}
  ${warningSection}
</body>
</html>`;
}

function escHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
