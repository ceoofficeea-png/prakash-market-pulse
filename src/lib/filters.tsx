import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { toISODate } from "@/lib/format";
import { COMPARISON_PERIODS, previousRange, trailingRange, type ComparisonPeriod } from "@/lib/periods";

export type DatePreset = "7d" | "30d" | "90d" | "180d" | "custom";

export interface Filters {
  preset: DatePreset;
  from: string; // ISO date
  to: string; // ISO date
  countries: string[];
  platforms: string[];
  campaigns: number[];
  comparison?: ComparisonPeriod | undefined;
}

interface FiltersContextValue extends Filters {
  /** Equal-length window immediately before the current range */
  prevFrom: string;
  prevTo: string;
  days: number;
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

  // Restore after hydration so server and client markup match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Filters;
      const period = COMPARISON_PERIODS.find((p) => p.id === saved.comparison);
      const range = period ? trailingRange(period.days) : saved.preset !== "custom" ? rangeFor(PRESET_DAYS[saved.preset]) : { from: saved.from, to: saved.to };
      setState({ ...defaults(), ...saved, ...range });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<FiltersContextValue>(() => {
    const { days, prevFrom, prevTo } = previousRange(state.from, state.to);
    return {
      ...state,
      days,
      prevFrom,
      prevTo,
      setPreset: (p) => setState((s) => ({ ...s, comparison: undefined, preset: p, ...rangeFor(PRESET_DAYS[p]) })),
      setRange: (from, to) => setState((s) => ({ ...s, comparison: undefined, preset: "custom", from, to })),
      setComparison: (comparison) => {
        const period = COMPARISON_PERIODS.find((p) => p.id === comparison);
        if (period) setState((s) => ({ ...s, comparison, preset: "custom", ...trailingRange(period.days) }));
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
