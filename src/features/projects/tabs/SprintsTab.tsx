/**
 * Sprint management view — sprint table plus burndown, velocity and
 * remaining-work charts, driven by the optional Sprints worksheet.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/components/charts/ChartCard";
import { useChartTheme } from "@/components/charts/chartTheme";
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
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { formatDate, formatNumber, formatPct } from "@/lib/utils";

export function SprintsTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const theme = useChartTheme();
  const sprints = snapshot.project.sprints;

  if (sprints.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This workbook has no Sprints sheet — add the optional worksheet to
        unlock burndown and velocity charts.
      </p>
    );
  }

  // Burndown: remaining committed work after each sprint completes.
  const totalCommitted = sprints.reduce((s, sp) => s + (sp.committedHours ?? 0), 0);
  let remaining = totalCommitted;
  const burndown = [
    { name: "Start", Remaining: Math.round(totalCommitted) },
    ...sprints.map((sp) => {
      remaining -= sp.completedHours ?? 0;
      return {
        name: sp.sprintNumber,
        Remaining: Math.round(Math.max(0, remaining)),
      };
    }),
  ];

  const velocity = sprints.map((sp) => ({
    name: sp.sprintNumber,
    Velocity: sp.velocity ?? 0,
    Completed: sp.completedHours ?? 0,
  }));

  const tick = { fill: theme.tickInk, fontSize: 11 };
  const tooltipStyle = {
    backgroundColor: theme.tooltip.backgroundColor,
    border: theme.tooltip.border,
    borderRadius: 8,
    color: theme.tooltip.color,
    fontSize: 12,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Burndown" description="Committed hours remaining after each sprint">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={burndown} margin={{ right: 16 }}>
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="Remaining"
                stroke={theme.series[0]}
                strokeWidth={2}
                dot={{ r: 3, fill: theme.series[0] }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Velocity" description="Story-point velocity and completed hours per sprint">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={velocity} margin={{ right: 8 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} width={44} />
              <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Velocity" fill={theme.series[0]} barSize={14} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Completed" fill={theme.series[1]} barSize={14} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sprint</TableHead>
              <TableHead>Goal</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Committed</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Velocity</TableHead>
              <TableHead className="w-36">Completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sprints.map((sp) => (
              <TableRow key={sp.sprintNumber}>
                <TableCell className="font-medium">{sp.sprintNumber}</TableCell>
                <TableCell className="max-w-64 text-muted-foreground">{sp.sprintGoal || "—"}</TableCell>
                <TableCell className="tnum">{formatDate(sp.startDate)}</TableCell>
                <TableCell className="tnum">{formatDate(sp.endDate)}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(sp.capacity)}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(sp.committedHours)}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(sp.completedHours)}</TableCell>
                <TableCell className="tnum text-right">{formatNumber(sp.velocity)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={sp.completionPct} className="flex-1" />
                    <span className="tnum text-xs">{formatPct(sp.completionPct ?? 0)}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
