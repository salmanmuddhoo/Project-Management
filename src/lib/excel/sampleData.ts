/**
 * Sample portfolio — three generated demo workbooks used to evaluate the app
 * without real data. Dates are relative to "today" so schedule metrics,
 * delays and burndowns always look live.
 */

import { buildProjectWorkbook, downloadWorkbook, type WorkbookData } from "./template";

const DAY = 86_400_000;
/** days offset from today (negative = past). */
const d = (days: number) => new Date(Date.now() + days * DAY);

function backlogRow(
  id: string,
  epic: string,
  title: string,
  priority: string,
  points: number,
  est: number,
  remaining: number,
  actual: number,
  sprint: string,
  assignee: string,
  status: string,
  due: Date,
): Array<string | number | Date | null> {
  return [
    id, epic, "", "", title, "", priority, points, est, remaining, actual,
    sprint, assignee, status, "", d(-60), null, due, status === "Done" ? d(-5) : null, "", "",
  ];
}

const alpha: WorkbookData = {
  charter: {
    projectName: "Project Alpha — Digital Onboarding",
    projectCode: "ALP-001",
    businessUnit: "Retail Banking",
    projectManager: "Sarah Naidoo",
    sponsor: "David Chen",
    priority: "High",
    status: "At Risk",
    currentPhase: "Execution",
    description: "Replace the paper-based customer onboarding journey with a fully digital flow.",
    businessNeed: "Onboarding takes 9 days on average and drives 30% abandonment.",
    objectives: "Reduce onboarding time to under 24 hours; cut abandonment to 10%.",
    benefits: "Projected $1.2M annual revenue retention; improved NPS.",
    fundingType: "CAPEX",
    budget: 850_000,
    fundingAmount: 900_000,
    plannedStartDate: d(-120),
    plannedEndDate: d(40),
    actualStartDate: d(-115),
    forecastEndDate: d(62),
    currentProgressPct: 58,
    overallHealth: "Amber",
  },
  scope: {
    deliverables: "Digital onboarding portal\nKYC integration\nDocument upload service",
    outOfScope: "Legacy branch systems\nCorporate customer onboarding",
    successCriteria: "Onboarding < 24h\nAbandonment < 10%",
    dependencies: "KYC vendor API availability\nCore banking release 4.2",
    constraints: "Regulatory sign-off before go-live",
    assumptions: "Vendor sandbox available from sprint 2",
  },
  outputs: [
    ["OUT-1", "Onboarding portal MVP", "Customer-facing web portal", "Sarah Naidoo", "All KYC flows pass UAT", d(-30), d(-25), 100, "Accepted", "Yes"],
    ["OUT-2", "KYC integration", "Real-time identity verification", "Priya Sharma", "99% verification within 60s", d(-5), null, 70, "In Progress", "Pending"],
    ["OUT-3", "Document upload service", "Secure document capture", "James Okafor", "Encryption at rest verified", d(10), null, 45, "Delayed", "Pending"],
    ["OUT-4", "Ops runbook & training", "Support handover pack", "Lin Wei", "Support team signed off", d(35), null, 10, "Not Started", "Pending"],
  ],
  milestones: [
    ["M1 — Requirements signed off", "BRD approved by sponsor", d(-95), d(-92), "Sarah Naidoo", 100, "Completed"],
    ["M2 — MVP live in staging", "Portal deployed to staging", d(-35), d(-28), "Priya Sharma", 100, "Completed"],
    ["M3 — KYC vendor integrated", "End-to-end verification working", d(-10), null, "Priya Sharma", 65, "Delayed"],
    ["M4 — UAT complete", "Business sign-off", d(20), null, "Sarah Naidoo", 0, "Not Started"],
    ["M5 — Go-live", "Production release", d(40), null, "Sarah Naidoo", 0, "Not Started"],
  ],
  resources: [
    ["Sarah Naidoo", "Project Manager", "PMO", 60, 640, 600, 420, 180, 95, 57_000, 39_900],
    ["Priya Sharma", "Tech Lead", "Engineering", 100, 640, 700, 520, 180, 110, 77_000, 57_200],
    ["James Okafor", "Backend Developer", "Engineering", 100, 640, 620, 400, 220, 85, 52_700, 34_000],
    ["Lin Wei", "Business Analyst", "Retail Banking", 50, 320, 300, 260, 40, 75, 22_500, 19_500],
    ["John Smith", "Solutions Architect", "Architecture", 80, 480, 520, 380, 140, 120, 62_400, 45_600],
  ],
  budget: [
    ["Internal Labour", 320_000, 210_000, 335_000, null],
    ["Vendor & Licences", 280_000, 190_000, 310_000, null],
    ["Infrastructure", 120_000, 60_000, 115_000, null],
    ["Training & Change", 80_000, 15_000, 78_000, null],
    ["Contingency", 50_000, 0, 50_000, null],
  ],
  risks: [
    ["R-1", "KYC vendor API instability delays integration", "High", "High", "Daily vendor standup; fallback manual review flow", "Priya Sharma", "Open"],
    ["R-2", "Regulatory sign-off may slip past go-live window", "Medium", "High", "Early engagement with compliance", "Sarah Naidoo", "Mitigating"],
    ["R-3", "Key architect shared across three projects", "High", "Medium", "Backfill request raised with PMO", "Sarah Naidoo", "Open"],
  ],
  issues: [
    ["I-1", "Staging environment outage blocked testing for 4 days", "High", "James Okafor", d(-20), d(-10), "Resolved"],
    ["I-2", "Vendor sandbox rate limits break automated tests", "Critical", "Priya Sharma", d(-8), d(5), "Open"],
  ],
  backlog: [
    backlogRow("ALP-101", "Portal", "Customer registration flow", "High", 8, 40, 0, 44, "S3", "James Okafor", "Done", d(-40)),
    backlogRow("ALP-102", "Portal", "Document upload UI", "High", 5, 24, 4, 22, "S4", "James Okafor", "In Progress", d(2)),
    backlogRow("ALP-103", "KYC", "Vendor API client", "Critical", 13, 60, 20, 55, "S4", "Priya Sharma", "In Progress", d(5)),
    backlogRow("ALP-104", "KYC", "Manual review fallback", "High", 8, 32, 32, 0, "S5", "Priya Sharma", "Blocked", d(12)),
    backlogRow("ALP-105", "Portal", "Accessibility audit fixes", "Medium", 5, 20, 20, 0, "S5", "Lin Wei", "To Do", d(15)),
    backlogRow("ALP-106", "Security", "Pen-test remediation", "Critical", 8, 36, 30, 8, "S5", "James Okafor", "Ready", d(18)),
    backlogRow("ALP-107", "Ops", "Monitoring dashboards", "Medium", 3, 16, 16, 0, "S6", "Priya Sharma", "Backlog", d(25)),
    backlogRow("ALP-108", "Portal", "E2E test suite", "High", 8, 40, 10, 34, "S4", "Lin Wei", "Testing", d(4)),
    backlogRow("ALP-109", "KYC", "Sanctions screening integration", "High", 13, 56, 56, 0, "S6", "Priya Sharma", "Backlog", d(30)),
    backlogRow("ALP-110", "Ops", "Runbook documentation", "Low", 2, 12, 12, 0, "S6", "Lin Wei", "Backlog", d(32)),
  ],
  timeTracking: [
    ["Priya Sharma", d(-4), "ALP-103", 7.5, "Development", "Execution"],
    ["Priya Sharma", d(-3), "ALP-103", 8, "Development", "Execution"],
    ["James Okafor", d(-4), "ALP-102", 6, "Development", "Execution"],
    ["James Okafor", d(-3), "ALP-106", 4, "Security remediation", "Execution"],
    ["Lin Wei", d(-4), "ALP-108", 7, "Testing", "Execution"],
    ["Sarah Naidoo", d(-4), "", 3, "Steering committee prep", "Monitoring & Control"],
    ["John Smith", d(-3), "ALP-103", 5, "Design review", "Execution"],
  ],
  sprints: [
    ["S1", "Foundation & environments", d(-115), d(-101), 300, 280, 265, 62, 95],
    ["S2", "Registration flows", d(-100), d(-86), 300, 290, 270, 65, 93],
    ["S3", "Portal MVP", d(-85), d(-71), 320, 310, 300, 70, 97],
    ["S4", "KYC integration", d(-14), d(0), 320, 330, 190, 48, 58],
  ],
};

