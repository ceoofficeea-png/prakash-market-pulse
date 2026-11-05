export const fmtNum = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n)
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);

export const fmtCompact = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const fmtUsd = (n: number | null | undefined, compact = false) =>
  n == null || Number.isNaN(n)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : n < 100 ? 2 : 0,
      }).format(n);

export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null || Number.isNaN(n) || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`;

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtShortDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};

export const safeDiv = (a: number, b: number) => (b ? a / b : 0);

export const pctChange = (cur: number, prev: number) => (prev ? (cur - prev) / prev : null);

export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const first = rows[0];
  if (!first) return;
  const headers = Object.keys(first);
  const esc = (v: unknown) => {
    const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* Domain labels -------------------------------------------------------- */

export const PLATFORMS = [
  { id: "google_ads", label: "Google Ads", color: "var(--chart-2)" },
  { id: "meta_ads", label: "Meta Ads", color: "var(--chart-1)" },
  { id: "linkedin_ads", label: "LinkedIn Ads", color: "var(--chart-3)" },
  { id: "youtube_ads", label: "YouTube Ads", color: "var(--chart-5)" },
] as const;

export const platformLabel = (id: string) => PLATFORMS.find((p) => p.id === id)?.label ?? id;
export const platformColor = (id: string) => PLATFORMS.find((p) => p.id === id)?.color ?? "var(--chart-6)";

export const SOCIAL_PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", color: "var(--chart-2)" },
  { id: "facebook", label: "Facebook", color: "var(--chart-3)" },
  { id: "instagram", label: "Instagram", color: "var(--chart-1)" },
  { id: "youtube", label: "YouTube", color: "var(--chart-5)" },
  { id: "x", label: "X", color: "var(--chart-6)" },
  { id: "snapchat", label: "Snapchat", color: "var(--chart-4)" },
] as const;

export const socialLabel = (id: string) => SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? id;
export const socialColor = (id: string) =>
  SOCIAL_PLATFORMS.find((p) => p.id === id)?.color ?? "var(--chart-6)";

export const WEB_SOURCES = ["Organic Search", "Paid Search", "Paid Social", "Direct", "Referral", "Email"];

export const LEAD_STAGES = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
export const CONTENT_STAGES = [
  "Idea",
  "Brief",
  "In Production",
  "In Review",
  "Approved",
  "Published",
  "Archived",
] as const;
export const CAMPAIGN_STATUSES = ["Planned", "Active", "Paused", "Completed"] as const;
export const TASK_STATUSES = ["To Do", "In Progress", "Blocked", "Done"] as const;

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/** Chart time grain: daily up to ~3 months, weekly beyond. */
export const grainFor = (days: number) => (days > 92 ? "week" : "date");
