/**
 * Governance checks — the artifacts the framework expects a well-run project
 * to have in its Planner board and time tracking. Produces a 0–100 score and
 * the list of failed checks, used in the Governance report and recommendations.
 */

import type { Project } from "@/types/project";
import type { ProjectMetrics } from "./projectMetrics";

export interface GovernanceCheck {
  label: string;
  passed: boolean;
}

export interface GovernanceResult {
  checks: GovernanceCheck[];
  score: number;
  failedChecks: string[];
}

const has = (s: string | null | undefined) => !!String(s ?? "").trim();

export function computeGovernance(
  project: Project,
  m: ProjectMetrics,
): GovernanceResult {
  const c = project.charter;
  const checks: GovernanceCheck[] = [
    { label: "Project charter documented", passed: has(c.notes) },
    { label: "Start & end dates set", passed: c.startDate != null && c.endDate != null },
    { label: "Hours budget defined", passed: c.budgetHours != null && c.budgetHours > 0 },
    { label: "Project manager identified", passed: has(c.manager) },
    { label: "Resources listed", passed: project.resources.length > 0 },
    { label: "Timorc code linked", passed: project.timorcCodes.length > 0 },
    { label: "Work tasks created", passed: project.tasks.length > 0 },
    { label: "Time being logged", passed: m.timeEntryCount > 0 },
    { label: "Within hours budget", passed: !m.overBudget },
    { label: "No overdue tasks", passed: m.tasksOverdue === 0 },
  ];
  const passed = checks.filter((ch) => ch.passed).length;
  return {
    checks,
    score: Math.round((passed / checks.length) * 100),
    failedChecks: checks.filter((ch) => !ch.passed).map((ch) => ch.label),
  };
}
