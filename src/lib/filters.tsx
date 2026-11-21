import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { toISODate } from "@/lib/format";
import { COMPARISON_PERIODS, periodRanges, previousRange, rangeLabel, type ComparisonPeriod } from "@/lib/periods";

export type DatePreset = "7d" | "30d" | "90d" | "180d" | "custom";

export interface Filters {
  preset: DatePreset;
  from: string; // ISO date
  to: string; // ISO date
  countries: string[];
  platforms: string[];
  campaigns: number[];
  comparison?: ComparisonPeriod | undefined;
  /** Explicit comparison window (period buttons or custom "Compare with") */
  compareFrom?: string | undefined;
  compareTo?: string | undefined;
}

interface FiltersContextValue extends Filters {
  /** Equal-length window immediately before the current range */
  prevFrom: string;
  prevTo: string;
  days: number;
  /** e.g. "Oct 2026" — name of the comparison window */
  prevLabel: string;
  currentLabel: string;
  setCompareRange: (from: string | undefined, to?: string | undefined) => void;
  setPreset: (p: Exclude<DatePreset, "custom">) => void;
  setRange: (from: string, to: string) => void;
  setCountries: (c: string[]) => void;
  setPlatforms: (p: string[]) => void;
  setCampaigns: (c: number[]) => void;
  reset: () => void;
  setComparison: (period: ComparisonPeriod) => void;
}

const PRESET_DAYS: Record<Exclude<DatePreset, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90, "180d": 180 };

function rangeFor(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toISODate(from), to: toISODate(to) };
}

const defaults = (): Filters => ({ preset: "30d", ...rangeFor(30), countries: [], platforms: [], campaigns: [] });

const STORAGE_KEY = "pp-filters-v1";
const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Filters>(defaults);
  const restored = useRef(false);
  const [ready, setReady] = useState(false);

  // Restore after hydration so server and client markup match.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Filters;
      const period = COMPARISON_PERIODS.find((p) => p.id === saved.comparison);
      const range = period ? periodRanges(period.id) : saved.preset !== "custom" ? rangeFor(PRESET_DAYS[saved.preset]) : { from: saved.from, to: saved.to };
      setState({ ...defaults(), ...saved, ...range, ...(period ? { compareFrom: (range as ReturnType<typeof periodRanges>).prevFrom, compareTo: (range as ReturnType<typeof periodRanges>).prevTo } : {}) });
    } catch {
      /* ignore */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const value = useMemo<FiltersContextValue>(() => {
    const auto = previousRange(state.from, state.to);
    const prevFrom = state.compareFrom && state.compareTo ? state.compareFrom : auto.prevFrom;
    const prevTo = state.compareFrom && state.compareTo ? state.compareTo : auto.prevTo;
    return {
      ...state,
      days: auto.days,
      prevFrom,
      prevTo,
      prevLabel: rangeLabel(prevFrom, prevTo),
      currentLabel: rangeLabel(state.from, state.to),
      setCompareRange: (compareFrom, compareTo) => setState((s) => ({ ...s, compareFrom, compareTo: compareFrom ? compareTo : undefined })),
      setPreset: (p) => setState((s) => ({ ...s, comparison: undefined, compareFrom: undefined, compareTo: undefined, preset: p, ...rangeFor(PRESET_DAYS[p]) })),
      setRange: (from, to) => setState((s) => ({ ...s, comparison: undefined, compareFrom: s.comparison ? undefined : s.compareFrom, compareTo: s.comparison ? undefined : s.compareTo, preset: "custom", from, to })),
      setComparison: (comparison) => {
        const period = COMPARISON_PERIODS.find((p) => p.id === comparison);
        if (!period) return;
        const r = periodRanges(period.id);
        setState((s) => ({ ...s, comparison, preset: "custom", from: r.from, to: r.to, compareFrom: r.prevFrom, compareTo: r.prevTo }));
      },
      setCountries: (countries) => setState((s) => ({ ...s, countries })),
      setPlatforms: (platforms) => setState((s) => ({ ...s, platforms })),
      setCampaigns: (campaigns) => setState((s) => ({ ...s, campaigns })),
      reset: () => setState(defaults()),
    };
  }, [state]);

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used inside FiltersProvider");
  return ctx;
}

/** True when an ISO timestamp/date falls inside the selected range. */
export function inRange(value: string | null | undefined, from: string, to: string) {
  if (!value) return false;
  const d = value.slice(0, 10);
  return d >= from && d <= to;
}

/** Safe outside the provider (falls back to a generic label). */
export function useComparisonLabel() {
  const ctx = useContext(FiltersContext);
  return ctx ? `vs. ${ctx.prevLabel}` : "vs. previous period";
}
