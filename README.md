# Portfolio PPM

A lightweight **Project Portfolio Management & Governance** web application.
It imports the exports you already produce — **Microsoft Planner** board plans
and **Timorc** time-tracking files — matches time to each project, and produces
executive dashboards, progress, hours-consumed-vs-budget and risk, all **in
browser memory**.

> **No database. No backend. No storage.** Files are parsed entirely in the
> browser; refreshing or closing the tab clears the session. Only the
> light/dark theme preference is kept in `localStorage`.

This is a governance and reporting layer — it complements, and does not
replace, delivery tools like Microsoft Planner or Jira.

## Features

- **Imports real exports** (no bespoke template) — see
  [`docs/IMPORT_FORMATS.md`](docs/IMPORT_FORMATS.md):
  - **Microsoft Planner board (`.xlsx`)** — one plan = one project. Buckets are
    the swimlanes; the *Project Details* bucket's **Project Charter**,
    **Taches Timorc** and **Resources** cards define the project (dates, hours
    budget, Timorc code, team); every other bucket holds work tasks.
  - **Timorc time export (`.csv`/`.xlsx`)** — daily man-days per person, matched
    to a project by its Timorc code and converted at **7 h/day**.
- **Progress & risk** — hours consumed vs the charter's hours budget, task
  completion, and computed risk reasons (over budget, budget burning ahead of
  delivery, behind schedule, overdue/blocked tasks) → a RAG health score.
- **Executive dashboard** — KPIs, project health, hours budget-vs-consumed and
  remaining, progress, tasks-by-bucket, hours-by-person, and recommendations.
- **Project workspace** — Overview (charter, resources, Timorc link, health &
  risk, governance), Tasks (by bucket), and Time (consumed vs budget, by person,
  by task code, recent entries).
- **Kanban board** — generated from a plan's buckets, session-only drag & drop.
- **Filters & global search** (Ctrl/Cmd-K) across everything in memory.
- **Reports** — Executive, Status, Time & Budget, Task, Risk and Governance,
  exportable to Excel (ExcelJS) and PDF (jsPDF), fully client-side.
- Light/dark mode, responsive enterprise UI (TailwindCSS + shadcn-style
  components, Recharts).

## Getting started

```bash
npm install
npm run dev        # local dev server
npm run build      # production build (static files in dist/)
npm run typecheck  # strict TypeScript check
```

Deploy `dist/` to any static host — no server-side code is required.

**Evaluating without real data:** open **Import** and click *Load sample
portfolio* to generate three Planner boards and one Timorc CSV (in the real
export formats) and run them through the same pipeline as real files.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture, data flow,
  folder structure, calculation & health models, wireframes.
- [`docs/EXCEL_TEMPLATE.md`](docs/EXCEL_TEMPLATE.md) — the standard workbook
  specification and validation rules.

The machine-readable schema behind the template, parser and validator lives
in [`src/lib/excel/schema.ts`](src/lib/excel/schema.ts).
