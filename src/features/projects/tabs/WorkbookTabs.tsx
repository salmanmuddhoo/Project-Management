/**
 * Workbook data tabs — read-only views mirroring the three sheets, enriched
 * with computed columns (variance, utilization, over-allocation, overdue
 * flags). Kept deliberately compact to match the minimal workbook.
 */

import { AlertTriangle } from "lucide-react";

import { PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

const overdueClass = "text-red-700 dark:text-red-400 font-medium";

function NoRows({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      No {label} recorded in this workbook.
    </p>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Delivery = milestones + deliverables
// ---------------------------------------------------------------------------

export function DeliveryTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { milestones, deliverables } = snapshot.project;
  const m = snapshot.metrics;
  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="muted">Milestones: {m.milestonesCompleted}/{m.milestonesTotal}</Badge>
        <Badge variant="muted">Deliverables: {m.deliverablesCompleted}/{m.deliverablesTotal}</Badge>
        <Badge variant="outline" className={cn(m.deliverablesDelayed > 0 && "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400")}>
          Delayed: {m.deliverablesDelayed}
        </Badge>
      </div>

      <SectionCard title="Milestones">
        {milestones.length === 0 ? (
          <div className="p-5 pt-0"><NoRows label="milestones" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Milestone</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Planned</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((ms, i) => {
                const done = ["completed", "done"].includes(ms.status.trim().toLowerCase());
                const late = !done && ms.plannedDate != null && ms.plannedDate < today;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{ms.milestone}</TableCell>
                    <TableCell>{ms.owner || "—"}</TableCell>
                    <TableCell className={cn("tnum", late && overdueClass)}>
                      {formatDate(ms.plannedDate)}
                      {late && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
                    </TableCell>
                    <TableCell className="tnum">{formatDate(ms.actualDate)}</TableCell>
                    <TableCell><StatusBadge status={ms.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Deliverables">
        {deliverables.length === 0 ? (
          <div className="p-5 pt-0"><NoRows label="deliverables" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deliverable</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-36">Completion</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sign-off</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliverables.map((o, i) => {
                const late = o.dueDate != null && o.dueDate < today && (o.completionPct ?? 0) < 100;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{o.deliverable}</TableCell>
                    <TableCell>{o.owner || "—"}</TableCell>
                    <TableCell className={cn("tnum", late && overdueClass)}>{formatDate(o.dueDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={o.completionPct} className="flex-1" />
                        <span className="tnum text-xs">{formatPct(o.completionPct ?? 0)}</span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell>{o.signOff || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risks & Issues
// ---------------------------------------------------------------------------

export function RisksIssuesTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { risks, issues } = snapshot.project;
  return (
    <div className="space-y-4">
      <SectionCard title="Risks">
        {risks.length === 0 ? (
          <div className="p-5 pt-0"><NoRows label="risks" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Likelihood</TableHead>
                <TableHead>Mitigation</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="max-w-72 font-medium">{r.risk}</TableCell>
                  <TableCell><PriorityBadge priority={r.impact} /></TableCell>
                  <TableCell><PriorityBadge priority={r.likelihood} /></TableCell>
                  <TableCell className="max-w-64 text-xs text-muted-foreground">{r.mitigation || "—"}</TableCell>
                  <TableCell>{r.owner || "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Issues">
        {issues.length === 0 ? (
          <div className="p-5 pt-0"><NoRows label="issues" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue, i) => (
                <TableRow key={i}>
                  <TableCell className="max-w-80 font-medium">{issue.issue}</TableCell>
                  <TableCell><PriorityBadge priority={issue.severity} /></TableCell>
                  <TableCell>{issue.owner || "—"}</TableCell>
                  <TableCell className="tnum">{formatDate(issue.targetDate)}</TableCell>
                  <TableCell><StatusBadge status={issue.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team & Budget
// ---------------------------------------------------------------------------

export function TeamBudgetTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const rows = snapshot.metrics.teamInsights;
  const { budget } = snapshot.project;
  const m = snapshot.metrics;

  return (
    <div className="space-y-4">
      {m.overallocated.length > 0 && (
        <p className="flex items-center gap-2 rounded-md border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {m.overallocated.map((r) => r.name).join(", ")} exceed 100% allocation on this project.
        </p>
      )}

      <SectionCard title="Team">
        {rows.length === 0 ? (
          <div className="p-5 pt-0"><NoRows label="team members" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Allocation</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Actual</TableHead>
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
                      {r.name}
                      {r.overAllocated && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.role || "—"}</TableCell>
                  <TableCell className={cn("tnum text-right", (r.allocationPct ?? 0) > 100 && overdueClass)}>
                    {r.allocationPct == null ? "—" : formatPct(r.allocationPct)}
                  </TableCell>
                  <TableCell className="tnum text-right">{formatNumber(r.plannedHours)}</TableCell>
                  <TableCell className="tnum text-right">{formatNumber(r.actualHours)}</TableCell>
                  <TableCell className="tnum text-right">{r.utilizationPct == null ? "—" : formatPct(r.utilizationPct)}</TableCell>
                  <TableCell className="tnum text-right">{formatMoney(r.plannedCost)}</TableCell>
                  <TableCell className="tnum text-right">{formatMoney(r.actualCost)}</TableCell>
                  <TableCell className={cn("tnum text-right", (r.costVariance ?? 0) < 0 && overdueClass)}>
                    {formatMoney(r.costVariance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Budget">
        {budget.length === 0 ? (
          <div className="p-5 pt-0"><NoRows label="budget lines" /></div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 px-5 pb-2 text-xs">
              <Badge variant="muted">Planned: {formatMoney(m.budgetPlanned)}</Badge>
              <Badge variant="muted">Actual: {formatMoney(m.budgetActual)}</Badge>
              <Badge variant="muted">Forecast: {formatMoney(m.budgetForecast)}</Badge>
              <Badge variant="outline" className={cn(m.budgetVariance < 0 && "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400")}>
                Variance: {formatMoney(m.budgetVariance)} ({formatPct(m.budgetVariancePct)})
              </Badge>
            </div>
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
                {budget.map((b, i) => {
                  const variance = b.planned != null ? b.planned - (b.forecast ?? b.actual ?? 0) : null;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{b.category}</TableCell>
                      <TableCell className="tnum text-right">{formatMoney(b.planned)}</TableCell>
                      <TableCell className="tnum text-right">{formatMoney(b.actual)}</TableCell>
                      <TableCell className="tnum text-right">{formatMoney(b.forecast)}</TableCell>
                      <TableCell className={cn("tnum text-right", (variance ?? 0) < 0 && overdueClass)}>
                        {formatMoney(variance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function TasksTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { tasks } = snapshot.project;
  if (tasks.length === 0) return <NoRows label="tasks" />;
  const today = new Date();
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => {
            const late = t.dueDate != null && t.dueDate < today && t.status !== "Done";
            return (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell>{t.owner || "—"}</TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell className={cn("tnum", late && overdueClass)}>{formatDate(t.dueDate)}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
