# Portfolio PPM

A lightweight **Project Portfolio Management & Governance** web application.
Project Managers complete a standardized Excel workbook per project; the app
imports one or more workbooks, validates them, consolidates everything **in
browser memory** and produces executive dashboards, health scores,
recommendations and downloadable reports.

> **No database. No backend. No storage.** Workbooks are parsed with SheetJS
> entirely in the browser; refreshing or closing the tab clears the session.
> Only the light/dark theme preference is kept in `localStorage`.

This is a governance and reporting layer — it complements, and does not
replace, delivery tools like Jira, Azure DevOps or Microsoft Project.

## Features

- **Standard workbook template** (downloadable in-app, plus a 3-project sample
  portfolio): Charter, Expected Outputs, Scope, Milestones, Resource Planning,
  Budget, Risks, Issues, Product Backlog, Time Tracking and optional Sprints.
- **Validation engine** — structural, field-level and cross-sheet checks with
  a full error/warning report before anything is imported.
- **Executive dashboard** — KPIs, project health (weighted RAG model),
  budget/variance/utilization charts, capacity heat map, milestone timeline,
  top risks & issues, and auto-generated executive recommendations.
- **Project workspace** — tabbed views of every sheet plus computed Overview,
  Sprint analytics (burndown, velocity) and phase-gate Governance checks.
- **Kanban board** — Jira-style 8-column board generated from the backlog,
  with session-only drag & drop.
- **Filters & global search** (Ctrl/Cmd-K) across every uploaded workbook.
- **Reports** — ten standard reports exportable to Excel (ExcelJS) and PDF
  (jsPDF), generated fully client-side.
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
portfolio* to parse three generated demo workbooks through the same
validation and import pipeline as real files.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture, data flow,
  folder structure, calculation & health models, wireframes.
- [`docs/EXCEL_TEMPLATE.md`](docs/EXCEL_TEMPLATE.md) — the standard workbook
  specification and validation rules.

The machine-readable schema behind the template, parser and validator lives
in [`src/lib/excel/schema.ts`](src/lib/excel/schema.ts).
