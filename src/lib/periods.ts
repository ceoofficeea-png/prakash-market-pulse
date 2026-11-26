export type ComparisonPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export const COMPARISON_PERIODS = [
  { id: "daily", label: "Daily", days: 1 },
  { id: "weekly", label: "Weekly", days: 7 },
  { id: "monthly", label: "Monthly", days: 30 },
  { id: "quarterly", label: "Quarterly", days: 90 },
  { id: "yearly", label: "Yearly", days: 365 },
] as const;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function trailingRange(days: number, now = new Date()) {
  const to = new Date(`${iso(now)}T00:00:00Z`);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: iso(from), to: iso(to) };
}
/**
 * Label for a comparison window, coarsening with its length: exact day for a
 * day, dates and year for a month or so, months for a half year, years for a
 * year. Falls back to the plain phrase when the dates are unusable.
 */
export function comparisonLabel(from: string, to: string): string {
  const start = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "previous period";

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const month = (d: Date) => MONTH_LABELS[d.getUTCMonth()] ?? "";
  const year = (d: Date) => d.getUTCFullYear();
  const sameYear = year(start) === year(end);

  if (days === 1) return `${start.getUTCDate()} ${month(start)} ${year(start)}`;

  if (days <= 31) {
    const left = `${start.getUTCDate()} ${month(start)}${sameYear ? "" : ` ${year(start)}`}`;
    return `${left} – ${end.getUTCDate()} ${month(end)} ${year(end)}`;
  }

  if (days >= 350) return sameYear ? `${year(start)}` : `${year(start)} – ${year(end)}`;

  const left = month(start);
  const right = month(end);
  if (!sameYear) return `${left} ${year(start)} – ${right} ${year(end)}`;
  return left === right ? `${left} ${year(end)}` : `${left} – ${right} ${year(end)}`;
}

export function previousRange(from: string, to: string) {
  const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
  const end = new Date(Date.parse(from) - 86400000);
  return { days, prevTo: iso(end), prevFrom: iso(new Date(end.getTime() - (days - 1) * 86400000)) };
}