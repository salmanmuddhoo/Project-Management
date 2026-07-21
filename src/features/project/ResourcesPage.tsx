/**
 * Resources — the team from the Planner board's "Resources" card, enriched
 * with hours logged (from the matched Timorc time entries).
 */

import { Users } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { KpiTile } from "@/components/shared/KpiTile";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { useActiveSnapshot } from "@/store/portfolioStore";

export function ResourcesPage() {
  const snapshot = useActiveSnapshot();
  if (!snapshot) return <EmptyState />;
  const { project, metrics } = snapshot;

  // Timorc names carry an "(iml-xxx)" login suffix the board names don't;
  // strip it so hours attach to the right person.
  const nameKey = (name: string) =>
    name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim();

  const hoursByName = new Map<string, number>();
  for (const r of metrics.byResource)
    hoursByName.set(nameKey(r.name), (hoursByName.get(nameKey(r.name)) ?? 0) + r.hours);
  const lookupHours = (name: string) => hoursByName.get(nameKey(name)) ?? 0;

  // People who logged time but aren't on the Resources card.
  const listed = new Set(project.resources.map((r) => nameKey(r.name)));
  const extra = metrics.byResource.filter((r) => !listed.has(nameKey(r.name)));

  const totalLogged = metrics.byResource.reduce((n, r) => n + r.hours, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Resources</h1>
        <p className="text-sm text-muted-foreground">The team on this project, with hours logged from the time export.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Team members" value={project.resources.length} icon={Users} />
        <KpiTile label="People logging time" value={metrics.byResource.length} />
        <KpiTile label="Total hours logged" value={`${Math.round(totalLogged)}h`} />
        <KpiTile label="Hours budget" value={metrics.budgetHours == null ? "—" : `${Math.round(metrics.budgetHours)}h`} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Hours logged</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {project.resources.length === 0 && extra.length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">No resources listed on the board.</TableCell></TableRow>
            )}
            {project.resources.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="muted">{r.role || "—"}</Badge></TableCell>
                <TableCell className="tnum text-right">{Math.round(lookupHours(r.name))}h</TableCell>
              </TableRow>
            ))}
            {extra.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-muted-foreground">logged time · not on board</Badge></TableCell>
                <TableCell className="tnum text-right">{Math.round(r.hours)}h ({formatNumber(r.days)}d)</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
