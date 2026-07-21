# Portfolio PPM — Application Architecture

A lightweight, in-browser **Project Portfolio Management & Governance** tool.
It imports the exports teams already produce — **Microsoft Planner** board
plans and **Timorc** time-tracking files — consolidates them in memory, and
produces executive dashboards, progress, hours-consumed-vs-budget and risk.

**It is not a Planner/Jira replacement** — it is the governance & reporting
layer above them.

## 1. Core principles

| Principle | Consequence |
|---|---|
| **No database, no backend** | Static SPA. Files are parsed in the browser (SheetJS + a small CSV reader). Nothing is uploaded. |
| **No persistence of project data** | All state lives in an in-memory Zustand store. Refresh/close ⇒ gone. Only the theme preference is in `localStorage`. |
| **Consume real exports** | The app adapts to Microsoft Planner and Timorc file shapes rather than a bespoke template (see [IMPORT_FORMATS.md](IMPORT_FORMATS.md)). |
| **Everything derived is computed, never stored** | Progress, consumed hours, health and risk are pure functions of the parsed data. |

## 2. Technology

React 18 + TypeScript (strict) + Vite · TailwindCSS + shadcn-style components
(Radix + CVA) · **SheetJS** (`xlsx`) for Planner/xlsx reading · a small
Windows-1252 CSV reader for Timorc · **ExcelJS** for Excel report exports ·
**Recharts** for charts · **jsPDF** for PDF reports · **Zustand** (no persist)
· **@dnd-kit** for the Kanban.

## 3. Data flow

```
 Planner .xlsx ─▶ parsePlanner ─▶ Project (charter, resources, timorc codes,
                                            buckets, tasks)
 Timorc .csv  ─▶ parseTime    ─▶ TimeEntry[]  (daily man-days per person)
                                      │
        importFiles classifies each file and routes it here
                                      ▼
                          Zustand store (in-memory)
                          projects[] + timeEntries[]
                                      │
     entriesForProject()  matches time to a project by Timorc code
                                      ▼
   buildSnapshot ─▶ ProjectMetrics (hours consumed @7h/day vs budget,
                    progress, overdue…) + HealthScore (RAG + risk reasons)
                    + Governance
                                      ▼
     Dashboard · Projects · Kanban · Reports · Search  (all derived)
                                      │
                          ExcelJS / jsPDF exports (download only)
```

## 4. Folder structure

```
src/
├── types/            project.ts · time.ts · validation.ts · filters.ts
├── lib/
│   ├── config.ts     HOURS_PER_DAY (7) + risk thresholds
│   ├── import/
│   │   ├── parsePlanner.ts   Planner .xlsx → Project
│   │   ├── parseTime.ts      Timorc .csv/.xlsx → TimeEntry[]
│   │   ├── importFiles.ts    classify + time↔project matching
│   │   └── sampleData.ts     generate demo Planner boards + time CSV
│   ├── metrics/      projectMetrics · healthScore · governance ·
│   │                 portfolioMetrics · recommendations
│   └── export/       reportDefinitions · excelReports · pdfReports
├── store/            portfolioStore.ts (projects, time pool, filters, snapshots)
├── components/       ui/ · layout/ · charts/ · shared/
└── features/         upload · dashboard · projects · kanban · reports · search
```

## 5. Domain model

```ts
Project                          // one Planner plan
├── charter   { projectName, projectCode, planId, startDate, endDate,
│               budgetHours, manager, notes }
├── resources Resource[]         // role/name pairs
├── timorcCodes TimorcCode[]     // codes that match the time export
├── buckets   string[]           // swimlanes / Kanban columns
├── tasks     Task[]             // work cards (bucket, dates, priority, …)
└── meta

TimeEntry { projet, projectPrefix, person, code, task, date, days, … }
```

## 6. Calculation & risk

Per project: schedule (elapsed %, days remaining, overdue tasks); budget/time
(consumed man-days × 7 h → hours, vs the charter's hours budget → consumed %,
remaining, over-budget); delivery (task completion, blocked). Time by person
and by task code roll up from the matched entries.

**Health score** — three weighted dimensions: Schedule 35 %, Budget/time 35 %,
Delivery 30 % → 0–100 + RAG (Green ≥ 80, Amber ≥ 60, Red < 60). Alongside the
score, concrete **risk reasons** are surfaced (over budget, budget burning
ahead of delivery, behind schedule, past end date, overdue/blocked tasks).

**Governance** — a checklist over the board & time data (charter documented,
dates set, hours budget, manager, resources, Timorc code linked, tasks created,
time being logged, within budget, no overdue tasks) → a 0–100 score.

## 7. Privacy

No network calls with project data; no cookies or analytics; nothing stored. A
visible "in-memory only" indicator reminds users data disappears on refresh.
