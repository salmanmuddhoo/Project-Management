# Standard Project Workbook — Template Specification

Every project is reported through one `.xlsx` workbook built from the standard
template (downloadable in-app under **Import → Download blank template**; a
pre-filled sample portfolio is also downloadable).

The workbook is deliberately small — **three sheets, minimal columns** — and
styled like a document so it is quick and pleasant for Project Managers to
complete:

- A **navy banner** titles each sheet.
- **Numbered section bands** break the page into readable blocks.
- **Blue cells = you fill in.** **Grey cells = calculated automatically** (they
  carry live Excel formulas and are ignored on import — the app recomputes
  them). A legend at the top of each sheet states this.

The machine-readable source of truth is
[`src/lib/excel/schema.ts`](../src/lib/excel/schema.ts) — the parser, the
validator and the template generator all consume the same definition.

Conventions: sheet names match exactly (case-insensitive); headers are matched
case-insensitively and tolerate the mandatory-marker asterisk; dates may be
native Excel dates or `YYYY-MM-DD` / `DD/MM/YYYY`; percentages may be Excel
fractions (`0.45`) or plain numbers (`45`). **Bold/`*`** = mandatory.

## Sheet 1 — `Project Brief` (the document)

A single stacked document containing:

**① Project Charter** (key/value): **Project Name**, **Project Code**,
Business Unit, **Project Manager**, Sponsor, Priority, Status, Current Phase,
Funding Type, **Budget**, **Start Date**, **Target End Date**, Actual Start
Date. Calculated (grey): Overall Progress, Overall Health, Forecast End Date.

**② Project Narrative**: Description, Business Need, Objectives, Benefits.

**③ Scope**: In Scope, Out of Scope, Assumptions, Constraints (one item per
line).

**④ Milestones**: Milestone*, Owner, Planned Date*, Actual Date, Status.

**⑤ Deliverables**: Deliverable*, Owner, Due Date, Completion %, Status,
Sign-off.

**⑥ Risks**: Risk*, Impact, Likelihood, Owner, Mitigation, Status.

**⑦ Issues**: Issue*, Severity, Owner, Target Date, Status.

## Sheet 2 — `Team & Budget`

**① Team**: Name*, Role, Allocation %, Planned Hours, Actual Hours, Hourly
Rate. Calculated (grey): Planned Cost `= Rate × Planned Hours`, Actual Cost
`= Rate × Actual Hours`, Utilization % `= Actual ÷ Planned`.

**② Budget**: Category*, Planned, Actual, Forecast. Calculated (grey):
Variance `= Planned − Forecast`.

## Sheet 3 — `Tasks`

A light task list — no sprints, story points or hours: Task*, Owner, Priority,
Due Date, Status. **Status** values (Backlog · Ready · To Do · In Progress ·
Blocked · Review · Done) drive the Kanban board directly.

## Validation summary

**Errors (block import):** missing `Project Brief` sheet; missing mandatory
charter fields (name, code, PM, budget, start/target dates); start after target
end; negative budget; no deliverables; duplicate Milestone/Deliverable/Task
names; invalid dates.

**Warnings (import allowed, flagged):** missing sponsor (surfaced by governance
& recommendations); allocation > 100 %; budget breakdown vs charter mismatch
> 10 %; missing recommended fields (business unit, priority, status, phase); no
milestones.
