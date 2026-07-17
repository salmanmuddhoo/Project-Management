import { HashRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { KanbanPage } from "@/features/kanban/KanbanPage";
import { ProjectDetailPage } from "@/features/projects/ProjectDetailPage";
import { ProjectsListPage } from "@/features/projects/ProjectsListPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { UploadPage } from "@/features/upload/UploadPage";

/**
 * HashRouter keeps the SPA deployable as plain static files (no server
 * rewrites needed) — consistent with the zero-backend architecture.
 */
export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsListPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="kanban" element={<KanbanPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="import" element={<UploadPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </TooltipProvider>
  );
}