const beta: WorkbookData = {
  charter: {
    projectName: "Project Beta — Data Platform Migration",
    projectCode: "BET-002",
    businessUnit: "Group IT",
    projectManager: "Miguel Santos",
    sponsor: "Aisha Rahman",
    priority: "Critical",
    status: "Delayed",
    currentPhase: "Monitoring & Control",
    description: "Migrate the on-premise data warehouse to a cloud lakehouse.",
    businessNeed: "Current platform is end-of-life in 12 months.",
    objectives: "Migrate 100% of critical pipelines with zero data loss.",
    benefits: "$650K annual infrastructure saving; 4x faster reporting.",
    fundingType: "Mixed",
    budget: 1_400_000,
    fundingAmount: 1_400_000,
    plannedStartDate: d(-200),
    plannedEndDate: d(-10),
    actualStartDate: d(-195),
    forecastEndDate: d(35),
    currentProgressPct: 78,
    overallHealth: "Red",
  },
  scope: {
    deliverables: "Lakehouse platform\n120 migrated pipelines\nBI tool cutover",
    outOfScope: "Departmental shadow databases",
    successCriteria: "Zero data loss\nAll critical reports reconciled",
    dependencies: "Cloud landing zone (Project Gamma)",
    constraints: "Finance year-end freeze in December",
    assumptions: "Source system owners available for reconciliation",
  },
  outputs: [
    ["OUT-1", "Lakehouse foundation", "Core platform + governance", "Miguel Santos", "Security review passed", d(-120), d(-110), 100, "Accepted", "Yes"],
    ["OUT-2", "Critical pipeline migration", "Top 40 pipelines", "Elena Petrova", "Reconciliation < 0.01% variance", d(-40), null, 80, "In Progress", "Pending"],
    ["OUT-3", "BI cutover", "All exec dashboards on new platform", "Tom Becker", "Exec sign-off", d(-15), null, 55, "Delayed", "Pending"],
    ["OUT-4", "Legacy decommission plan", "Shutdown runbook", "Miguel Santos", "CAB approved", d(20), null, 20, "In Progress", "Pending"],
  ],
  milestones: [
    ["M1 — Platform foundation live", "", d(-130), d(-110), "Miguel Santos", 100, "Completed"],
    ["M2 — 50% pipelines migrated", "", d(-70), d(-55), "Elena Petrova", 100, "Completed"],
    ["M3 — 100% pipelines migrated", "", d(-20), null, "Elena Petrova", 82, "Delayed"],
    ["M4 — BI cutover complete", "", d(-12), null, "Tom Becker", 55, "Delayed"],
    ["M5 — Legacy decommissioned", "", d(30), null, "Miguel Santos", 5, "Not Started"],
  ],
  resources: [
    ["Miguel Santos", "Project Manager", "PMO", 80, 800, 780, 700, 80, 95, 74_100, 66_500],
    ["Elena Petrova", "Data Engineer Lead", "Group IT", 100, 800, 900, 820, 80, 105, 94_500, 86_100],
    ["Tom Becker", "BI Lead", "Group IT", 100, 800, 760, 640, 120, 90, 68_400, 57_600],
    ["John Smith", "Solutions Architect", "Architecture", 65, 520, 560, 470, 90, 120, 67_200, 56_400],
  ],
  budget: [
    ["Internal Labour", 540_000, 470_000, 590_000, null],
    ["Cloud Consumption", 380_000, 340_000, 460_000, null],
    ["Migration Tooling", 260_000, 250_000, 265_000, null],
    ["Contractors", 220_000, 200_000, 285_000, null],
  ],
  risks: [
    ["R-1", "Reconciliation failures on finance pipelines", "High", "High", "Dedicated reconciliation squad", "Elena Petrova", "Open"],
    ["R-2", "Cloud cost overrun vs business case", "High", "Medium", "Weekly FinOps review", "Miguel Santos", "Mitigating"],
  ],
  issues: [
    ["I-1", "Finance pipeline variance above threshold", "Critical", "Elena Petrova", d(-25), d(10), "Open"],
    ["I-2", "Contractor offboarding lost tribal knowledge", "High", "Miguel Santos", d(-40), d(-20), "Open"],
    ["I-3", "BI tool licence renewal delay", "Medium", "Tom Becker", d(-15), d(0), "In Progress"],
  ],
  backlog: [
    backlogRow("BET-201", "Pipelines", "Migrate GL reconciliation pipeline", "Critical", 13, 80, 24, 70, "S9", "Elena Petrova", "In Progress", d(-5)),
    backlogRow("BET-202", "Pipelines", "Migrate HR analytics pipeline", "Medium", 8, 40, 0, 38, "S8", "Elena Petrova", "Done", d(-30)),
    backlogRow("BET-203", "BI", "Rebuild exec finance dashboard", "Critical", 8, 48, 20, 30, "S9", "Tom Becker", "In Progress", d(-8)),
    backlogRow("BET-204", "BI", "Reconcile sales dashboards", "High", 5, 32, 32, 0, "S10", "Tom Becker", "Blocked", d(8)),
    backlogRow("BET-205", "Platform", "Cost guardrail alerts", "High", 3, 16, 6, 12, "S9", "Elena Petrova", "Review", d(2)),
    backlogRow("BET-206", "Decommission", "Legacy shutdown runbook", "Medium", 5, 24, 20, 4, "S10", "Miguel Santos", "To Do", d(20)),
    backlogRow("BET-207", "Pipelines", "Migrate risk reporting pipeline", "Critical", 13, 72, 72, 0, "S10", "Elena Petrova", "Ready", d(15)),
    backlogRow("BET-208", "Platform", "Data quality framework", "Medium", 8, 40, 0, 42, "S8", "Elena Petrova", "Done", d(-35)),
  ],
  timeTracking: [
    ["Elena Petrova", d(-4), "BET-201", 8, "Migration", "Execution"],
    ["Elena Petrova", d(-3), "BET-201", 8, "Migration", "Execution"],
    ["Tom Becker", d(-4), "BET-203", 7, "Dashboard rebuild", "Execution"],
    ["Tom Becker", d(-3), "BET-204", 2, "Blocked - licence", "Execution"],
    ["Miguel Santos", d(-3), "", 4, "Steering & reporting", "Monitoring & Control"],
    ["John Smith", d(-4), "BET-201", 6, "Architecture support", "Execution"],
  ],
  sprints: [
    ["S7", "Wave 3 pipelines", d(-70), d(-56), 360, 350, 330, 55, 94],
    ["S8", "Wave 4 pipelines", d(-55), d(-41), 360, 360, 345, 58, 96],
    ["S9", "Finance reconciliation", d(-14), d(0), 360, 380, 210, 40, 55],
  ],
};

