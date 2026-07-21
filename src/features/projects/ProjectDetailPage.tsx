/**
 * Project detail — Overview, Tasks (board), Time and a link back. `?tab=`
 * deep-links a tab (used by global search and dashboard widgets).
 */

import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { RagBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSnapshot } from "@/store/portfolioStore";

import { OverviewTab } from "./tabs/OverviewTab";
import { TasksTab } from "./tabs/TasksTab";
import { TimeTab } from "./tabs/TimeTab";

const TABS = ["overview", "tasks", "time"] as const;

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const snapshot = useSnapshot(projectId);

  if (!snapshot) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          This project is not in the current session — it may have been removed, or the session was
          refreshed (data is never stored).
        </p>
        <Button asChild variant="outline" className="mt-4"><Link to="/projects">Back to projects</Link></Button>
      </div>
    );
  }

  const requested = params.get("tab") ?? "overview";
  const activeTab = (TABS as readonly string[]).includes(requested) ? requested : "overview";
  const c = snapshot.project.charter;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to projects"><Link to="/projects"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{c.projectName}</h1>
          <p className="text-xs text-muted-foreground">
            {c.projectCode} · PM: {c.manager || "—"} · {snapshot.project.timorcCodes.map((t) => t.code).join(", ") || "no Timorc code"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">{snapshot.metrics.tasksTotal} tasks</Badge>
          <RagBadge rag={snapshot.health.rag} score={snapshot.health.score} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => setParams({ tab }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab snapshot={snapshot} /></TabsContent>
        <TabsContent value="tasks"><TasksTab snapshot={snapshot} /></TabsContent>
        <TabsContent value="time"><TimeTab snapshot={snapshot} /></TabsContent>
      </Tabs>
    </div>
  );
}
