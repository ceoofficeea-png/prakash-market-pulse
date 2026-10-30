import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = NonNullable<BadgeProps["variant"]>;

const TONES: Record<string, Tone> = {
  // campaigns
  Active: "success",
  Planned: "info",
  Paused: "warning",
  Completed: "muted",
  // leads
  New: "info",
  Contacted: "muted",
  Qualified: "signal",
  Proposal: "warning",
  Negotiation: "warning",
  Won: "success",
  Lost: "danger",
  // content
  Idea: "muted",
  Brief: "muted",
  "In Production": "info",
  "In Review": "warning",
  Approved: "signal",
  Published: "success",
  Archived: "muted",
  // tasks
  "To Do": "muted",
  "In Progress": "info",
  Blocked: "danger",
  Done: "success",
  // severity / impact
  Critical: "danger",
  High: "signal",
  Medium: "warning",
  Low: "muted",
  Info: "info",
  // insights
  Actioned: "success",
  Dismissed: "muted",
  // social
  Scheduled: "info",
  Draft: "muted",
  Positive: "success",
  Neutral: "muted",
  Negative: "danger",
  // connections
  "Demo data": "info",
  "Not connected": "muted",
  Connected: "success",
  Error: "danger",
  // priority tiers
  Core: "signal",
  Growth: "info",
  Emerging: "muted",
};

export function StatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return null;
  return (
    <Badge variant={TONES[value] ?? "muted"} className={cn("whitespace-nowrap rounded-full px-2 py-0 text-[11px]", className)}>
      {value}
    </Badge>
  );
}