const gamma: WorkbookData = {
  charter: {
    projectName: "Project Gamma — Workplace Modernization",
    projectCode: "GAM-003",
    businessUnit: "Corporate Services",
    projectManager: "Fatima Al-Rashid",
    sponsor: "", // intentionally missing — drives a governance recommendation
    priority: "Medium",
    status: "On Track",
    currentPhase: "Planning",
    description: "Modernize collaboration tooling and meeting-room technology across HQ.",
    businessNeed: "Hybrid work exposes outdated meeting and collaboration tooling.",
    objectives: "Roll out modern workplace stack to 1,800 staff.",
    benefits: "Estimated 6% productivity uplift; reduced travel spend.",
    fundingType: "OPEX",
    budget: 400_000,
    fundingAmount: 380_000,
    plannedStartDate: d(-30),
    plannedEndDate: d(150),
    actualStartDate: d(-25),
    forecastEndDate: null,
    currentProgressPct: 15,
    overallHealth: "Green",
  },
  scope: {
    deliverables: "Collaboration platform rollout\n40 modernized meeting rooms\nAdoption programme",
    outOfScope: "Regional offices (phase 2)",
    successCriteria: "90% weekly active usage after 3 months",
    dependencies: "Network upgrade completion",
    constraints: "Rollout outside quarter-end windows",
    assumptions: "Hardware lead times of 6 weeks hold",
  },
  outputs: [
    ["OUT-1", "Pilot floor rollout", "2 floors fully modernized", "Fatima Al-Rashid", "Pilot NPS > 40", d(20), null, 30, "In Progress", "Pending"],
    ["OUT-2", "Meeting room upgrade wave 1", "15 rooms", "Daniel Kim", "AV standard checklist passed", d(60), null, 0, "Not Started", "Pending"],
    ["OUT-3", "Adoption & training programme", "Champions network + training", "Grace Mwangi", "80% staff trained", d(100), null, 5, "Not Started", "Pending"],
  ],
  milestones: [
    ["M1 — Plan approved", "", d(-10), d(-8), "Fatima Al-Rashid", 100, "Completed"],
    ["M2 — Pilot complete", "", d(25), null, "Fatima Al-Rashid", 30, "In Progress"],
    ["M3 — Wave 1 rooms live", "", d(65), null, "Daniel Kim", 0, "Not Started"],
    ["M4 — Full rollout complete", "", d(140), null, "Fatima Al-Rashid", 0, "Not Started"],
  ],
  resources: [
    ["Fatima Al-Rashid", "Project Manager", "PMO", 50, 400, 380, 60, 320, 90, 34_200, 5_400],
    ["Daniel Kim", "Workplace Engineer", "Corporate Services", 145, 640, 720, 90, 630, 80, 57_600, 7_200],
    ["Grace Mwangi", "Change Manager", "HR", 40, 320, 300, 45, 255, 85, 25_500, 3_825],
  ],
  budget: [
    ["Hardware", 180_000, 20_000, 175_000, null],
    ["Licences", 120_000, 30_000, 120_000, null],
    ["Services & Install", 70_000, 5_000, 72_000, null],
    ["Adoption & Training", 30_000, 2_000, 30_000, null],
  ],
  risks: [
    ["R-1", "Hardware lead times slip past rollout windows", "Medium", "Medium", "Order wave 1 hardware early", "Daniel Kim", "Open"],
  ],
  issues: [
    ["I-1", "Network upgrade dependency slipping", "Medium", "Fatima Al-Rashid", d(-5), d(15), "Open"],
  ],
  backlog: [
    backlogRow("GAM-301", "Pilot", "Pilot floor AV install", "High", 8, 60, 40, 22, "S1", "Daniel Kim", "In Progress", d(15)),
    backlogRow("GAM-302", "Pilot", "Pilot user survey", "Medium", 2, 8, 8, 0, "S2", "Grace Mwangi", "To Do", d(22)),
    backlogRow("GAM-303", "Rollout", "Wave 1 hardware order", "High", 3, 12, 2, 10, "S1", "Daniel Kim", "Review", d(5)),
    backlogRow("GAM-304", "Adoption", "Champions network setup", "Medium", 5, 24, 24, 0, "S2", "Grace Mwangi", "Backlog", d(40)),
    backlogRow("GAM-305", "Rollout", "Room booking integration", "Low", 5, 20, 20, 0, "S3", "Daniel Kim", "Backlog", d(70)),
  ],
  timeTracking: [
    ["Daniel Kim", d(-2), "GAM-301", 8, "Installation", "Execution"],
    ["Fatima Al-Rashid", d(-2), "", 3, "Planning", "Planning"],
    ["Grace Mwangi", d(-2), "GAM-304", 2, "Change planning", "Planning"],
  ],
  sprints: [
    ["S1", "Pilot foundation", d(-14), d(0), 120, 110, 60, 18, 55],
  ],
};

export const SAMPLE_PROJECTS: Array<{ name: string; file: string; data: WorkbookData }> = [
  { name: "Project Alpha — Digital Onboarding", file: "Sample-Project-Alpha.xlsx", data: alpha },
  { name: "Project Beta — Data Platform Migration", file: "Sample-Project-Beta.xlsx", data: beta },
  { name: "Project Gamma — Workplace Modernization", file: "Sample-Project-Gamma.xlsx", data: gamma },
];

export async function downloadSampleWorkbook(index: number): Promise<void> {
  const sample = SAMPLE_PROJECTS[index];
  if (!sample) return;
  await downloadWorkbook(buildProjectWorkbook(sample.data), sample.file);
}

/** Builds the sample workbooks as Files so they can be imported directly. */
export async function buildSampleFiles(): Promise<File[]> {
  const files: File[] = [];
  for (const sample of SAMPLE_PROJECTS) {
    const buffer = await buildProjectWorkbook(sample.data).xlsx.writeBuffer();
    files.push(
      new File([buffer], sample.file, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  }
  return files;
}
