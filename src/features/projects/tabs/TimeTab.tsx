/** Time tracking: consumed vs budget, by person, by task code, recent entries. */

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HOURS_PER_DAY } from "@/lib/config";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { cn, formatDate, formatNumber, formatPct } from "@/lib/utils";

export function TimeTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { metrics, project, entries } = snapshot;

  if (project.timorcCodes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No Timorc code on this board's “Taches Timorc” card, so time spent can't be matched. Add a code
        like <code>MAURITIUS9 - 100.003</code> to the card and re-import.
      </p>
    );
  }

  const recent = [...entries].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)).slice(0, 25);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Hours consumed vs budget</CardTitle>
          {metrics.overBudget && (
            <Badge variant="outline" className="border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" /> Over budget
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <Progress value={metrics.budgetConsumedPct ?? 0} className="h-2 flex-1"
              barClassName={metrics.overBudget ? "bg-red-600" : (metrics.budgetConsumedPct ?? 0) >= 90 ? "bg-amber-500" : "bg-primary"} />
            <span className="tnum text-sm font-medium">{formatPct(metrics.budgetConsumedPct)}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="muted">Budget: {metrics.budgetHours == null ? "—" : `${Math.round(metrics.budgetHours)}h`}</Badge>
            <Badge variant="muted">Consumed: {Math.round(metrics.consumedHours)}h ({formatNumber(metrics.consumedDays)} days)</Badge>
            <Badge variant="muted">Remaining: {metrics.remainingHours == null ? "—" : `${Math.round(metrics.remainingHours)}h`}</Badge>
            <Badge variant="muted">{metrics.timeEntryCount} time entries · {HOURS_PER_DAY}h/day</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Hours by person</CardTitle></CardHeader>
          <CardContent className="p-0">
            {metrics.byResource.length === 0 ? (
              <p className="p-5 text-xs text-muted-foreground">No time logged yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Person</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
                <TableBody>
                  {metrics.byResource.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="tnum text-right">{formatNumber(r.days)}</TableCell>
                      <TableCell className="tnum text-right">{Math.round(r.hours)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Hours by task code</CardTitle></CardHeader>
          <CardContent className="p-0">
            {metrics.byCode.length === 0 ? (
              <p className="p-5 text-xs text-muted-foreground">No time logged yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Task</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
                <TableBody>
                  {metrics.byCode.map((c) => (
                    <TableRow key={c.code}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">{c.task || "—"}</TableCell>
                      <TableCell className="tnum text-right">{Math.round(c.hours)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {recent.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent entries</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Person</TableHead><TableHead>Code</TableHead><TableHead className="text-right">Days</TableHead><TableHead>Comment</TableHead></TableRow></TableHeader>
              <TableBody>
                {recent.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="tnum">{formatDate(e.date)}</TableCell>
                    <TableCell>{e.person}</TableCell>
                    <TableCell className="font-mono text-xs">{e.code}</TableCell>
                    <TableCell className={cn("tnum text-right")}>{formatNumber(e.days)}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">{e.comment || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
