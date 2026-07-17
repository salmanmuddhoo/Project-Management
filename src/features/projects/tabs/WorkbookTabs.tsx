/**
 * Workbook data tabs — read-only views mirroring the Excel sheets, enriched
 * with computed columns (variance, utilization, over-allocation flags).
 */

import { AlertTriangle } from "lucide-react";

import { PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { cn, formatDate, formatMoney, formatNumber, formatPct } from "@/lib/utils";

function NoRows({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      No {label} recorded in this workbook.
    </p>
  );
}

const overdueClass = "text-red-700 dark:text-red-400 font-medium";

// ---------------------------------------------------------------------------

export function OutputsTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { outputs } = snapshot.project;
  const m = snapshot.metrics;
  if (outputs.length === 0) return <NoRows label="expected outputs" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="muted">Completed: {m.outputsCompleted}</Badge>
        <Badge variant="muted">Remaining: {m.outputsRemaining}</Badge>
        <Badge
          variant="outline"
          className={cn(m.outputsDelayed > 0 && "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400")}
        >
          Delayed: {m.outputsDelayed}
        </Badge>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Deliverable</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Acceptance Criteria</TableHead>
              <TableHead>Planned</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead className="w-36">Completion</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outputs.map((o) => {
              const late =
                o.plannedDeliveryDate != null &&
                o.plannedDeliveryDate < new Date() &&
                (o.completionPct ?? 0) < 100;
              return (
                <TableRow key={o.outputId}>
                  <TableCell className="font-mono text-xs">{o.outputId}</TableCell>
                  <TableCell>
                    <p className="font-medium">{o.deliverable}</p>
                    {o.description && (
                      <p className="text-xs text-muted-foreground">{o.description}</p>
                    )}
                  </TableCell>
                  <TableCell>{o.owner || "—"}</TableCell>
                  <TableCell className="max-w-56 text-xs text-muted-foreground">
                    {o.acceptanceCriteria || "—"}
                  </TableCell>
                  <TableCell className={cn("tnum", late && overdueClass)}>
                    {formatDate(o.plannedDeliveryDate)}
                  </TableCell>
                  <TableCell className="tnum">{formatDate(o.actualDeliveryDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={o.completionPct} className="flex-1" />
                      <span className="tnum text-xs">{formatPct(o.completionPct ?? 0)}</span>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell>{o.customerApproval || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ScopeTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { scope } = snapshot.project;
  const sections: Array<[string, string[]]> = [
    ["Deliverables", scope.deliverables],
    ["Out of Scope", scope.outOfScope],
    ["Success Criteria", scope.successCriteria],
    ["Dependencies", scope.dependencies],
    ["Constraints", scope.constraints],
    ["Assumptions", scope.assumptions],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sections.map(([title, items]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not defined.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function MilestonesTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { milestones } = snapshot.project;
  if (milestones.length === 0) return <NoRows label="milestones" />;
  const today = new Date();
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Milestone</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Planned</TableHead>
            <TableHead>Actual</TableHead>
            <TableHead className="w-36">Progress</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {milestones.map((m, i) => {
            const done =
              ["completed", "done"].includes(m.status.trim().toLowerCase()) ||
              (m.progressPct ?? 0) >= 100;
            const late = !done && m.plannedDate != null && m.plannedDate < today;
            return (
              <TableRow key={i}>
                <TableCell>
                  <p className="font-medium">{m.milestone}</p>
                  {m.description && (
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  )}
                </TableCell>
                <TableCell>{m.owner || "—"}</TableCell>
                <TableCell className={cn("tnum", late && overdueClass)}>
                  {formatDate(m.plannedDate)}
                  {late && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
                </TableCell>
                <TableCell className="tnum">{formatDate(m.actualDate)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={m.progressPct} className="flex-1" />
                    <span className="tnum text-xs">{formatPct(m.progressPct ?? 0)}</span>
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={m.status} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function ResourcesTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const rows = snapshot.metrics.resourceInsights;
  if (rows.length === 0) return <NoRows label="resource plans" />;
  return (
    <div className="space-y-4">
      {snapshot.metrics.overallocated.length > 0 && (
        <p className="flex items-center gap-2 rounded-md border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {snapshot.metrics.overallocated.map((r) => r.employee).join(", ")}{" "}
          exceed(s) available capacity on this project.
        </p>
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Allocation</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Utilization</TableHead>
              <TableHead className="text-right">Planned Cost</TableHead>
              <TableHead className="text-right">Actual Cost</TableHead>
              <TableHead className="text-right">Cost Var.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} className={cn(r.overAllocated && "bg-red-600/5")}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {r.employee}
                    {r.overAllocated && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    )}
                  </span>
                </TableCell>
                <TableCell>{r.role || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.department || "—"}</TableCell>
                <TableCell className={cn("tnum text-right", (r.allocationPct ?? 0) > 100 && overdueClass)}>
                  {r.allocationPct == null ? "—" : formatPct(r.allocationPct)}
                </TableCell>
                <TableCell className="tnum text-right">{formatNumber(r.availableHours)}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(r.plannedHours)}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(r.actualHours)}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(r.hoursRemaining)}</TableCell>
                <TableCell className="tnum text-right">
                  {r.utilizationPct == null ? "—" : formatPct(r.utilizationPct)}
                </TableCell>
                <TableCell className="tnum text-right">{formatMoney(r.plannedCost)}</TableCell>
                <TableCell className="tnum text-right">{formatMoney(r.actualCost)}</TableCell>
                <TableCell
                  className={cn(
                    "tnum text-right",
                    (r.costVariance ?? 0) < 0 && overdueClass,
                  )}
                >
                  {formatMoney(r.costVariance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function BudgetTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { budget } = snapshot.project;
  const m = snapshot.metrics;
  if (budget.length === 0) return <NoRows label="budget lines" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="muted">Planned: {formatMoney(m.budgetPlanned)}</Badge>
        <Badge variant="muted">Actual: {formatMoney(m.budgetActual)}</Badge>
        <Badge variant="muted">Forecast: {formatMoney(m.budgetForecast)}</Badge>
        <Badge
          variant="outline"
          className={cn(
            m.budgetVariance < 0 &&
              "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
          )}
        >
          Variance: {formatMoney(m.budgetVariance)} ({formatPct(m.budgetVariancePct)})
        </Badge>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Forecast</TableHead>
              <TableHead className="text-right">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budget.map((b, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{b.category}</TableCell>
                <TableCell className="tnum text-right">{formatMoney(b.planned)}</TableCell>
                <TableCell className="tnum text-right">{formatMoney(b.actual)}</TableCell>
                <TableCell className="tnum text-right">{formatMoney(b.forecast)}</TableCell>
                <TableCell className={cn("tnum text-right", (b.variance ?? 0) < 0 && overdueClass)}>
                  {formatMoney(b.variance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function RisksTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { risks } = snapshot.project;
  if (risks.length === 0) return <NoRows label="risks" />;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead>Impact</TableHead>
            <TableHead>Mitigation</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {risks.map((r) => (
            <TableRow key={r.riskId}>
              <TableCell className="font-mono text-xs">{r.riskId}</TableCell>
              <TableCell className="max-w-72 font-medium">{r.description}</TableCell>
              <TableCell><PriorityBadge priority={r.probability} /></TableCell>
              <TableCell><PriorityBadge priority={r.impact} /></TableCell>
              <TableCell className="max-w-64 text-xs text-muted-foreground">
                {r.mitigation || "—"}
              </TableCell>
              <TableCell>{r.owner || "—"}</TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function IssuesTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { issues } = snapshot.project;
  if (issues.length === 0) return <NoRows label="issues" />;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Raised</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.issueId}>
              <TableCell className="font-mono text-xs">{issue.issueId}</TableCell>
              <TableCell className="max-w-80 font-medium">{issue.description}</TableCell>
              <TableCell><PriorityBadge priority={issue.severity} /></TableCell>
              <TableCell>{issue.owner || "—"}</TableCell>
              <TableCell className="tnum">{formatDate(issue.raisedDate)}</TableCell>
              <TableCell className="tnum">{formatDate(issue.targetDate)}</TableCell>
              <TableCell><StatusBadge status={issue.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function BacklogTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { backlog } = snapshot.project;
  if (backlog.length === 0) return <NoRows label="backlog items" />;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Epic</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="text-right">Est.</TableHead>
            <TableHead className="text-right">Rem.</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead>Sprint</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {backlog.map((t) => (
            <TableRow key={t.taskId}>
              <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
              <TableCell className="max-w-72">
                <p className="font-medium">{t.taskTitle}</p>
                {t.tags && <p className="text-xs text-muted-foreground">{t.tags}</p>}
              </TableCell>
              <TableCell className="text-muted-foreground">{t.epic || "—"}</TableCell>
              <TableCell><PriorityBadge priority={t.priority} /></TableCell>
              <TableCell className="tnum text-right">{t.storyPoints ?? "—"}</TableCell>
              <TableCell className="tnum text-right">{formatNumber(t.estimatedHours)}</TableCell>
              <TableCell className="tnum text-right">{formatNumber(t.remainingHours)}</TableCell>
              <TableCell className="tnum text-right">{formatNumber(t.actualHours)}</TableCell>
              <TableCell>{t.sprint || "—"}</TableCell>
              <TableCell>{t.assignee || "—"}</TableCell>
              <TableCell className="tnum">{formatDate(t.dueDate)}</TableCell>
              <TableCell><StatusBadge status={t.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function TimeTrackingTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { timeTracking } = snapshot.project;
  if (timeTracking.length === 0) return <NoRows label="time entries" />;
  const total = snapshot.metrics.loggedHours;
  return (
    <div className="space-y-4">
      <Badge variant="muted">Total logged: {formatNumber(total)} hours</Badge>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Task</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Phase</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeTracking.map((t, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{t.employee}</TableCell>
                <TableCell className="tnum">{formatDate(t.date)}</TableCell>
                <TableCell className="font-mono text-xs">{t.taskId || "—"}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(t.hours)}</TableCell>
                <TableCell className="text-muted-foreground">{t.activity || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{t.projectPhase || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
