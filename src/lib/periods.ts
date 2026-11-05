export type ComparisonPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export const COMPARISON_PERIODS = [
  { id: "daily", label: "Daily", days: 1 },
  { id: "weekly", label: "Weekly", days: 7 },
  { id: "monthly", label: "Monthly", days: 30 },
  { id: "quarterly", label: "Quarterly", days: 90 },
  { id: "yearly", label: "Yearly", days: 365 },
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