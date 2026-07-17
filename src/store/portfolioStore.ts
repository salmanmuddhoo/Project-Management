/**
 * In-memory portfolio store (Zustand).
 *
 * Deliberately NO persistence middleware: closing or refreshing the browser
 * discards every uploaded workbook. Only the raw parsed projects, the filter
 * state and session-only Kanban drags live here — all analytics are derived
 * through the memoized hooks below.
 */

import { useMemo } from "react";
import { create } from "zustand";

import {
  buildSnapshot,
  computeCapacity,
  computePortfolioMetrics,
  type ProjectSnapshot,
} from "@/lib/metrics/portfolioMetrics";
import { generateRecommendations } from "@/lib/metrics/recommendations";
import { EMPTY_FILTERS, type PortfolioFilters } from "@/types/filters";
import type { KanbanColumn, Project } from "@/types/project";

interface PortfolioState {
  projects: Project[];
  filters: PortfolioFilters;
  /** Session-only Kanban drags: `${projectId}:${taskId}` → column. */
  kanbanOverrides: Record<string, KanbanColumn>;

  addProjects: (projects: Project[]) => void;
  removeProject: (id: string) => void;
  clearAll: () => void;
  setFilters: (patch: Partial<PortfolioFilters>) => void;
  resetFilters: () => void;
  moveTask: (projectId: string, taskId: string, column: KanbanColumn) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  projects: [],
  filters: EMPTY_FILTERS,
  kanbanOverrides: {},

  addProjects: (incoming) =>
    set((state) => {
      const ids = new Set(incoming.map((p) => p.id));
      // Re-importing the same workbook replaces the previous version.
      const kept = state.projects.filter((p) => !ids.has(p.id));
      return { projects: [...kept, ...incoming] };
    }),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      kanbanOverrides: Object.fromEntries(
        Object.entries(state.kanbanOverrides).filter(
          ([key]) => !key.startsWith(`${id}:`),
        ),
      ),
    })),

  clearAll: () =>
    set({ projects: [], kanbanOverrides: {}, filters: EMPTY_FILTERS }),

  setFilters: (patch) =>
    set((state) => ({ filters: { ...state.filters, ...patch } })),

  resetFilters: () => set({ filters: EMPTY_FILTERS }),

  moveTask: (projectId, taskId, column) =>
    set((state) => ({
      kanbanOverrides: {
        ...state.kanbanOverrides,
        [`${projectId}:${taskId}`]: column,
      },
    })),
}));

// ---------------------------------------------------------------------------
// Derived data hooks
// ---------------------------------------------------------------------------

/** Applies session Kanban drags to a project's backlog before analysis. */
function withOverrides(
  project: Project,
  overrides: Record<string, KanbanColumn>,
): Project {
  const touched = project.backlog.some(
    (t) => overrides[`${project.id}:${t.taskId}`] != null,
  );
  if (!touched) return project;
  return {
    ...project,
    backlog: project.backlog.map((t) => {
      const override = overrides[`${project.id}:${t.taskId}`];
      return override ? { ...t, status: override } : t;
    }),
  };
}

/** All snapshots (unfiltered), memoized on store contents. */
export function useSnapshots(): ProjectSnapshot[] {
  const projects = usePortfolioStore((s) => s.projects);
  const overrides = usePortfolioStore((s) => s.kanbanOverrides);
  return useMemo(
    () => projects.map((p) => buildSnapshot(withOverrides(p, overrides))),
    [projects, overrides],
  );
}

function matchesFilters(
  snapshot: ProjectSnapshot,
  f: PortfolioFilters,
): boolean {
  const c = snapshot.project.charter;
  const inList = (list: string[], value: string) =>
    list.length === 0 || list.includes(value);

  if (!inList(f.projects, snapshot.project.id)) return false;
  if (!inList(f.projectManagers, c.projectManager)) return false;
  if (!inList(f.businessUnits, c.businessUnit)) return false;
  if (!inList(f.statuses, c.status)) return false;
  if (!inList(f.priorities, c.priority)) return false;
  if (!inList(f.sponsors, c.sponsor)) return false;
  if (!inList(f.fundingTypes, c.fundingType)) return false;

  // Date range: keep projects whose planned window intersects the range.
  if (f.dateFrom && c.plannedEndDate && c.plannedEndDate < f.dateFrom) {
    return false;
  }
  if (f.dateTo && c.plannedStartDate && c.plannedStartDate > f.dateTo) {
    return false;
  }
  return true;
}

/** Snapshots surviving the active portfolio filters. */
export function useFilteredSnapshots(): ProjectSnapshot[] {
  const snapshots = useSnapshots();
  const filters = usePortfolioStore((s) => s.filters);
  return useMemo(
    () => snapshots.filter((s) => matchesFilters(s, filters)),
    [snapshots, filters],
  );
}

export function usePortfolioAnalytics() {
  const snapshots = useFilteredSnapshots();
  return useMemo(
    () => ({
      snapshots,
      portfolio: computePortfolioMetrics(snapshots),
      capacity: computeCapacity(snapshots),
      recommendations: generateRecommendations(snapshots),
    }),
    [snapshots],
  );
}

export function useSnapshot(projectId: string | undefined) {
  const snapshots = useSnapshots();
  return snapshots.find((s) => s.project.id === projectId);
}
