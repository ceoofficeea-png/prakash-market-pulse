import { Check, ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
  icon?: ReactNode | undefined;
  group?: string | undefined;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  icon,
  width = "w-64",
  allLabel,
}: {
  label: string;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  icon?: ReactNode | undefined;
  width?: string | undefined;
  allLabel?: string | undefined;
}) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const summary =
    value.length === 0
      ? (allLabel ?? `All ${label.toLowerCase()}`)
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} ${label.toLowerCase()}`;
  const groups = Array.from(new Set(options.map((o) => o.group ?? "")));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 border-border bg-surface font-normal", value.length && "border-primary/50 text-foreground")}>
          {icon}
          <span className="max-w-36 truncate">{summary}</span>
          {value.length > 0 ? (
            <X
              className="size-3.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", width)} align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup><CommandItem value={allLabel ?? `All ${label.toLowerCase()}`} onSelect={() => onChange([])}><Check className={cn("size-4", value.length > 0 && "opacity-0")} />{allLabel ?? `All ${label.toLowerCase()}`}</CommandItem></CommandGroup>
            {groups.map((g) => (
              <CommandGroup key={g || "all"} heading={g || undefined}>
                {options
                  .filter((o) => (o.group ?? "") === g)
                  .map((o) => (
                    <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)}>
                      <span className={cn("flex size-4 items-center justify-center rounded-sm border border-input", value.includes(o.value) && "border-primary bg-primary text-primary-foreground")}>
                        {value.includes(o.value) && <Check className="size-3" />}
                      </span>
                      {o.icon}
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
