/** Project tasks, grouped by bucket (swimlane). */

import { PriorityBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { cn, formatDate } from "@/lib/utils";

export function TasksTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { tasks } = snapshot.project;
  if (tasks.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No work tasks in this board.</p>;
  }
  const today = new Date();
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Bucket</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>End</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => {
            const late = !t.endDate && (t.overdue || (t.dueDate != null && t.dueDate < today));
            return (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell><Badge variant="muted">{t.bucket}</Badge></TableCell>
                <TableCell>{t.assignee || "—"}</TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell className="tnum">{formatDate(t.startDate)}</TableCell>
                <TableCell className={cn("tnum", late && "font-medium text-red-700 dark:text-red-400")}>{formatDate(t.dueDate)}</TableCell>
                <TableCell className="tnum">{formatDate(t.endDate)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
