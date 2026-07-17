/**
 * Project detail — tabbed views over the parsed workbook, plus the computed
 * Overview and Governance tabs. `?tab=` deep-links a tab (used by global
 * search and dashboard widgets).
 */

import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { PriorityBadge, RagBadge, StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSnapshot } from "@/store/portfolioStore";

import { GovernanceTab } from "./tabs/GovernanceTab";
import { OverviewTab } from "./tabs/OverviewTab";
import {
  DeliveryTab,
  RisksIssuesTab,
  TasksTab,
  TeamBudgetTab,
} from "./tabs/WorkbookTabs";

const TABS = ["overview", "delivery", "risks", "team", "tasks", "governance"] as const;

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const snapshot = useSnapshot(projectId);

  if (!snapshot) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          This project is not in the current session — it may have been removed,
          or the session was refreshed (data is never stored).
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const requested = params.get("tab") ?? "overview";
  const activeTab = (TABS as readonly string[]).includes(requested) ? requested : "overview";
  const c = snapshot.project.charter;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to projects">
          <Link to="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{c.projectName}</h1>
          <p className="text-xs text-muted-foreground">
            {c.projectCode} · {c.businessUnit || "No business unit"} · PM: {c.projectManager || "—"} ·
            Sponsor: {c.sponsor || "—"} · Phase: {c.currentPhase || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={c.priority} />
          <StatusBadge status={c.status} />
          <RagBadge rag={snapshot.health.rag} score={snapshot.health.score} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => setParams({ tab }, { replace: true })}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="risks">Risks &amp; Issues</TabsTrigger>
            <TabsTrigger value="team">Team &amp; Budget</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><OverviewTab snapshot={snapshot} /></TabsContent>
        <TabsContent value="delivery"><DeliveryTab snapshot={snapshot} /></TabsContent>
        <TabsContent value="risks"><RisksIssuesTab snapshot={snapshot} /></TabsContent>
        <TabsContent value="team"><TeamBudgetTab snapshot={snapshot} /></TabsContent>
        <TabsContent value="tasks"><TasksTab snapshot={snapshot} /></TabsContent>
        <TabsContent value="governance"><GovernanceTab snapshot={snapshot} /></TabsContent>
      </Tabs>
    </div>
  );
}
