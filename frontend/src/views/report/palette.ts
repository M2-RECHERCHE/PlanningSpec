export const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#f97316',
  '#14b8a6', '#84cc16', '#a78bfa', '#fb7185',
];

export function buildColorMap(baseNames: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  Array.from(new Set(baseNames)).forEach((name, i) => {
    map[name] = PALETTE[i % PALETTE.length];
  });
  return map;
}

export function hexAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return hex + alpha;
}
