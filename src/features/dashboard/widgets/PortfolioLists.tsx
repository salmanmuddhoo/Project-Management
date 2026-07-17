/**
 * Non-chart dashboard widgets: project health list, milestone timeline,
 * top risks/issues, capacity heat map and executive recommendations.
 */

import { AlertTriangle, CalendarClock, Flag, Info, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { RagBadge } from "@/components/shared/badges";
import { SEQUENTIAL_BLUE } from "@/components/charts/chartTheme";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CapacityRow, ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import type { Recommendation } from "@/lib/metrics/recommendations";
import { cn, daysBetween, formatDate, formatPct } from "@/lib/utils";

// ---------------------------------------------------------------------------

export function ProjectHealthList({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => a.health.score - b.health.score);
  return (
    <ul className="space-y-3">
      {sorted.map((s) => (
        <li key={s.project.id}>
          <Link
            to={`/projects/${s.project.id}`}
            className="block rounded-md p-2 transition-colors hover:bg-muted/60"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {s.project.charter.projectName}
              </span>
              <RagBadge rag={s.health.rag} score={s.health.score} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Progress value={s.metrics.overallProgressPct} className="flex-1" />
              <span className="tnum w-10 text-right text-xs text-muted-foreground">
                {formatPct(s.metrics.overallProgressPct)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------

export function MilestoneTimeline({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const today = new Date();
  const all = snapshots.flatMap((s) =>
    s.project.milestones.map((m) => ({
      project: s.project.charter.projectName,
      projectId: s.project.id,
      ...m,
      done: ["completed", "done"].includes(String(m.status).trim().toLowerCase()),
    })),
  );
  const overdue = all
    .filter((m) => !m.done && m.plannedDate && m.plannedDate < today)
    .sort((a, b) => a.plannedDate!.getTime() - b.plannedDate!.getTime());
  const upcoming = all
    .filter((m) => !m.done && m.plannedDate && m.plannedDate >= today)
    .sort((a, b) => a.plannedDate!.getTime() - b.plannedDate!.getTime())
    .slice(0, 8);

  const Row = ({ m, late }: { m: (typeof all)[number]; late: boolean }) => (
    <li>
      <Link
        to={`/projects/${m.projectId}?tab=delivery`}
        className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
      >
        <Flag className={cn("h-3.5 w-3.5 shrink-0", late ? "text-red-600" : "text-muted-foreground")} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{m.milestone}</span>
          <span className="block truncate text-xs text-muted-foreground">{m.project}</span>
        </span>
        <span className={cn("tnum shrink-0 text-xs", late ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground")}>
          {late
            ? `${daysBetween(m.plannedDate!, new Date())}d late`
            : formatDate(m.plannedDate)}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Delayed ({overdue.length})
          </p>
          <ul>{overdue.map((m, i) => <Row key={`o${i}`} m={m} late />)}</ul>
        </div>
      )}
      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> Upcoming
        </p>
        {upcoming.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">No upcoming milestones.</p>
        ) : (
          <ul>{upcoming.map((m, i) => <Row key={`u${i}`} m={m} late={false} />)}</ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TopRisksList({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const score = (level: string) => {
    const norm = level.trim().toLowerCase();
    if (norm === "critical") return 5;
    if (norm === "high") return 4;
    if (norm === "medium") return 3;
    if (norm === "low") return 2;
    const n = Number(norm);
    return Number.isFinite(n) ? n : 1;
  };
  const open = snapshots
    .flatMap((s) =>
      s.project.risks
        .filter((r) => !["closed"].includes(r.status.trim().toLowerCase()))
        .map((r) => ({
          project: s.project.charter.projectName,
          projectId: s.project.id,
          exposure: score(r.likelihood) * score(r.impact),
          ...r,
        })),
    )
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 6);

  if (open.length === 0) {
    return <p className="text-xs text-muted-foreground">No open risks.</p>;
  }
  return (
    <ul className="space-y-1">
      {open.map((r, i) => (
        <li key={i}>
          <Link
            to={`/projects/${r.projectId}?tab=risks`}
            className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
          >
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{r.risk}</span>
              <span className="block text-xs text-muted-foreground">
                {r.project} · L:{r.likelihood || "?"} × I:{r.impact || "?"}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TopIssuesList({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const sevRank = (sev: string) => {
    const norm = sev.trim().toLowerCase();
    return norm === "critical" ? 0 : norm === "high" ? 1 : norm === "medium" ? 2 : 3;
  };
  const open = snapshots
    .flatMap((s) =>
      s.project.issues
        .filter((i) => !["resolved", "closed"].includes(i.status.trim().toLowerCase()))
        .map((i) => ({ project: s.project.charter.projectName, projectId: s.project.id, ...i })),
    )
    .sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
    .slice(0, 6);

  if (open.length === 0) {
    return <p className="text-xs text-muted-foreground">No open issues.</p>;
  }
  return (
    <ul className="space-y-1">
      {open.map((issue, i) => (
        <li key={i}>
          <Link
            to={`/projects/${issue.projectId}?tab=risks`}
            className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
          >
            <AlertTriangle
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0",
                sevRank(issue.severity) <= 1 ? "text-red-600" : "text-amber-600",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{issue.issue}</span>
              <span className="block text-xs text-muted-foreground">
                {issue.project} · {issue.severity || "Unrated"} · due {formatDate(issue.targetDate)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------

/**
 * Capacity heat map: sequential blue encodes total allocation; the number is
 * always printed in the cell (sub-3:1 ramp steps rely on the visible label).
 */
export function CapacityHeatMap({ capacity }: { capacity: CapacityRow[] }) {
  const colorFor = (pct: number) => {
    const idx = Math.min(
      SEQUENTIAL_BLUE.length - 1,
      Math.floor((pct / 150) * SEQUENTIAL_BLUE.length),
    );
    return SEQUENTIAL_BLUE[Math.max(0, idx)];
  };
  if (capacity.length === 0) {
    return <p className="text-xs text-muted-foreground">No team plans loaded.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Allocation</TableHead>
          <TableHead className="text-right">Planned / Actual hrs</TableHead>
          <TableHead>Projects</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {capacity.map((row) => {
          const pct = Math.round(row.totalAllocationPct);
          const heat = colorFor(pct);
          return (
            <TableRow key={row.name}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  {row.name}
                  {row.overAllocated && (
                    <Badge variant="outline" className="border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3" /> Over
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{row.role || "—"}</TableCell>
              <TableCell className="text-right">
                <span
                  className="tnum inline-block min-w-14 rounded px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: heat,
                    color: pct >= 75 ? "#ffffff" : "#0b0b0b",
                  }}
                >
                  {pct}%
                </span>
              </TableCell>
              <TableCell className="tnum text-right text-muted-foreground">
                {Math.round(row.totalPlannedHours)} / {Math.round(row.totalActualHours)}
              </TableCell>
              <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
                {row.projects.map((p) => p.projectName).join(", ")}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------

const SEVERITY_META = {
  critical: { icon: ShieldAlert, className: "text-red-700 dark:text-red-400", label: "Critical" },
  warning: { icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400", label: "Warning" },
  info: { icon: Info, className: "text-muted-foreground", label: "Info" },
} as const;

export function RecommendationsPanel({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No findings — the portfolio looks healthy against the standard checks.
      </p>
    );
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
              <p className="mt-0.5 text-xs text-muted-foreground">
                {meta.label} · {r.category}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
