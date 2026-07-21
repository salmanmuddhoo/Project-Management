/** Non-chart dashboard widgets: project health list and recommendations. */

import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { RagBadge } from "@/components/shared/badges";
import { Progress } from "@/components/ui/progress";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import type { Recommendation } from "@/lib/metrics/recommendations";
import { cn, formatPct } from "@/lib/utils";

export function ProjectHealthList({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => a.health.score - b.health.score);
  return (
    <ul className="space-y-3">
      {sorted.map((s) => (
        <li key={s.project.id}>
          <Link to={`/projects/${s.project.id}`} className="block rounded-md p-2 transition-colors hover:bg-muted/60">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{s.project.charter.projectName}</span>
              <RagBadge rag={s.health.rag} score={s.health.score} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Progress value={s.metrics.overallProgressPct} className="flex-1" />
              <span className="tnum w-10 text-right text-xs text-muted-foreground">{formatPct(s.metrics.overallProgressPct)}</span>
            </div>
            {s.health.reasons[0] && (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{s.health.reasons[0].message}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const SEVERITY_META = {
  critical: { icon: ShieldAlert, className: "text-red-700 dark:text-red-400", label: "Critical" },
  warning: { icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400", label: "Warning" },
  info: { icon: Info, className: "text-muted-foreground", label: "Info" },
} as const;

export function RecommendationsPanel({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return <p className="text-sm text-muted-foreground">No findings — the portfolio looks healthy against the standard checks.</p>;
  }
  return (
    <ul className="space-y-2">
      {recommendations.map((r, i) => {
        const meta = SEVERITY_META[r.severity];
        const Icon = meta.icon;
        return (
          <li key={i} className="flex items-start gap-2 rounded-md border p-2.5">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} />
            <div className="min-w-0">
              <p className="text-sm">{r.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.label} · {r.category}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
