/**
 * Project Details — the charter facts plus its narrative sections, parsed
 * from the single "Project Charter" card (Objectif, Pourquoi nous le faisons,
 * Critère de succès, Livrable clé…).
 */

import { FileText } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { daysBetween, formatCost, formatDate } from "@/lib/utils";
import { usePortfolioStore, useActiveSnapshot } from "@/store/portfolioStore";

/** "+N days late" / "N days early" / "on time", comparing an actual date to its planned date. */
function formatDateVariance(planned: Date | null, actual: Date | null): string {
  if (!planned || !actual) return "—";
  const diff = daysBetween(planned, actual);
  if (diff === 0) return "À temps";
  return diff > 0 ? `+${diff} j de retard` : `${Math.abs(diff)} j d'avance`;
}

/** Check if start date is more than 1 week late. */
function isStartDateLate(planned: Date | null, actual: Date | null): boolean {
  if (!planned || !actual) return false;
  const diff = daysBetween(planned, actual);
  return diff > 7;
}

export function ProjectDetailsPage() {
  const snapshot = useActiveSnapshot();
  const risksIssues = usePortfolioStore((s) => s.risksIssues);
  const pmRecommendation = usePortfolioStore((s) => s.pmRecommendation);
  const setRisksIssues = usePortfolioStore((s) => s.setRisksIssues);
  const setPmRecommendation = usePortfolioStore((s) => s.setPmRecommendation);
  if (!snapshot) return <EmptyState />;
  const { project } = snapshot;
  const c = project.charter;

  const budget = [
    c.budgetHours != null ? `${Math.round(c.budgetHours)}h` : null,
    c.budgetCost != null ? formatCost(c.budgetCost, c.currency) : null,
  ].filter(Boolean).join(" · ") || "—";

  const facts: Array<[string, string]> = [
    ["Project", c.projectName],
    ["Code", c.projectCode || "—"],
    ["Project manager", c.manager || "—"],
    ["Département", c.department || "—"],
    ["Communication", c.communication || "—"],
    ["Timorc code(s)", project.timorcCodes.map((t) => t.code).join(", ") || "—"],
    ["Start date (prévisionnelle)", formatDate(c.plannedStartDate)],
    ["Start date (réelle)", formatDate(c.startDate)],
    ["Écart date de début", formatDateVariance(c.plannedStartDate, c.startDate)],
    ["End date (prévisionnelle)", formatDate(c.plannedEndDate)],
    ["End date (réelle)", formatDate(c.endDate)],
    ["Écart date de fin", formatDateVariance(c.plannedEndDate, c.endDate)],
    ["Budget", budget],
    ["Source file", project.meta.sourceFileName],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Project details</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Charter</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {facts.map(([label, value]) => {
              const isLate = label === "Écart date de début" && isStartDateLate(c.plannedStartDate, c.startDate);
              return (
                <div key={label} className="flex justify-between gap-4 border-b pb-1.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={`truncate text-right font-medium ${isLate ? "text-red-600" : ""}`}>{value}</dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-start gap-2 space-y-0">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <CardTitle className="leading-snug">Risques &amp; Problèmes</CardTitle>
              <p className="text-xs text-muted-foreground">Saisie manuelle (session en cours)</p>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea
              value={risksIssues}
              onChange={(e) => setRisksIssues(e.target.value)}
              placeholder="Décrivez les risques et problèmes en cours…"
              className="min-h-[140px]"
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-row items-start gap-2 space-y-0">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <CardTitle className="leading-snug">Décision ou Recommandation du PM</CardTitle>
              <p className="text-xs text-muted-foreground">Saisie manuelle (session en cours)</p>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea
              value={pmRecommendation}
              onChange={(e) => setPmRecommendation(e.target.value)}
              placeholder="Décision prise ou recommandation du chef de projet…"
              className="min-h-[140px]"
            />
          </CardContent>
        </Card>
      </div>

      {c.sections.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No narrative sections found on the charter card. Add blocks like
          “Objectif”, “Pourquoi nous le faisons” and “Critère de succès” to the card.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {c.sections.map((section) => (
            <Card key={section.title} className="flex flex-col">
              <CardHeader className="flex-row items-start gap-2 space-y-0">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <CardTitle className="leading-snug">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="whitespace-pre-line text-sm leading-relaxed">{section.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
