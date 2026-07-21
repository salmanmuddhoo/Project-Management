/**
 * Sample portfolio — generated in the real export formats so the demo flows
 * through the exact same parsers as production files:
 *   • three Microsoft Planner board .xlsx files
 *   • one Timorc time-tracking .csv covering their codes
 *
 * Board sheets use the genuine French Planner headers (SheetJS handles the
 * unicode). The time CSV uses ASCII headers/content so the Windows-1252
 * decoder round-trips cleanly.
 */

import * as XLSX from "xlsx";

const DAY = 86_400_000;
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
const ddmmyy = (days: number) => {
  const d = new Date(Date.now() + days * DAY);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
};

const CONS_HEADER = [
  "ID de tâche", "Nom de tâche", "Catégorie", "But", "Statut", "Priorité",
  "Attribué à", "Créé par", "Date de création", "Date d’échéance", "Date de début",
  "Est périodique", "En retard", "Date de fin", "Exécuté par",
  "Éléments de la liste de contrôle effectués", "Éléments de la liste de contrôle",
  "Étiquettes", "Commentaires",
];

interface CardDef {
  id: string;
  title: string;
  bucket: string;
  statut?: string;
  priority?: string;
  assignee?: string;
  due?: string;
  start?: string;
  end?: string;
  overdue?: boolean;
  labels?: string;
  notes?: string;
}

function consRow(c: CardDef): (string | null)[] {
  return [
    c.id, c.title, c.bucket, "", c.statut ?? "Non démarrées", c.priority ?? "Moyen",
    c.assignee ?? "", "", iso(-40), c.due ?? "", c.start ?? "",
    "false", c.overdue ? "true" : "false", c.end ?? "", "",
    "", "", c.labels ?? "", c.notes ?? "",
  ];
}

interface BoardDef {
  file: string;
  planId: string;
  planName: string;
  buckets: string[];
  cards: CardDef[];
}

