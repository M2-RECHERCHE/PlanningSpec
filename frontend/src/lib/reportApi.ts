import { api } from './api';

// ─── Types (mirror of backend report.ts) ─────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const auth = api.defaults.headers.common['Authorization'] as string | undefined;
  return auth ? { Authorization: auth } : {};
}

function apiUrl(path: string): string {
  return `${process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:4000'}${path}`;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchReport(planningId: string): Promise<PlanningReport> {
  const res = await api.get<{ data: PlanningReport }>(`/api/plannings/${planningId}/report`);
  return res.data.data;
}

/**
 * Fetches the server-generated print HTML and opens it in a new tab.
 * The user then uses Ctrl+P / browser print dialog to produce a PDF.
 */
export async function openPrintView(planningId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/plannings/${planningId}/report/print`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const win = window.open('', '_blank');
  if (!win) throw new Error('Popup bloqué par le navigateur. Autorisez les popups pour ce site.');
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/**
 * Downloads the Markdown report via a fetch + blob anchor.
 * No popup blocker issue since it's a programmatic click on a blob URL.
 */
export async function downloadMarkdown(planningId: string, title: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/plannings/${planningId}/report/markdown`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
