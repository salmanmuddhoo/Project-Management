# Portfolio PPM — Application Architecture

A lightweight, in-browser **Project Portfolio Management & Governance** tool.
Project Managers fill in a standardized Excel workbook; executives upload one or
more workbooks and get validated, consolidated dashboards, health scores,
recommendations and downloadable reports.

**It is not a Jira/Azure DevOps/MS Project replacement** — it is the governance
layer that sits above delivery tools and standardizes reporting.

---

## 1. Core principles

| Principle | Consequence |
|---|---|
| **No database, no backend** | The app is a static SPA. Workbooks are parsed with SheetJS entirely in the browser. Nothing is uploaded anywhere. |
| **No persistence of project data** | All portfolio state lives in an in-memory Zustand store. Refresh/close ⇒ data gone. Only the light/dark theme preference is kept in `localStorage`. |
| **Single source of truth = the workbook** | The app never edits project data. Derived values (health, variances, utilization) are computed, never stored. |
| **Validate before trust** | Every workbook passes a validation engine before it enters the portfolio. Errors block import; warnings are surfaced but importable. |
| **Standard framework** | One lifecycle (Initiation → Planning → Execution → Monitoring & Control → Closure), one template, one health model for every project. |
| **Minimal by design** | A three-sheet, document-style workbook (Project Brief · Team & Budget · Tasks) with only the columns a PM must type. Everything else is calculated. No sprints, no time logs. |

## 2. Technology decisions

- **React 18 + TypeScript (strict) + Vite** — fast static SPA build.
- **TailwindCSS + shadcn/ui-style components** (Radix primitives + CVA) — enterprise UI, light/dark mode.
- **SheetJS (`xlsx`)** — *reading* uploaded workbooks (fastest, most tolerant parser).
- **ExcelJS** — *writing* the styled blank template, the sample workbook and Excel report exports (rich styling support).
- **Recharts** — all charts. One charting library keeps visuals consistent and the bundle lean; Chart.js would duplicate capability, so it is intentionally not bundled.
- **jsPDF + autotable** — PDF report generation, fully client-side.
- **Zustand** — minimal in-memory store; no persistence middleware by design.
- **@dnd-kit** — Kanban drag & drop (session-only, no persistence).

## 3. Data flow

```
 ┌────────────┐   FileReader    ┌──────────────┐   validate    ┌──────────────────┐
 │ .xlsx file ├────────────────▶│ SheetJS read ├──────────────▶│ Validation Engine │
 └────────────┘  (ArrayBuffer)  │  raw sheets  │               │ errors / warnings │
                                └──────────────┘               └────────┬─────────┘
                                                              blocked ◀─┤ errors?
                                                                        ▼ ok
                                                               ┌────────────────┐
                                                               │ Typed parsing  │
                                                               │ Project object │
                                                               └───────┬────────┘
                                                                       ▼
                       selectors (computed, memoized)          ┌────────────────┐
 Dashboards ◀── Portfolio metrics ◀── Project metrics ◀────────│ Zustand store  │
 Kanban     ◀── Health scores     ◀── Governance checks        │  (in-memory)   │
 Reports    ◀── Recommendations                                └────────────────┘
                       │
                       ▼
              ExcelJS / jsPDF exports (download only — nothing stored)
```

Key rule: **raw parsed data is stored; everything else is derived** via pure
functions in `src/lib/metrics`. This keeps calculations testable and guarantees
consistency between dashboard, project pages and exported reports.

## 4. Folder structure

```
src/
├── main.tsx / App.tsx          # entry, router, theme, app shell
├── index.css                   # Tailwind + design tokens (light/dark)
├── types/                      # All TypeScript domain interfaces
│   ├── project.ts              #   Charter, Output, Milestone, Resource, …
│   ├── validation.ts           #   ValidationIssue / report types
│   └── filters.ts              #   Portfolio filter state
├── lib/
│   ├── utils.ts                # cn(), formatters (money, %, dates)
│   ├── excel/
│   │   ├── schema.ts           # ★ single source of truth: sheet + column defs
│   │   ├── parseWorkbook.ts    # SheetJS → typed Project (+ validation hooks)
│   │   ├── template.ts         # ExcelJS: styled document-style template
│   │   └── sampleData.ts       # ExcelJS: 3 demo workbooks for evaluation
│   ├── validation/
│   │   └── validateWorkbook.ts # rule engine (structure, fields, cross-checks)
│   ├── metrics/
│   │   ├── projectMetrics.ts   # schedule/budget/resource/task calculations
│   │   ├── healthScore.ts      # weighted RAG health model
│   │   ├── governance.ts       # phase-gate governance checks
│   │   ├── portfolioMetrics.ts # cross-project aggregation
│   │   └── recommendations.ts  # executive recommendation rules
│   └── export/
│       ├── excelReports.ts     # ExcelJS report workbooks
│       └── pdfReports.ts       # jsPDF report documents
├── store/
│   └── portfolioStore.ts       # Zustand: projects[], filters, import/remove
├── components/
│   ├── ui/                     # shadcn-style primitives (button, card, …)
│   ├── layout/                 # AppShell, Sidebar, Topbar, ThemeToggle
│   ├── charts/                 # ChartCard, palette, shared chart pieces
│   └── shared/                 # StatusBadge, HealthBadge, EmptyState, …
└── features/
    ├── upload/                 # dropzone, validation report, import flow
    ├── dashboard/              # executive portfolio dashboard + filters
    ├── projects/               # project list + detail (tabbed workbook views)
    ├── kanban/                 # Jira-style board from the Tasks sheet
    ├── reports/                # report centre (Excel / PDF downloads)
    └── search/                 # global search (Cmd/Ctrl-K)
```

