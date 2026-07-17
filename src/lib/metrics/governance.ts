/**
 * Governance checks per lifecycle phase.
 *
 * Every project follows Initiation → Planning → Execution → Monitoring &
 * Control → Closure. For each phase the framework requires certain artifacts
 * to exist in the workbook; the governance score is the pass-rate across all
 * phases up to (and including) the project's current phase.
 */

import type { LifecyclePhase, Project } from "@/types/project";
import { LIFECYCLE_PHASES } from "@/types/project";
import type { ProjectMetrics } from "./projectMetrics";

export interface GovernanceCheck {
  label: string;
  passed: boolean;
}

export interface PhaseGovernance {
  phase: LifecyclePhase;
  /** Whether the project has reached this phase yet. */
  applicable: boolean;
  checks: GovernanceCheck[];
  passRate: number;
}

export interface GovernanceResult {
  phases: PhaseGovernance[];
  /** Pass-rate (0–100) over applicable phases only. */
  score: number;
  failedChecks: string[];
}

const has = (s: string | null | undefined) => !!String(s ?? "").trim();

export function computeGovernance(
  project: Project,
  m: ProjectMetrics,
): GovernanceResult {
  const { charter } = project;
  const phaseIndex = Math.max(
    0,
    LIFECYCLE_PHASES.indexOf(charter.currentPhase || "Initiation"),
  );

  const defs: Array<{ phase: LifecyclePhase; checks: GovernanceCheck[] }> = [
    {
      phase: "Initiation",
      checks: [
        { label: "Sponsor assigned", passed: has(charter.sponsor) },
        { label: "Project manager assigned", passed: has(charter.projectManager) },
        { label: "Business need documented", passed: has(charter.businessNeed) },
        { label: "Objectives documented", passed: has(charter.objectives) },
        { label: "Benefits documented", passed: has(charter.benefits) },
        {
          label: "Budget approved",
          passed: charter.budget != null && charter.budget > 0,
        },
      ],
    },
    {
      phase: "Planning",
      checks: [
        {
          label: "Planned start & end dates set",
          passed:
            charter.plannedStartDate != null && charter.plannedEndDate != null,
        },
        {
          label: "Scope defined (deliverables + out of scope)",
          passed:
            project.scope.deliverables.length > 0 &&
            project.scope.outOfScope.length > 0,
        },
        { label: "Milestones planned", passed: project.milestones.length > 0 },
        { label: "Resource plan in place", passed: project.resources.length > 0 },
        { label: "Budget broken down by category", passed: project.budget.length > 0 },
        { label: "Expected outputs defined", passed: project.outputs.length > 0 },
      ],
    },
    {
      phase: "Execution",
      checks: [
        { label: "Product backlog maintained", passed: project.backlog.length > 0 },
        {
          label: "Time tracking in use",
          passed: project.timeTracking.length > 0,
        },
        {
          label: "Progress reported",
          passed: charter.currentProgressPct != null,
        },
      ],
    },
    {
      phase: "Monitoring & Control",
      checks: [
        { label: "Risk register maintained", passed: project.risks.length > 0 },
        { label: "Issue log maintained", passed: project.issues.length > 0 },
        {
          label: "Actual costs tracked",
          passed: project.budget.some((b) => b.actual != null),
        },
        {
          label: "Overall health reported",
          passed: has(charter.overallHealth),
        },
      ],
    },
    {
      phase: "Closure",
      checks: [
        {
          label: "All expected outputs completed",
          passed: m.outputsTotal > 0 && m.outputsRemaining === 0,
        },
        {
          label: "All milestones completed",
          passed:
            m.milestonesTotal > 0 && m.milestonesCompleted === m.milestonesTotal,
        },
        {
          label: "Customer approval obtained on outputs",
          passed:
            project.outputs.length > 0 &&
            project.outputs.every((o) =>
              ["yes", "approved"].includes(
                String(o.customerApproval).trim().toLowerCase(),
              ),
            ),
        },
        {
          label: "No open critical issues",
          passed: m.openCriticalIssues === 0,
        },
      ],
    },
  ];

  const phases: PhaseGovernance[] = defs.map((def, i) => {
    const applicable = i <= phaseIndex;
    const passed = def.checks.filter((c) => c.passed).length;
    return {
      phase: def.phase,
      applicable,
      checks: def.checks,
      passRate: def.checks.length > 0 ? (passed / def.checks.length) * 100 : 100,
    };
  });

  const applicablePhases = phases.filter((p) => p.applicable);
  const score = Math.round(
    applicablePhases.reduce((s, p) => s + p.passRate, 0) /
      Math.max(1, applicablePhases.length),
  );
  const failedChecks = applicablePhases.flatMap((p) =>
    p.checks.filter((c) => !c.passed).map((c) => `${p.phase}: ${c.label}`),
  );

  return { phases, score, failedChecks };
}
