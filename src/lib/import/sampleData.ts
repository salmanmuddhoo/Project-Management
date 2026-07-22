/**
 * Sample project — generated in the real export formats so the demo flows
 * through the exact same parsers as production files:
 *   • a Microsoft Planner board .xlsx (single consolidated "Project Charter"
 *     card: name, Timorc code, objective/why/success, deliverable, resources
 *     and a budget in cost and/or hours; tasks carry effort estimates)
 *   • a Timorc time-tracking .csv covering the board's code
 *
 * Three boards demonstrate the adaptable budget/EVM: both cost+hours, hours
 * only, and cost only. Board sheets use French Planner headers (SheetJS
 * handles the unicode); the time CSV is ASCII so the Windows-1252 decoder
 * round-trips cleanly.
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
  /** Used as the task effort estimate ("3 days", "2 hrs"). */
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["ID du plan", "Nom du plan", "Date d'exportation"],
    [def.planId, def.planName, iso(0)],
  ]), "Plan");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["ID de compartiment", "Nom du compartiment"],
    ...def.buckets.map((b, i) => [`bucket-${i}`, b]),
  ]), "Catégories");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([CONS_HEADER, ...def.cards.map(consRow)]), "Données consolidées");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([out], def.file, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const BUCKETS = ["Project Details", "Backlog", "In progress", "Blocked", "Completed"];

/** Build the consolidated Project Charter card notes. */
function charterNotes(o: {
  name: string; timorc: string; objective: string; why: string; success: string;
  deliverable: string; resources: string[]; budget: string[];
}): string {
  return [
    "Nom du Projet", o.name,
    "Taches Timorc", o.timorc,
    "Objectif", o.objective,
    "Pourquoi nous le faisons", o.why,
    "Critère de succès", o.success,
    "Livrable Clès", o.deliverable,
    "Resources", ...o.resources,
    "Budget", ...o.budget,
  ].join("\n");
}

const boards: BoardDef[] = [
  {
    file: "Sample-Board-Onboarding.xlsx",
    planId: "plan-onb",
    planName: "Digital Onboarding",
    buckets: BUCKETS,
    cards: [
      { id: "c1", title: "Project Charter", bucket: "Project Details", start: iso(-30), due: iso(30),
        notes: charterNotes({
          name: "Digital Onboarding", timorc: "DEMO1 - 100.001",
          objective: "Deliver a fully digital customer onboarding journey.",
          why: "Cut onboarding from 9 days to under 24h and reduce abandonment.",
          success: "Onboarding < 24h and abandonment < 10% within the quarter.",
          deliverable: "Live onboarding portal",
          resources: ["Project Manager: Sarah Naidoo", "Developer: John Okafor", "Tester: Marie Lin"],
          budget: ["Cost: Rs 900,000", "Hours: 80"],
        }) },
      { id: "t1", title: "Registration flow", bucket: "Completed", assignee: "John Okafor", priority: "Élevé", labels: "3 days", start: iso(-28), end: iso(-10), statut: "Terminées" },
      { id: "t2", title: "Document upload UI", bucket: "In progress", assignee: "John Okafor", priority: "Élevé", labels: "2 days", start: iso(-8), due: iso(4), statut: "En cours" },
      { id: "t3", title: "KYC integration", bucket: "In progress", assignee: "Sarah Naidoo", priority: "Urgent", labels: "4 days", start: iso(-6), due: iso(6), statut: "En cours" },
      { id: "t4", title: "Manual review fallback", bucket: "Blocked", assignee: "Sarah Naidoo", priority: "Élevé", labels: "1 day", due: iso(-2), overdue: true },
      { id: "t5", title: "Accessibility audit", bucket: "Backlog", assignee: "Marie Lin", priority: "Moyen", labels: "2 days", due: iso(18) },
      { id: "t6", title: "E2E test suite", bucket: "Backlog", assignee: "Marie Lin", priority: "Élevé", labels: "3 days", due: iso(12) },
    ],
  },
  {
    file: "Sample-Board-DataPlatform.xlsx",
    planId: "plan-data",
    planName: "Data Platform Migration",
    buckets: BUCKETS,
    cards: [
      { id: "c1", title: "Project Charter", bucket: "Project Details", start: iso(-60), due: iso(-5),
        notes: charterNotes({
          name: "Data Platform Migration", timorc: "DEMO2 - 200.010",
          objective: "Migrate the on-premise warehouse to a cloud lakehouse.",
          why: "Current platform is end-of-life within 12 months.",
          success: "100% of critical pipelines migrated with zero data loss.",
          deliverable: "Cloud lakehouse in production",
          resources: ["Project Manager: Miguel Santos", "Data Engineer: Elena Petrova", "BI Lead: Tom Becker"],
          budget: ["Hours: 120"], // hours-only budget
        }) },
      { id: "t1", title: "Lakehouse foundation", bucket: "Completed", assignee: "Elena Petrova", labels: "5 days", start: iso(-58), end: iso(-40), statut: "Terminées" },
      { id: "t2", title: "Migrate finance pipelines", bucket: "In progress", assignee: "Elena Petrova", priority: "Urgent", labels: "8 days", due: iso(-3), overdue: true, statut: "En cours" },
      { id: "t3", title: "Rebuild exec dashboards", bucket: "In progress", assignee: "Tom Becker", priority: "Urgent", labels: "4 days", due: iso(-1), overdue: true, statut: "En cours" },
      { id: "t4", title: "Reconcile sales data", bucket: "Blocked", assignee: "Tom Becker", priority: "Élevé", labels: "3 days", due: iso(4) },
      { id: "t5", title: "Legacy decommission plan", bucket: "Backlog", assignee: "Miguel Santos", priority: "Moyen", labels: "2 days", due: iso(20) },
    ],
  },
  {
    file: "Sample-Board-Workplace.xlsx",
    planId: "plan-wp",
    planName: "Workplace Modernization",
    buckets: BUCKETS,
    cards: [
      { id: "c1", title: "Project Charter", bucket: "Project Details", start: iso(-10), due: iso(120),
        notes: charterNotes({
          name: "Workplace Modernization", timorc: "DEMO3 - 300.005",
          objective: "Modernize collaboration tooling and meeting rooms across HQ.",
          why: "Hybrid work exposes outdated meeting technology.",
          success: "90% weekly active usage after three months.",
          deliverable: "40 modernized meeting rooms",
          resources: ["Project Manager: Fatima Rashid", "Engineer: Daniel Kim", "Change Manager: Grace Mwangi"],
          budget: ["Cost: Rs 600,000"], // cost-only budget
        }) },
      { id: "t1", title: "Pilot floor AV install", bucket: "In progress", assignee: "Daniel Kim", priority: "Élevé", labels: "4 days", start: iso(-6), due: iso(15), statut: "En cours" },
      { id: "t2", title: "Wave 1 hardware order", bucket: "Completed", assignee: "Daniel Kim", labels: "1 day", start: iso(-8), end: iso(-2), statut: "Terminées" },
      { id: "t3", title: "Pilot user survey", bucket: "Backlog", assignee: "Grace Mwangi", priority: "Moyen", labels: "2 days", due: iso(22) },
      { id: "t4", title: "Champions network setup", bucket: "Backlog", assignee: "Grace Mwangi", priority: "Faible", labels: "3 days", due: iso(40) },
    ],
  },
];

// -- Time CSV (ASCII, semicolon-delimited) ----------------------------------

const TIME_HEADER = "Projet;Intervenant;Code tache;Tache;Sous-tache;Temps passe cumule;Prestation;Jour;Temps passe;Nb jours;Commentaire";

interface TimeSpec {
  projet: string;
  code: string;
  task: string;
  people: Array<{ name: string; total: number }>;
}

const timeSpecs: TimeSpec[] = [
  { projet: "DEMO1 - Digital Onboarding", code: "DEMO1 - 100.001", task: "Onboarding build", people: [
    { name: "Sarah Naidoo", total: 3 }, { name: "John Okafor", total: 4 }, { name: "Marie Lin", total: 1 } ] },
  { projet: "DEMO2 - Data Platform Migration", code: "DEMO2 - 200.010", task: "Migration", people: [
    { name: "Elena Petrova", total: 12 }, { name: "Tom Becker", total: 8 } ] },
  { projet: "DEMO3 - Workplace Modernization", code: "DEMO3 - 300.005", task: "Rollout", people: [
    { name: "Daniel Kim", total: 1.5 }, { name: "Grace Mwangi", total: 0.5 } ] },
];

function buildTimeCsv(): File {
  const lines = [TIME_HEADER];
  for (const spec of timeSpecs) {
    for (const person of spec.people) {
      const perDay = Math.round((person.total / 5) * 4) / 4 || 0.25;
      let remaining = person.total;
      let dayOffset = -20;
      while (remaining > 0.01) {
        const spent = Math.min(perDay, remaining);
        lines.push([spec.projet, person.name, spec.code, spec.task, "", "", "TSTM - Testing", ddmmyy(dayOffset), spent.toFixed(4), "20", ""].join(";"));
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
