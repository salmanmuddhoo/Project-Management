/**
 * Project Details — the charter facts plus its three standard sections:
 * "Ce que nous faisons", "Pourquoi nous le faisons",
 * "Comment savoir si c'est une réussite".
 */

import { HelpCircle, Lightbulb, Target } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { splitCharterSections, type CharterSection } from "@/lib/charterSections";
import { formatDate } from "@/lib/utils";
import { useActiveSnapshot } from "@/store/portfolioStore";

const SECTION_ICON: Record<CharterSection["key"], typeof Lightbulb> = {
  what: Lightbulb,
  why: HelpCircle,
  success: Target,
};

export function ProjectDetailsPage() {
  const snapshot = useActiveSnapshot();
  if (!snapshot) return <EmptyState />;
  const { project } = snapshot;
  const c = project.charter;
  const sections = splitCharterSections(c.notes);

  const facts: Array<[string, string]> = [
    ["Project", c.projectName],
    ["Code", c.projectCode || "—"],
    ["Project manager", c.manager || "—"],
    ["Timorc code(s)", project.timorcCodes.map((t) => t.code).join(", ") || "—"],
    ["Start date", formatDate(c.startDate)],
    ["End date", formatDate(c.endDate)],
    ["Hours budget", c.budgetHours != null ? `${Math.round(c.budgetHours)}h` : "—"],
    ["Source file", project.meta.sourceFileName],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Project details</h1>
        <p className="text-sm text-muted-foreground">The project charter, from the Planner board's “Project Charter” card.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Charter</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b pb-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = SECTION_ICON[section.key];
          return (
            <Card key={section.key} className="flex flex-col">
              <CardHeader className="flex-row items-start gap-2 space-y-0">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <CardTitle className="leading-snug">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {section.body ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed">{section.body}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not documented on the charter card.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
