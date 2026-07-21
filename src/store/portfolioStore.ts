/**
 * In-memory portfolio store (Zustand).
 *
 * No persistence middleware by design: closing or refreshing the browser
 * discards every imported board and time file. Holds the parsed Planner
 * projects, the global pool of Timorc time entries (matched to projects on
 * the fly), filter state, and session-only Kanban drags.
 */

import { useMemo } from "react";
import { create } from "zustand";

import { buildSnapshot, computeCapacity, computePortfolioMetrics, type ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { generateRecommendations } from "@/lib/metrics/recommendations";
import { EMPTY_FILTERS, type PortfolioFilters } from "@/types/filters";
import type { Project } from "@/types/project";
import type { TimeEntry } from "@/types/time";

interface PortfolioState {
  projects: Project[];
  /** Global pool of time entries from all imported time files. */
  timeEntries: TimeEntry[];
  /** Source file names already imported (to de-dupe time files). */
  timeFiles: string[];
  filters: PortfolioFilters;
  /** Session-only Kanban drags: `${projectId}:${taskId}` → bucket. */
  kanbanOverrides: Record<string, string>;

  addProjects: (projects: Project[]) => void;
  addTimeEntries: (fileName: string, entries: TimeEntry[]) => void;
  removeProject: (id: string) => void;
  clearAll: () => void;
  setFilters: (patch: Partial<PortfolioFilters>) => void;
  resetFilters: () => void;
  moveTask: (projectId: string, taskId: string, bucket: string) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  projects: [],
  timeEntries: [],
  timeFiles: [],
  filters: EMPTY_FILTERS,
  kanbanOverrides: {},

  addProjects: (incoming) =>
    set((state) => {
      const ids = new Set(incoming.map((p) => p.id));
      const kept = state.projects.filter((p) => !ids.has(p.id));
      return { projects: [...kept, ...incoming] };
    }),

  addTimeEntries: (fileName, entries) =>
    set((state) => {
      // Re-importing the same time file replaces its entries.
      const kept = state.timeEntries.filter((e) => e.sourceFile !== fileName);
      return {
        timeEntries: [...kept, ...entries],
        timeFiles: [...new Set([...state.timeFiles, fileName])],
      };
    }),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      kanbanOverrides: Object.fromEntries(
        Object.entries(state.kanbanOverrides).filter(([k]) => !k.startsWith(`${id}:`)),
      ),
    })),

  clearAll: () => set({ projects: [], timeEntries: [], timeFiles: [], kanbanOverrides: {}, filters: EMPTY_FILTERS }),

  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set({ filters: EMPTY_FILTERS }),

  moveTask: (projectId, taskId, bucket) =>
    set((state) => ({
      kanbanOverrides: { ...state.kanbanOverrides, [`${projectId}:${taskId}`]: bucket },
    })),
}));

// ---------------------------------------------------------------------------
// Derived data hooks
// ---------------------------------------------------------------------------

function withOverrides(project: Project, overrides: Record<string, string>): Project {
  const touched = project.tasks.some((t) => overrides[`${project.id}:${t.id}`] != null);
  if (!touched) return project;
  return {
    ...project,
    tasks: project.tasks.map((t) => {
      const override = overrides[`${project.id}:${t.id}`];
      return override ? { ...t, bucket: override } : t;
    }),
  };
}

export function useSnapshots(): ProjectSnapshot[] {
  const projects = usePortfolioStore((s) => s.projects);
  const timeEntries = usePortfolioStore((s) => s.timeEntries);
  const overrides = usePortfolioStore((s) => s.kanbanOverrides);
  return useMemo(
    () => projects.map((p) => buildSnapshot(withOverrides(p, overrides), timeEntries)),
    [projects, timeEntries, overrides],
  );
}

function matchesFilters(s: ProjectSnapshot, f: PortfolioFilters): boolean {
  const inList = (list: string[], value: string) => list.length === 0 || list.includes(value);
  if (!inList(f.projects, s.project.id)) return false;
  if (!inList(f.managers, s.project.charter.manager)) return false;
  if (!inList(f.health, s.health.rag)) return false;
  const { startDate, endDate } = s.project.charter;
  if (f.dateFrom && endDate && endDate < f.dateFrom) return false;
  if (f.dateTo && startDate && startDate > f.dateTo) return false;
  return true;
}

export function useFilteredSnapshots(): ProjectSnapshot[] {
  const snapshots = useSnapshots();
  const filters = usePortfolioStore((s) => s.filters);
  return useMemo(() => snapshots.filter((s) => matchesFilters(s, filters)), [snapshots, filters]);
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
