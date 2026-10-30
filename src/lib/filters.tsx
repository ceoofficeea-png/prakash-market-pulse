import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { toISODate } from "@/lib/format";

export type DatePreset = "7d" | "30d" | "90d" | "180d" | "custom";

export interface Filters {
  preset: DatePreset;
  from: string; // ISO date
  to: string; // ISO date
  countries: string[];
  platforms: string[];
  campaigns: number[];
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
      const range = saved.preset !== "custom" ? rangeFor(PRESET_DAYS[saved.preset]) : { from: saved.from, to: saved.to };
      setState({ ...defaults(), ...saved, ...range });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<FiltersContextValue>(() => {
    const fromD = new Date(state.from);
    const toD = new Date(state.to);
    const days = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1);
    const prevTo = new Date(fromD);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (days - 1));
    return {
      ...state,
      days,
      prevFrom: toISODate(prevFrom),
      prevTo: toISODate(prevTo),
      setPreset: (p) => setState((s) => ({ ...s, preset: p, ...rangeFor(PRESET_DAYS[p]) })),
      setRange: (from, to) => setState((s) => ({ ...s, preset: "custom", from, to })),
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