`lib/excel/schema.ts` is deliberately the **single definition** of sheet names,
column headers and mandatory flags — the parser, the validator, the template
generator and the docs all read from it, so the template can never drift from
the import logic.

## 5. Domain model (summary)

The workbook maps to three sheets; the domain object mirrors them:

```ts
Project
├── charter: ProjectCharter          // Brief › charter (manager facts only)
├── scope: ScopeDefinition           // Brief › in/out/assumptions/constraints
├── milestones: Milestone[]          // Brief › milestones
├── deliverables: Deliverable[]      // Brief › deliverables + sign-off
├── risks: Risk[]                    // Brief › impact × likelihood
├── issues: Issue[]                  // Brief › issues
├── team: TeamMember[]               // Team & Budget › team (costs derived)
├── budget: BudgetLine[]             // Team & Budget › category planned/actual/forecast
├── tasks: Task[]                    // Tasks › light list → Kanban
└── meta: sourceFileName, importedAt, validation summary
```

Everything else — `ProjectMetrics`, `HealthScore`, `GovernanceResult`,
`PortfolioMetrics`, `Recommendation[]`, and the auto Excel columns (costs,
utilization, variance, progress, health) — is computed on demand from the
above. Task progress is count-based (Done ÷ total); there are no story points,
sprints or time logs.

## 6. Calculation engine

Per project (all pure functions):

- **Schedule:** duration, elapsed %, days remaining, days delayed, forecast finish (linear progress extrapolation from delivery signals).
- **Budget:** planned/actual/forecast totals, consumed %, variance %, category variances.
- **Team:** utilization % (actual vs planned hours), remaining hours, over-allocation (>100 % allocation), cost variance (rate × hours).
- **Delivery:** task completion % (count of Done ÷ total), milestone completion %, deliverable completion %, delayed counts.
- **Overall progress:** average of the computed delivery signals (no manager-entered progress — it is a calculated figure).

**Health score** — weighted model returning 0-100 + RAG:

| Dimension | Weight | Signal |
|---|---|---|
| Schedule | 25 % | delay vs plan, forecast slip |
| Budget | 20 % | variance & burn vs progress |
| Team | 15 % | over-allocation share |
| Milestones | 10 % | overdue / completion |
| Tasks | 10 % | done vs elapsed time |
| Deliverables | 10 % | complete / delayed |
| Risks | 5 % | open high-impact × high-likelihood |
| Issues | 5 % | open critical/high severity |

RAG: **Green ≥ 80**, **Amber 60–79**, **Red < 60**.

**Governance** — per lifecycle phase, checks the artifacts the framework
requires (sponsor & charter completeness at Initiation; scope, milestones,
team & budget plans, deliverables at Planning; task list, actual hours, status
at Execution; risk/issue logs, actual costs at M&C; deliverable completion &
sign-off at Closure). Produces a governance score used in the Governance Report
and recommendations.

## 7. Validation engine

Ordered rule groups; each rule yields `error` (blocks import) or `warning`:

1. **Structure** — the `Project Brief` sheet and each table's columns present.
2. **Charter** — mandatory fields (name, code, PM, dates, budget), valid dates, start ≤ end, non-negative budget; missing sponsor → warning.
3. **Row-level** — duplicate Milestone/Deliverable/Task names, invalid dates, negative budget lines, allocation > 100 %, at least one deliverable.
4. **Cross-sheet** — budget breakdown total vs charter budget consistency.

The UI shows a full validation report per file (grouped, with sheet/row/column
coordinates) **before** anything enters the portfolio.

## 8. UI design (wireframes)

Enterprise shell: fixed icon+label sidebar, topbar with global search,
theme toggle and session badge ("N projects in memory — nothing stored").

```
┌───────────┬──────────────────────────────────────────────────────────┐
│  ◧ PPM    │  ⌕ Search (Ctrl-K)        [Import ⭱]  [☾]  ● 3 projects │
│           ├──────────────────────────────────────────────────────────┤
│ Dashboard │  Filters: [Project ▾][BU ▾][PM ▾][Status ▾][Priority ▾]… │
│ Projects  │  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐  KPI tiles        │
│ Kanban    │  └────┘└────┘└────┘└────┘└────┘└────┘                   │
│ Reports   │  ┌───────────────┐ ┌───────────────┐ ┌────────────────┐ │
│ Import    │  │ Status donut  │ │ Budget by prj │ │ Health list    │ │
│           │  └───────────────┘ └───────────────┘ └────────────────┘ │
│           │  ┌───────────────────────────┐ ┌──────────────────────┐ │
│ ─────     │  │ Milestone timeline        │ │ Capacity heat map    │ │
│ ⓘ In-mem  │  └───────────────────────────┘ └──────────────────────┘ │
│  only     │  ▸ Recommendations (auto-generated, severity-ranked)    │
└───────────┴──────────────────────────────────────────────────────────┘
```

Project detail = six tabs (Overview, Delivery, Risks & Issues, Team & Budget,
Tasks, Governance). Kanban = 7 status columns, draggable cards, project
selector.

## 9. Privacy & security posture

- No network calls with project data — parsing, calculation, and export are all local.
- No cookies, no analytics, no storage of workbook content.
- A visible "in-memory only" indicator reminds users data disappears on refresh.
