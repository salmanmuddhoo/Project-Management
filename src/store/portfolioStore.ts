/**
 * In-memory store (Zustand) — single-project.
 *
 * No persistence by design: closing or refreshing the browser discards the
 * imported board and time file. Holds the current project, the pool of Timorc
 * time entries (matched to the project on the fly), and session-only Kanban
 * drags. All analytics are derived through the memoized hooks below.
 */

import { useMemo } from "react";
import { create } from "zustand";

import { buildSnapshot, type ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import type { Project } from "@/types/project";
import type { TimeEntry } from "@/types/time";

interface PortfolioState {
  projects: Project[];
  timeEntries: TimeEntry[];
  timeFiles: string[];
  /** Session-only Kanban drags: `${projectId}:${taskId}` → bucket. */
  kanbanOverrides: Record<string, string>;

  addProjects: (projects: Project[]) => void;
  addTimeEntries: (fileName: string, entries: TimeEntry[]) => void;
  clearAll: () => void;
  moveTask: (projectId: string, taskId: string, bucket: string) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  projects: [],
  timeEntries: [],
  timeFiles: [],
  kanbanOverrides: {},

  // Single-project app: importing a board replaces the current project.
  addProjects: (incoming) => set(() => ({ projects: incoming.slice(0, 1), kanbanOverrides: {} })),

  addTimeEntries: (fileName, entries) =>
    set((state) => {
      const kept = state.timeEntries.filter((e) => e.sourceFile !== fileName);
      return {
        timeEntries: [...kept, ...entries],
        timeFiles: [...new Set([...state.timeFiles, fileName])],
      };
    }),

  clearAll: () => set({ projects: [], timeEntries: [], timeFiles: [], kanbanOverrides: {} }),

  moveTask: (projectId, taskId, bucket) =>
    set((state) => ({ kanbanOverrides: { ...state.kanbanOverrides, [`${projectId}:${taskId}`]: bucket } })),
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

/** The single active project's snapshot, or undefined when nothing imported. */
export function useActiveSnapshot(): ProjectSnapshot | undefined {
  const projects = usePortfolioStore((s) => s.projects);
  const timeEntries = usePortfolioStore((s) => s.timeEntries);
  const overrides = usePortfolioStore((s) => s.kanbanOverrides);
  return useMemo(() => {
    const project = projects[0];
    return project ? buildSnapshot(withOverrides(project, overrides), timeEntries) : undefined;
  }, [projects, timeEntries, overrides]);
}

export function useHasProject(): boolean {
  return usePortfolioStore((s) => s.projects.length > 0);
}
