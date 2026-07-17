/**
 * Governance checks per lifecycle phase.
 *
 * Every project follows Initiation → Planning → Execution → Monitoring &
 * Control → Closure. For each phase the framework requires certain artifacts
 * in the workbook; the governance score is the pass-rate across all phases up
 * to (and including) the project's current phase.
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
  applicable: boolean;
  checks: GovernanceCheck[];
  passRate: number;
}

export interface GovernanceResult {
  phases: PhaseGovernance[];
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
        { label: "Budget approved", passed: charter.budget != null && charter.budget > 0 },
      ],
    },
    {
      phase: "Planning",
      checks: [
        {
          label: "Start & target end dates set",
          passed: charter.plannedStartDate != null && charter.plannedEndDate != null,
        },
        {
          label: "Scope defined (in & out of scope)",
          passed: project.scope.inScope.length > 0 && project.scope.outOfScope.length > 0,
        },
        { label: "Milestones planned", passed: project.milestones.length > 0 },
        { label: "Team assigned", passed: project.team.length > 0 },
        { label: "Budget broken down", passed: project.budget.length > 0 },
        { label: "Deliverables defined", passed: project.deliverables.length > 0 },
      ],
    },
    {
      phase: "Execution",
      checks: [
        { label: "Task list maintained", passed: project.tasks.length > 0 },
        { label: "Actual hours tracked", passed: project.team.some((r) => r.actualHours != null) },
        { label: "Status reported", passed: has(charter.status) },
      ],
    },
    {
      phase: "Monitoring & Control",
      checks: [
        { label: "Risks logged", passed: project.risks.length > 0 },
        { label: "Issues logged", passed: project.issues.length > 0 },
        { label: "Actual costs tracked", passed: project.budget.some((b) => b.actual != null) },
      ],
    },
    {
      phase: "Closure",
      checks: [
        {
          label: "All deliverables completed",
          passed: m.deliverablesTotal > 0 && m.deliverablesRemaining === 0,
        },
        {
          label: "All milestones completed",
          passed: m.milestonesTotal > 0 && m.milestonesCompleted === m.milestonesTotal,
        },
        {
          label: "Deliverables signed off",
          passed:
            project.deliverables.length > 0 &&
            project.deliverables.every((o) =>
              ["yes", "approved", "signed off"].includes(String(o.signOff).trim().toLowerCase()),
            ),
        },
        { label: "No open critical issues", passed: m.openCriticalIssues === 0 },
      ],
    },
  ];

  const phases: PhaseGovernance[] = defs.map((def, i) => {
    const passed = def.checks.filter((c) => c.passed).length;
    return {
      phase: def.phase,
      applicable: i <= phaseIndex,
      checks: def.checks,
      passRate: def.checks.length > 0 ? (passed / def.checks.length) * 100 : 100,
    };
  });

  const applicable = phases.filter((p) => p.applicable);
  const score = Math.round(
    applicable.reduce((s, p) => s + p.passRate, 0) / Math.max(1, applicable.length),
  );
  const failedChecks = applicable.flatMap((p) =>
    p.checks.filter((c) => !c.passed).map((c) => `${p.phase}: ${c.label}`),
  );

  return { phases, score, failedChecks };
}
