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

### The `Project Details` bucket

Three specially-named cards in this bucket define the project (they are not
treated as work tasks):

- **Project Charter** — the card's **Start date** and **Due date** are the
  project window; a label like **`50 hrs`** is the hours budget; the **notes**
  hold the full charter (what / why / success criteria).
- **Taches Timorc** — the **notes** hold the Timorc code(s), one per line
  (e.g. `MAURITIUS9 - 100.003`). These match the time export.
- **Resources** — the **notes** list the team as role/name pairs, two lines
  each (e.g. `Project Manager` / `Salman Muddhoo`).

### Work tasks

Every card in any **other** bucket is a work task. The **bucket** is its status
/ Kanban column; start, due and end dates, priority, assignee, labels, notes
and the overdue flag are read per card.

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
