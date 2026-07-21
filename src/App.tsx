import { HashRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KanbanPage } from "@/features/kanban/KanbanPage";
import { OverviewPage } from "@/features/project/OverviewPage";
import { ProjectDetailsPage } from "@/features/project/ProjectDetailsPage";
import { ResourcesPage } from "@/features/project/ResourcesPage";
import { TimePage } from "@/features/project/TimeView";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { UploadPage } from "@/features/upload/UploadPage";

/**
 * Single-project app. HashRouter keeps it deployable as plain static files
 * (no server rewrites needed) — consistent with the zero-backend architecture.
 */
export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="details" element={<ProjectDetailsPage />} />
            <Route path="resources" element={<ResourcesPage />} />
            <Route path="kanban" element={<KanbanPage />} />
            <Route path="time" element={<TimePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="import" element={<UploadPage />} />
            <Route path="*" element={<OverviewPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </TooltipProvider>
  );
}
