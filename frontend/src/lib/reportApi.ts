import { api } from './api';

const REPORT_VERSION_STORAGE_KEY_PREFIX = 'planify:report-version:';

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

function withVersionQuery(path: string, versionId?: string): string {
  if (!versionId) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}versionId=${encodeURIComponent(versionId)}`;
}

export function setReportVersionSelection(planningId: string, versionId?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const key = `${REPORT_VERSION_STORAGE_KEY_PREFIX}${planningId}`;
  if (!versionId) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, versionId);
}

export function getReportVersionSelection(planningId: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const value = window.localStorage.getItem(`${REPORT_VERSION_STORAGE_KEY_PREFIX}${planningId}`) ?? '';
  return value.trim() ? value.trim() : undefined;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchReport(planningId: string, versionId?: string): Promise<PlanningReport> {
  const path = versionId
    ? `/api/plannings/${planningId}/solutions/${versionId}/report`
    : `/api/plannings/${planningId}/report`;
  const res = await api.get<{ data: PlanningReport }>(path);
  return res.data.data;
}

/**
 * Fetches the server-generated print HTML and opens it in a new tab.
 * The user then uses Ctrl+P / browser print dialog to produce a PDF.
 */
export async function openPrintView(planningId: string, versionId?: string): Promise<void> {
  const path = withVersionQuery(`/api/plannings/${planningId}/report/print`, versionId);
  const res = await fetch(apiUrl(path), {
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
export async function downloadMarkdown(planningId: string, title: string, versionId?: string): Promise<void> {
  const path = withVersionQuery(`/api/plannings/${planningId}/report/markdown`, versionId);
  const res = await fetch(apiUrl(path), {
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
