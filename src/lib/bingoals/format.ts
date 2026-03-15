export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function daysAgo(ts: number | null): number | null {
  if (ts === null) return null;
  const diff = Math.floor((Date.now() - ts) / 86_400_000);
  return Math.max(0, diff);
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
