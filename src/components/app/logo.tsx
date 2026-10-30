import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("bg-signal shadow-glow inline-flex size-8 items-center justify-center rounded-lg", className)}>
      <svg viewBox="0 0 24 24" className="size-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3c3 4 5.5 6.8 5.5 10a5.5 5.5 0 0 1-11 0C6.5 9.8 9 7 12 3Z" />
        <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2" />
      </svg>
    </span>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold text-foreground">Prakash Pump</div>
          <div className="eyebrow text-[10px]">Marketing Command</div>
        </div>
      )}
    </div>
  );
}
