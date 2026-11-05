import { CalendarDays, Globe2, Layers, Megaphone, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { MultiSelect } from "@/components/app/multi-select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLookups } from "@/lib/api";
import { useFilters, type DatePreset } from "@/lib/filters";
import { fmtShortDate, PLATFORMS, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { COMPARISON_PERIODS } from "@/lib/periods";

export type FilterKind = "date" | "country" | "platform" | "campaign";

const PRESETS: { id: Exclude<DatePreset, "custom">; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "180d", label: "180D" },
];

export function FilterBar({ show = ["date", "country", "platform", "campaign"] }: { show?: FilterKind[] }) {
  const f = useFilters();
  const { countries, campaigns } = useLookups();
  const [range, setRange] = useState<DateRange | undefined>();
  const active = f.countries.length + f.platforms.length + f.campaigns.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {show.includes("date") && (
        <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-surface p-0.5" aria-label="Comparison period">
          {COMPARISON_PERIODS.map((p) => <Button key={p.id} variant={f.comparison === p.id ? "default" : "ghost"} size="sm" className="h-7 px-2 text-xs" aria-pressed={f.comparison === p.id} title={`Last ${p.days} days vs previous ${p.days} days`} onClick={() => { setRange(undefined); f.setComparison(p.id); }}>{p.label}</Button>)}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="ghost" size="sm"
              onClick={() => { setRange(undefined); f.setPreset(p.id); }}
              className={cn(
                "num rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
                f.preset === p.id && "bg-primary text-primary-foreground hover:text-primary-foreground",
              )}
            >
              {p.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm"
                type="button"
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground",
                  f.preset === "custom" && "bg-primary text-primary-foreground hover:text-primary-foreground",
                )}
              >
                <CalendarDays className="size-3.5" />
                <span className="num">
                  {fmtShortDate(f.from)} – {fmtShortDate(f.to)}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={range ?? { from: new Date(f.from), to: new Date(f.to) }}
                onSelect={(r) => {
                  setRange(r);
                  if (r?.from && r?.to) f.setRange(toISODate(r.from), toISODate(r.to));
                }}
                disabled={{ after: new Date() }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-xs text-muted-foreground">vs. {fmtShortDate(f.prevFrom)} – {fmtShortDate(f.prevTo)}</span>
        </div>
      )}
      {show.includes("country") && (
        <MultiSelect
          label="Countries"
          icon={<Globe2 className="size-3.5 text-muted-foreground" />}
          value={f.countries}
          onChange={f.setCountries}
          options={countries.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}`, group: c.region }))}
        />
      )}
      {show.includes("platform") && (
        <MultiSelect
          label="Platforms"
          icon={<Layers className="size-3.5 text-muted-foreground" />}
          value={f.platforms}
          onChange={f.setPlatforms}
          width="w-56"
          options={PLATFORMS.map((p) => ({
            value: p.id,
            label: p.label,
            icon: <span className="size-2 rounded-full" style={{ background: p.color }} />,
          }))}
        />
      )}
      {show.includes("campaign") && (
        <MultiSelect
          label="Campaigns"
          icon={<Megaphone className="size-3.5 text-muted-foreground" />}
          value={f.campaigns.map(String)}
          onChange={(v) => f.setCampaigns(v.map(Number))}
          width="w-80"
          options={campaigns.map((c) => ({ value: String(c.id), label: c.name, group: c.status }))}
        />
      )}
      {active && (
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={f.reset}>
          <RotateCcw /> Reset
        </Button>
      )}
    </div>
  );
}
