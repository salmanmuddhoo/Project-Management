/**
 * Executive recommendations — surfaces each project's computed risk reasons
 * plus a couple of cross-project findings, severity-ranked.
 */

import type { ProjectSnapshot } from "./portfolioMetrics";

export type RecommendationSeverity = "critical" | "warning" | "info";

export interface Recommendation {
  severity: RecommendationSeverity;
  category: "Schedule" | "Budget" | "Delivery" | "Governance" | "Time";
  projectId?: string;
  message: string;
}

const GOVERNANCE_STANDARD = 70;

export function generateRecommendations(snapshots: ProjectSnapshot[]): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const s of snapshots) {
    const name = s.project.charter.projectName || s.project.charter.projectCode;

    for (const reason of s.health.reasons) {
      const category: Recommendation["category"] = /budget|hours|time/i.test(reason.message)
        ? "Budget"
        : /schedule|overdue|end date/i.test(reason.message)
          ? "Schedule"
          : "Delivery";
      recs.push({ severity: reason.severity, category, projectId: s.project.id, message: `${name}: ${reason.message}` });
    }

    if (s.project.timorcCodes.length === 0) {
      recs.push({
        severity: "warning",
        category: "Time",
        projectId: s.project.id,
        message: `${name}: no Timorc code on the board — time spent can't be tracked.`,
      });
    }
    if (s.governance.score < GOVERNANCE_STANDARD) {
      recs.push({
        severity: "warning",
        category: "Governance",
        projectId: s.project.id,
        message: `${name}: governance score ${s.governance.score} is below the company standard of ${GOVERNANCE_STANDARD}.`,
      });
    }
  }

  const order: Record<RecommendationSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}
