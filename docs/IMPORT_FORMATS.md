# Import formats

The app consumes two real exports — no bespoke template. Everything is parsed
and matched in the browser; nothing is uploaded or stored.

## 1. Microsoft Planner board export (`.xlsx`) — one plan = one project

Export a plan from Microsoft Planner ("Export plan to Excel"). The app reads:

| Sheet | Used for |
|---|---|
| `Plan` | Plan id & name → project name |
| `Catégories` | Bucket id → name; bucket order = the swimlanes / Kanban columns |
| `Données consolidées` | Tasks with human-readable bucket & assignee (preferred); falls back to `Tâches` |

Headers are matched case-insensitively in French **or** English.

### The `Project Details` bucket → the Project Charter card

A single **Project Charter** card defines the project. Its **Start date** and
**Due date** are the project window; its **notes** hold everything else as
labeled blocks (each label on its own line, French or English, accent-tolerant):

- **Nom du Projet** — the project name.
- **Taches Timorc** — the Timorc code(s) that match the time export (e.g.
  `Mauritius9 - 100.003`).
- **Objectif** / **Pourquoi nous le faisons** / **Critère de succès** /
  **Livrable Clès** — narrative sections shown on the Project Details tab.
- **Resources** — the team, one `Role: Name` per line
  (e.g. `Project Manager: Salman Muddhoo`).
- **Budget** — cost and/or hours, e.g. `Cost: Rs 1,200,000` and `Hours: 50`.
  A project may be budgeted in hours only, cost only, or both.

Older exports with separate **Taches Timorc** and **Resources** cards, and an
hours label like `50 hrs`, are still supported as a fallback.

### Work tasks

Every card in any **other** bucket is a work task. The **bucket** is its status
/ Kanban column; start, due and end dates, priority, assignee, notes and the
overdue flag are read per card. A duration in the **label** (`3 days`, `2 hrs`)
is the task's **effort estimate** — used for effort-weighted progress and EVM.

## Earned Value Management (EVM)

Computed from the budget, progress and time logged, in whichever unit(s) the
budget provides:

- **% complete** = effort-weighted completion (by task estimates) when present,
  else task count.
- **Planned %** = time elapsed against the charter start→end window.
- **Actual Cost** = hours consumed (from Timorc); priced into cost via
  `rate = cost budget ÷ hours budget` when both are given.
- SPI (schedule) is always available; CPI/EAC/ETC/VAC per unit need Actual Cost
  in that unit. Cost-only budgets show SPI and value/variance but not CPI/EAC
  unless an hours budget provides a rate.

## 2. Timorc time-tracking export (`.csv` or `.xlsx`)

A per-person, per-day time log. CSV is semicolon-delimited, Windows-1252
encoded (French accents). Columns (French or English, tolerant):

`Projet ; Intervenant ; Code tâche ; Tâche ; Sous-tâche ; Temps passé cumulé … ;
Prestation ; Jour ; Temps passé ; Nb jours présence … ; Commentaire`

Only **daily rows** (with both `Jour` and `Temps passé`) are kept; the
cumulative summary rows are skipped so hours are never double-counted.
`Temps passé` is in **man-days** (`0.25` = ¼ day) and is converted to hours at
**7 h/day** (`src/lib/config.ts`).

## Matching time to a project

A time entry belongs to a project when its **Code tâche** starts with one of
the project's Timorc codes (an exact task or a finer sub-code). A code given as
a bare project prefix (e.g. `MAURITIUS9`) matches the whole Timorc project.

Consumed hours, remaining vs the budget, hours by person and by task code, and
the resulting **risk** (over budget, budget burning ahead of delivery, behind
schedule, overdue/blocked tasks) are all computed from this match.

## Trying it

**Import → Load sample portfolio** generates three Planner boards and one
Timorc CSV in these exact formats and runs them through the same pipeline.
