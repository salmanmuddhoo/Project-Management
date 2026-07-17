import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PriorityBadge, RagBadge, StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoneyCompact, formatPct } from "@/lib/utils";
import { FilterBar } from "@/features/dashboard/FilterBar";
import {
  useFilteredSnapshots,
  usePortfolioStore,
} from "@/store/portfolioStore";

export function ProjectsListPage() {
  const snapshots = useFilteredSnapshots();
  const hasProjects = usePortfolioStore((s) => s.projects.length > 0);
  const removeProject = usePortfolioStore((s) => s.removeProject);

  if (!hasProjects) return <EmptyState />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Every imported workbook, with computed health and progress.
        </p>
      </div>

      <FilterBar />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Business Unit</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40">Progress</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead>Health</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshots.map((s) => (
              <TableRow key={s.project.id}>
                <TableCell>
                  <Link
                    to={`/projects/${s.project.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {s.project.charter.projectName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {s.project.charter.projectCode}
                  </p>
                </TableCell>
                <TableCell>{s.project.charter.projectManager || "—"}</TableCell>
                <TableCell>{s.project.charter.businessUnit || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.project.charter.currentPhase || "—"}
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={s.project.charter.priority} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.project.charter.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={s.metrics.overallProgressPct} className="flex-1" />
                    <span className="tnum text-xs text-muted-foreground">
                      {formatPct(s.metrics.overallProgressPct)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatMoneyCompact(s.metrics.budgetPlanned)}
                </TableCell>
                <TableCell>
                  <RagBadge rag={s.health.rag} score={s.health.score} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${s.project.charter.projectName} from session`}
                    onClick={() => removeProject(s.project.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
