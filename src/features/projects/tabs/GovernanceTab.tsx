/** Governance tab — phase-gate checks against the standard framework. */

import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import { RagBadge } from "@/components/shared/badges";
import { ragOf } from "@/lib/metrics/healthScore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { cn } from "@/lib/utils";

export function GovernanceTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { governance } = snapshot;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Governance score across phases reached so far:
        </p>
        <RagBadge rag={ragOf(governance.score)} score={governance.score} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {governance.phases.map((phase) => (
          <Card
            key={phase.phase}
            className={cn(!phase.applicable && "opacity-60")}
          >
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{phase.phase}</CardTitle>
              <span className="tnum text-xs text-muted-foreground">
                {phase.applicable
                  ? `${Math.round(phase.passRate)}%`
                  : "Not reached"}
              </span>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {phase.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-sm">
                    {!phase.applicable ? (
                      <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : check.passed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    )}
                    <span className={cn(!check.passed && phase.applicable && "font-medium")}>
                      {check.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
