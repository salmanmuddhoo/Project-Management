/**
 * Executive recommendations — a rule engine over the computed snapshots.
 * Each rule fires zero or more severity-ranked, human-readable findings.
 */

import { formatPct } from "@/lib/utils";
import { computeCapacity, type ProjectSnapshot } from "./portfolioMetrics";

export type RecommendationSeverity = "critical" | "warning" | "info";

export interface Recommendation {
  severity: RecommendationSeverity;
  category:
    | "Schedule"
    | "Budget"
    | "Governance"
    | "Resources"
    | "Milestones"
    | "Deliverables"
    | "Risks"
    | "Issues";
  projectId?: string;
  message: string;
}

const GOVERNANCE_STANDARD = 70; // company minimum governance score

export function generateRecommendations(
  snapshots: ProjectSnapshot[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const s of snapshots) {
    const name = s.project.charter.projectName || s.project.charter.projectCode;
    const m = s.metrics;
    const push = (
      severity: RecommendationSeverity,
      category: Recommendation["category"],
      message: string,
    ) => recs.push({ severity, category, projectId: s.project.id, message });

    // Schedule
    if (m.daysDelayed > 0) {
      push(
        m.daysDelayed > 14 ? "critical" : "warning",
        "Schedule",
        `${name} is forecast to finish ${m.daysDelayed} day(s) late.`,
      );
    }

    // Budget
    if (m.budgetVariancePct != null && m.budgetVariancePct < -10) {
      push(
        m.budgetVariancePct < -20 ? "critical" : "warning",
        "Budget",
        `${name} budget variance is ${formatPct(Math.abs(m.budgetVariancePct))} over plan.`,
      );
    }
    if (
      m.budgetConsumedPct != null &&
      m.budgetConsumedPct - m.overallProgressPct > 25
    ) {
      push(
        "warning",
        "Budget",
        `${name} has consumed ${formatPct(m.budgetConsumedPct)} of budget but is only ${formatPct(m.overallProgressPct)} complete.`,
      );
    }

    // Governance
    if (!s.project.charter.sponsor.trim()) {
      push("critical", "Governance", `${name} has no assigned sponsor.`);
    }
    if (s.governance.score < GOVERNANCE_STANDARD) {
      push(
        "warning",
        "Governance",
        `${name} governance score (${s.governance.score}) is below the company standard of ${GOVERNANCE_STANDARD}.`,
      );
    }

    // Milestones
    if (m.milestonesOverdue > 0) {
      push(
        m.milestonesOverdue >= 3 ? "critical" : "warning",
        "Milestones",
        `${name} has ${m.milestonesOverdue} overdue milestone(s).`,
      );
    }

    // Deliverables
    if (
      m.outputsTotal > 0 &&
      m.timeElapsedPct != null &&
      m.timeElapsedPct > 75 &&
      (m.outputCompletionPct ?? 0) < 60
    ) {
      push(
        "warning",
        "Deliverables",
        `${name} has completed only ${formatPct(m.outputCompletionPct)} of expected outputs with ${formatPct(m.timeElapsedPct)} of the timeline elapsed.`,
      );
    }
    if (m.outputsDelayed > 0) {
      push(
        "warning",
        "Deliverables",
        `${name} has ${m.outputsDelayed} delayed expected output(s).`,
      );
    }

    // Risks & issues
    if (m.openHighRisks > 0) {
      push(
        "warning",
        "Risks",
        `${name} carries ${m.openHighRisks} open high-probability/high-impact risk(s).`,
      );
    }
    if (m.openCriticalIssues > 0) {
      push(
        "critical",
        "Issues",
        `${name} has ${m.openCriticalIssues} open critical/high-severity issue(s).`,
      );
    }
  }

  // Cross-project resource over-allocation (someone at 145% across projects).
  for (const row of computeCapacity(snapshots)) {
    if (row.overAllocated && row.totalAllocationPct > 100) {
      recs.push({
        severity: row.totalAllocationPct > 125 ? "critical" : "warning",
        category: "Resources",
        message: `${row.employee} is allocated at ${Math.round(row.totalAllocationPct)}% across ${row.projects.length} project(s).`,
      });
    }
  }

  const order: Record<RecommendationSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}
