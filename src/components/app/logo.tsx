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
  if (collapsed) return <img src="/favicon.svg" alt="Prakash Pump" className="size-8" />;
  return (
    <span className="flex flex-col items-start gap-1">
      <img src="/prakash-logo.svg" alt="Prakash Pump" className="h-8 w-auto" />
      <span className="eyebrow text-[10px]">Marketing Command</span>
    </span>
  );
}
