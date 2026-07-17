/**
 * Sample portfolio — three generated demo workbooks used to evaluate the app
 * without real data. Dates are relative to "today" so schedule metrics,
 * delays and forecasts always look live.
 */

import { buildProjectWorkbook, downloadWorkbook, type WorkbookData } from "./template";

const DAY = 86_400_000;
const d = (days: number) => new Date(Date.now() + days * DAY);

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
    fundingType: "CAPEX",
    budget: 850_000,
    plannedStartDate: d(-120),
    plannedEndDate: d(40),
    actualStartDate: d(-115),
    description: "Replace the paper-based customer onboarding journey with a fully digital flow.",
    businessNeed: "Onboarding takes 9 days on average and drives 30% abandonment.",
    objectives: "Reduce onboarding time to under 24 hours; cut abandonment to 10%.",
    benefits: "Projected $1.2M annual revenue retention; improved NPS.",
  },
  scope: {
    inScope: "Digital onboarding portal\nKYC integration\nDocument upload service",
    outOfScope: "Legacy branch systems\nCorporate customer onboarding",
    assumptions: "Vendor sandbox available from month 2",
    constraints: "Regulatory sign-off required before go-live",
  },
  milestones: [
    ["Requirements signed off", "Sarah Naidoo", d(-95), d(-92), "Completed"],
    ["MVP live in staging", "Priya Sharma", d(-35), d(-28), "Completed"],
    ["KYC vendor integrated", "Priya Sharma", d(-10), null, "Delayed"],
    ["UAT complete", "Sarah Naidoo", d(20), null, "Not Started"],
    ["Go-live", "Sarah Naidoo", d(40), null, "Not Started"],
  ],
  deliverables: [
    ["Onboarding portal MVP", "Sarah Naidoo", d(-25), 100, "Completed", "Yes"],
    ["KYC integration", "Priya Sharma", d(-5), 70, "In Progress", "Pending"],
    ["Document upload service", "James Okafor", d(10), 45, "Delayed", "Pending"],
    ["Ops runbook & training", "Lin Wei", d(35), 10, "Not Started", "Pending"],
  ],
  risks: [
    ["KYC vendor API instability delays integration", "High", "High", "Priya Sharma", "Daily vendor standup; manual fallback", "Open"],
    ["Regulatory sign-off may slip past go-live", "High", "Medium", "Sarah Naidoo", "Early compliance engagement", "Mitigating"],
    ["Architect shared across three projects", "Medium", "High", "Sarah Naidoo", "Backfill requested from PMO", "Open"],
  ],
  issues: [
    ["Vendor sandbox rate limits break automated tests", "Critical", "Priya Sharma", d(5), "Open"],
    ["Staging outage blocked testing for 4 days", "High", "James Okafor", d(-10), "Resolved"],
  ],
  team: [
    ["Sarah Naidoo", "Project Manager", 60, 600, 420, 95],
    ["Priya Sharma", "Tech Lead", 100, 700, 520, 110],
    ["James Okafor", "Backend Developer", 100, 620, 400, 85],
    ["Lin Wei", "Business Analyst", 50, 300, 260, 75],
    ["John Smith", "Solutions Architect", 80, 520, 380, 120],
  ],
  budget: [
    ["Internal Labour", 320_000, 210_000, 335_000],
    ["Vendor & Licences", 280_000, 190_000, 310_000],
    ["Infrastructure", 120_000, 60_000, 115_000],
    ["Training & Change", 80_000, 15_000, 78_000],
    ["Contingency", 50_000, 0, 50_000],
  ],
  tasks: [
    ["Customer registration flow", "James Okafor", "High", d(-40), "Done"],
    ["Document upload UI", "James Okafor", "High", d(2), "In Progress"],
    ["Vendor API client", "Priya Sharma", "Critical", d(5), "In Progress"],
    ["Manual review fallback", "Priya Sharma", "High", d(12), "Blocked"],
    ["Accessibility audit fixes", "Lin Wei", "Medium", d(15), "To Do"],
    ["Pen-test remediation", "James Okafor", "Critical", d(18), "Ready"],
    ["Monitoring dashboards", "Priya Sharma", "Medium", d(25), "Backlog"],
    ["E2E test suite", "Lin Wei", "High", d(4), "Review"],
    ["Sanctions screening integration", "Priya Sharma", "High", d(30), "Backlog"],
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
    fundingType: "Mixed",
    budget: 1_400_000,
    plannedStartDate: d(-200),
    plannedEndDate: d(-10),
    actualStartDate: d(-195),
    description: "Migrate the on-premise data warehouse to a cloud lakehouse.",
    businessNeed: "Current platform is end-of-life in 12 months.",
    objectives: "Migrate 100% of critical pipelines with zero data loss.",
    benefits: "$650K annual infrastructure saving; 4x faster reporting.",
  },
  scope: {
    inScope: "Lakehouse platform\n120 migrated pipelines\nBI tool cutover",
    outOfScope: "Departmental shadow databases",
    assumptions: "Source system owners available for reconciliation",
    constraints: "Finance year-end freeze in December",
  },
  milestones: [
    ["Platform foundation live", "Miguel Santos", d(-130), d(-110), "Completed"],
    ["50% pipelines migrated", "Elena Petrova", d(-70), d(-55), "Completed"],
    ["100% pipelines migrated", "Elena Petrova", d(-20), null, "Delayed"],
    ["BI cutover complete", "Tom Becker", d(-12), null, "Delayed"],
    ["Legacy decommissioned", "Miguel Santos", d(30), null, "Not Started"],
  ],
  deliverables: [
    ["Lakehouse foundation", "Miguel Santos", d(-110), 100, "Completed", "Yes"],
    ["Critical pipeline migration", "Elena Petrova", d(-40), 80, "In Progress", "Pending"],
    ["BI cutover", "Tom Becker", d(-15), 55, "Delayed", "Pending"],
    ["Legacy decommission plan", "Miguel Santos", d(20), 20, "In Progress", "Pending"],
  ],
  risks: [
    ["Reconciliation failures on finance pipelines", "High", "High", "Elena Petrova", "Dedicated reconciliation squad", "Open"],
    ["Cloud cost overrun vs business case", "Medium", "High", "Miguel Santos", "Weekly FinOps review", "Mitigating"],
  ],
  issues: [
    ["Finance pipeline variance above threshold", "Critical", "Elena Petrova", d(10), "Open"],
    ["Contractor offboarding lost tribal knowledge", "High", "Miguel Santos", d(-20), "Open"],
    ["BI tool licence renewal delay", "Medium", "Tom Becker", d(0), "In Progress"],
  ],
  team: [
    ["Miguel Santos", "Project Manager", 80, 780, 700, 95],
    ["Elena Petrova", "Data Engineer Lead", 100, 900, 820, 105],
    ["Tom Becker", "BI Lead", 100, 760, 640, 90],
    ["John Smith", "Solutions Architect", 65, 560, 470, 120],
  ],
  budget: [
    ["Internal Labour", 540_000, 470_000, 590_000],
    ["Cloud Consumption", 380_000, 340_000, 460_000],
    ["Migration Tooling", 260_000, 250_000, 265_000],
    ["Contractors", 220_000, 200_000, 285_000],
  ],
  tasks: [
    ["Migrate GL reconciliation pipeline", "Elena Petrova", "Critical", d(-5), "In Progress"],
    ["Migrate HR analytics pipeline", "Elena Petrova", "Medium", d(-30), "Done"],
    ["Rebuild exec finance dashboard", "Tom Becker", "Critical", d(-8), "In Progress"],
    ["Reconcile sales dashboards", "Tom Becker", "High", d(8), "Blocked"],
    ["Cost guardrail alerts", "Elena Petrova", "High", d(2), "Review"],
    ["Legacy shutdown runbook", "Miguel Santos", "Medium", d(20), "To Do"],
    ["Migrate risk reporting pipeline", "Elena Petrova", "Critical", d(15), "Ready"],
    ["Data quality framework", "Elena Petrova", "Medium", d(-35), "Done"],
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
    fundingType: "OPEX",
    budget: 400_000,
    plannedStartDate: d(-30),
    plannedEndDate: d(150),
    actualStartDate: d(-25),
    description: "Modernize collaboration tooling and meeting-room technology across HQ.",
    businessNeed: "Hybrid work exposes outdated meeting and collaboration tooling.",
    objectives: "Roll out modern workplace stack to 1,800 staff.",
    benefits: "Estimated 6% productivity uplift; reduced travel spend.",
  },
  scope: {
    inScope: "Collaboration platform rollout\n40 modernized meeting rooms\nAdoption programme",
    outOfScope: "Regional offices (phase 2)",
    assumptions: "Hardware lead times of 6 weeks hold",
    constraints: "Rollout outside quarter-end windows",
  },
  milestones: [
    ["Plan approved", "Fatima Al-Rashid", d(-10), d(-8), "Completed"],
    ["Pilot complete", "Fatima Al-Rashid", d(25), null, "In Progress"],
    ["Wave 1 rooms live", "Daniel Kim", d(65), null, "Not Started"],
    ["Full rollout complete", "Fatima Al-Rashid", d(140), null, "Not Started"],
  ],
  deliverables: [
    ["Pilot floor rollout", "Fatima Al-Rashid", d(20), 30, "In Progress", "Pending"],
    ["Meeting room upgrade wave 1", "Daniel Kim", d(60), 0, "Not Started", "Pending"],
    ["Adoption & training programme", "Grace Mwangi", d(100), 5, "Not Started", "Pending"],
  ],
  risks: [
    ["Hardware lead times slip past rollout windows", "Medium", "Medium", "Daniel Kim", "Order wave 1 hardware early", "Open"],
  ],
  issues: [
    ["Network upgrade dependency slipping", "Medium", "Fatima Al-Rashid", d(15), "Open"],
  ],
  team: [
    ["Fatima Al-Rashid", "Project Manager", 50, 380, 60, 90],
    ["Daniel Kim", "Workplace Engineer", 145, 720, 90, 80],
    ["Grace Mwangi", "Change Manager", 40, 300, 45, 85],
  ],
  budget: [
    ["Hardware", 180_000, 20_000, 175_000],
    ["Licences", 120_000, 30_000, 120_000],
    ["Services & Install", 70_000, 5_000, 72_000],
    ["Adoption & Training", 30_000, 2_000, 30_000],
  ],
  tasks: [
    ["Pilot floor AV install", "Daniel Kim", "High", d(15), "In Progress"],
    ["Pilot user survey", "Grace Mwangi", "Medium", d(22), "To Do"],
    ["Wave 1 hardware order", "Daniel Kim", "High", d(5), "Review"],
    ["Champions network setup", "Grace Mwangi", "Medium", d(40), "Backlog"],
    ["Room booking integration", "Daniel Kim", "Low", d(70), "Backlog"],
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
