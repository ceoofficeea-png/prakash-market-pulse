export type ComparisonPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "half_yearly" | "yearly";
/** months > 0: last N completed calendar months vs. the N months before. Otherwise rolling days. */
export const COMPARISON_PERIODS = [
  { id: "daily", label: "Daily", days: 1, months: 0 },
  { id: "weekly", label: "Weekly", days: 7, months: 0 },
  { id: "monthly", label: "Monthly", days: 30, months: 1 },
  { id: "quarterly", label: "Quarterly", days: 90, months: 3 },
  { id: "half_yearly", label: "Half-yearly", days: 180, months: 6 },
  { id: "yearly", label: "Yearly", days: 365, months: 12 },
] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function trailingRange(days: number, now = new Date()) {
  const to = new Date(`${iso(now)}T00:00:00Z`);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: iso(from), to: iso(to) };
}
export function previousRange(from: string, to: string) {
  const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
  const end = new Date(Date.parse(from) - 86400000);
  return { days, prevTo: iso(end), prevFrom: iso(new Date(end.getTime() - (days - 1) * 86400000)) };
}
const monthStart = (y: number, m: number) => iso(new Date(Date.UTC(y, m, 1)));
const monthEnd = (y: number, m: number) => iso(new Date(Date.UTC(y, m + 1, 0)));
/** Current + comparison windows for a period button. Calendar periods use completed months. */
export function periodRanges(id: ComparisonPeriod, now = new Date()) {
  const p = COMPARISON_PERIODS.find((x) => x.id === id)!;
  if (!p.months) {
    const cur = trailingRange(p.days, now);
    const prev = previousRange(cur.from, cur.to);
    return { ...cur, prevFrom: prev.prevFrom, prevTo: prev.prevTo };
  }
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  return {
    from: monthStart(y, m - p.months), to: monthEnd(y, m - 1),
    prevFrom: monthStart(y, m - 2 * p.months), prevTo: monthEnd(y, m - p.months - 1),
  };
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Human name for a date range: "Oct 2026", "Aug–Oct 2026", "Nov 2025–Oct 2026", "19 Nov", "6–12 Nov 2026". */
export function rangeLabel(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`), b = new Date(`${to}T00:00:00Z`);
  const ay = a.getUTCFullYear(), by = b.getUTCFullYear(), am = MON[a.getUTCMonth()], bm = MON[b.getUTCMonth()];
  const fullMonths = a.getUTCDate() === 1 && new Date(b.getTime() + 86400000).getUTCDate() === 1;
  if (fullMonths) {
    if (ay === by && a.getUTCMonth() === 0 && b.getUTCMonth() === 11) return `${ay}`;
    if (from.slice(0, 7) === to.slice(0, 7)) return `${am} ${ay}`;
    return ay === by ? `${am}–${bm} ${by}` : `${am} ${ay}–${bm} ${by}`;
  }
  if (from === to) return `${a.getUTCDate()} ${am} ${ay}`;
  if (ay === by && am === bm) return `${a.getUTCDate()}–${b.getUTCDate()} ${bm} ${by}`;
  return ay === by ? `${a.getUTCDate()} ${am}–${b.getUTCDate()} ${bm} ${by}` : `${a.getUTCDate()} ${am} ${ay}–${b.getUTCDate()} ${bm} ${by}`;
}