function buildBoardFile(def: BoardDef): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["ID du plan", "Nom du plan", "Date d'exportation"],
      [def.planId, def.planName, iso(0)],
    ]),
    "Plan",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["ID de compartiment", "Nom du compartiment"],
      ...def.buckets.map((b, i) => [`bucket-${i}`, b]),
    ]),
    "Catégories",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([CONS_HEADER, ...def.cards.map(consRow)]),
    "Données consolidées",
  );
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([out], def.file, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const BUCKETS = ["Project Details", "Backlog", "In progress", "Blocked", "Completed"];

const boards: BoardDef[] = [
  {
    file: "Sample-Board-Onboarding.xlsx",
    planId: "plan-onb",
    planName: "Digital Onboarding",
    buckets: BUCKETS,
    cards: [
      { id: "c1", title: "Project Charter", bucket: "Project Details", start: iso(-30), due: iso(30), labels: "80 hrs",
        notes: "What we do\nDeliver a fully digital customer onboarding journey.\nWhy\nCut onboarding from 9 days to under 24h and reduce abandonment.\nSuccess\nOnboarding < 24h and abandonment < 10% within the quarter." },
      { id: "c2", title: "Taches Timorc", bucket: "Project Details", notes: "DEMO1 - 100.001" },
      { id: "c3", title: "Resources", bucket: "Project Details", notes: "Project Manager\nSarah Naidoo\nDeveloper\nJohn Okafor\nTester\nMarie Lin" },
      { id: "t1", title: "Registration flow", bucket: "Completed", assignee: "John Okafor", priority: "Élevé", start: iso(-28), end: iso(-10), statut: "Terminées" },
      { id: "t2", title: "Document upload UI", bucket: "In progress", assignee: "John Okafor", priority: "Élevé", start: iso(-8), due: iso(4), statut: "En cours" },
      { id: "t3", title: "KYC integration", bucket: "In progress", assignee: "Sarah Naidoo", priority: "Urgent", start: iso(-6), due: iso(6), statut: "En cours" },
      { id: "t4", title: "Manual review fallback", bucket: "Blocked", assignee: "Sarah Naidoo", priority: "Élevé", due: iso(-2), overdue: true },
      { id: "t5", title: "Accessibility audit", bucket: "Backlog", assignee: "Marie Lin", priority: "Moyen", due: iso(18) },
      { id: "t6", title: "E2E test suite", bucket: "Backlog", assignee: "Marie Lin", priority: "Élevé", due: iso(12) },
    ],
  },
  {
    file: "Sample-Board-DataPlatform.xlsx",
    planId: "plan-data",
    planName: "Data Platform Migration",
    buckets: BUCKETS,
    cards: [
      { id: "c1", title: "Project Charter", bucket: "Project Details", start: iso(-60), due: iso(-5), labels: "120 hrs",
        notes: "What we do\nMigrate the on-premise warehouse to a cloud lakehouse.\nWhy\nCurrent platform is end-of-life within 12 months.\nSuccess\n100% of critical pipelines migrated with zero data loss." },
      { id: "c2", title: "Taches Timorc", bucket: "Project Details", notes: "DEMO2 - 200.010" },
      { id: "c3", title: "Resources", bucket: "Project Details", notes: "Project Manager\nMiguel Santos\nData Engineer\nElena Petrova\nBI Lead\nTom Becker" },
      { id: "t1", title: "Lakehouse foundation", bucket: "Completed", assignee: "Elena Petrova", start: iso(-58), end: iso(-40), statut: "Terminées" },
      { id: "t2", title: "Migrate finance pipelines", bucket: "In progress", assignee: "Elena Petrova", priority: "Urgent", due: iso(-3), overdue: true, statut: "En cours" },
      { id: "t3", title: "Rebuild exec dashboards", bucket: "In progress", assignee: "Tom Becker", priority: "Urgent", due: iso(-1), overdue: true, statut: "En cours" },
      { id: "t4", title: "Reconcile sales data", bucket: "Blocked", assignee: "Tom Becker", priority: "Élevé", due: iso(4) },
      { id: "t5", title: "Legacy decommission plan", bucket: "Backlog", assignee: "Miguel Santos", priority: "Moyen", due: iso(20) },
    ],
  },
  {
    file: "Sample-Board-Workplace.xlsx",
    planId: "plan-wp",
    planName: "Workplace Modernization",
    buckets: BUCKETS,
    cards: [
      { id: "c1", title: "Project Charter", bucket: "Project Details", start: iso(-10), due: iso(120), labels: "60 hrs",
        notes: "What we do\nModernize collaboration tooling and meeting rooms across HQ.\nWhy\nHybrid work exposes outdated meeting technology.\nSuccess\n90% weekly active usage after three months." },
      { id: "c2", title: "Taches Timorc", bucket: "Project Details", notes: "DEMO3 - 300.005" },
      { id: "c3", title: "Resources", bucket: "Project Details", notes: "Project Manager\nFatima Rashid\nEngineer\nDaniel Kim\nChange Manager\nGrace Mwangi" },
      { id: "t1", title: "Pilot floor AV install", bucket: "In progress", assignee: "Daniel Kim", priority: "Élevé", start: iso(-6), due: iso(15), statut: "En cours" },
      { id: "t2", title: "Wave 1 hardware order", bucket: "Completed", assignee: "Daniel Kim", start: iso(-8), end: iso(-2), statut: "Terminées" },
      { id: "t3", title: "Pilot user survey", bucket: "Backlog", assignee: "Grace Mwangi", priority: "Moyen", due: iso(22) },
      { id: "t4", title: "Champions network setup", bucket: "Backlog", assignee: "Grace Mwangi", priority: "Faible", due: iso(40) },
    ],
  },
];

// -- Time CSV (ASCII, semicolon-delimited) ----------------------------------

const TIME_HEADER = "Projet;Intervenant;Code tache;Tache;Sous-tache;Temps passe cumule;Prestation;Jour;Temps passe;Nb jours;Commentaire";

interface TimeSpec {
  projet: string;
  code: string;
  task: string;
  people: Array<{ name: string; total: number }>; // total man-days spread over days
}

const timeSpecs: TimeSpec[] = [
  // Onboarding: budget 80h => ~11.4 man-days@7. Log ~8 days => ~56h (~70%).
  { projet: "DEMO1 - Digital Onboarding", code: "DEMO1 - 100.001", task: "Onboarding build", people: [
    { name: "John Okafor", total: 4 }, { name: "Sarah Naidoo", total: 3 }, { name: "Marie Lin", total: 1 } ] },
  // Data Platform: budget 120h => ~17 days. Log ~20 days => ~140h (over budget).
  { projet: "DEMO2 - Data Platform Migration", code: "DEMO2 - 200.010", task: "Migration", people: [
    { name: "Elena Petrova", total: 12 }, { name: "Tom Becker", total: 8 } ] },
  // Workplace: budget 60h => ~8.6 days. Log ~2 days => ~14h (early).
  { projet: "DEMO3 - Workplace Modernization", code: "DEMO3 - 300.005", task: "Rollout", people: [
    { name: "Daniel Kim", total: 1.5 }, { name: "Grace Mwangi", total: 0.5 } ] },
];

function buildTimeCsv(): File {
  const lines = [TIME_HEADER];
  for (const spec of timeSpecs) {
    for (const person of spec.people) {
      // Spread the total over ~5 working days as 0.25-step daily rows.
      const perDay = Math.round((person.total / 5) * 4) / 4 || 0.25;
      let remaining = person.total;
      let dayOffset = -20;
      while (remaining > 0.01) {
        const spent = Math.min(perDay, remaining);
        lines.push(
          [spec.projet, person.name, spec.code, spec.task, "", "", "TSTM - Testing", ddmmyy(dayOffset), spent.toFixed(4), "20", ""].join(";"),
        );
        remaining -= spent;
        dayOffset += 2;
      }
    }
  }
  return new File([lines.join("\n")], "Sample-TimeTracking.csv", { type: "text/csv" });
}

export const SAMPLE_BOARDS = boards.map((b) => ({ name: b.planName, file: b.file }));

/** All sample files (3 boards + 1 time CSV) as importable File objects. */
export function buildSampleFiles(): File[] {
  return [...boards.map(buildBoardFile), buildTimeCsv()];
}

export function downloadSampleFile(index: number): void {
  const files = buildSampleFiles();
  const file = files[index];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
