# Standard Project Workbook — Template Specification

Every project is reported through one `.xlsx` workbook built from the standard
template (downloadable in-app under **Import → Download template**; a
pre-filled sample portfolio is also downloadable for evaluation).

The machine-readable source of truth for this spec is
[`src/lib/excel/schema.ts`](../src/lib/excel/schema.ts) — the parser, the
validation engine and the template generator all consume the same definition.

Conventions:

- Sheet names must match exactly (case-insensitive, trimmed).
- Row 1 of every tabular sheet is the header row; headers are matched
  case-insensitively and tolerant of extra spaces.
- Dates may be native Excel dates or `YYYY-MM-DD` / `DD/MM/YYYY` text.
- Percentages may be `0–1` Excel percentages or `0–100` numbers.
- **Bold** = mandatory (validation error if missing). Others raise warnings
  or are optional.

## 1. `Project Charter` (key/value layout: Field | Value)

**Project Name**, **Project Code**, Business Unit, **Project Manager**,
Sponsor (missing ⇒ warning + governance flag), Priority (Critical/High/Medium/Low), Status (Not Started/On
Track/At Risk/Delayed/On Hold/Completed/Cancelled), Current Phase (Initiation/
Planning/Execution/Monitoring & Control/Closure), Description, Business Need,
Objectives, Benefits, Funding Type (CAPEX/OPEX/Mixed), **Budget**, Funding
Amount, **Planned Start Date**, **Planned End Date**, Actual Start Date,
Forecast End Date, Current Progress %, Overall Health (Green/Amber/Red).

## 2. `Expected Outputs`

Output ID*, Deliverable*, Description, Owner, Acceptance Criteria, Planned
Delivery Date, Actual Delivery Date, Completion %, Status (Not Started/In
Progress/Delayed/Completed/Accepted), Customer Approval (Yes/No/Pending).
*Duplicate Output IDs → error; missing deliverable name → error.*

## 3. `Scope` (key/multi-line value layout)

Deliverables, Out of Scope, Success Criteria, Dependencies, Constraints,
Assumptions — one item per line within the cell, or repeated rows per key.

## 4. `Milestones`

Milestone*, Description, Planned Date*, Actual Date, Owner, Progress %,
Status (Not Started/In Progress/Delayed/Completed).
*Duplicate milestone names → error; invalid dates → error.*

## 5. `Resource Planning`

Employee*, Role, Department, Allocation %, Available Hours, Planned Hours,
Actual Hours, Remaining Hours, Hourly Rate, Planned Cost, Actual Cost.
Derived automatically (never typed): utilization, capacity, over-allocation
(> 100 % or planned > available), cost variance. Costs are back-filled from
rate × hours when the cost columns are left blank.

## 6. `Budget`

Category*, Planned, Actual, Forecast, Variance (auto = Planned − Forecast,
recomputed on import). Negative planned amounts → error. A gap of more than
10 % between the budget sheet total and the charter budget → warning.

## 7. `Risks`

Risk ID*, Description*, Probability (High/Medium/Low or 1–5), Impact
(High/Medium/Low or 1–5), Mitigation, Owner, Status (Open/Mitigating/
Closed/Occurred).

## 8. `Issues`

Issue ID*, Description*, Severity (Critical/High/Medium/Low), Owner,
Raised Date, Target Date, Status (Open/In Progress/Resolved/Closed).

## 9. `Product Backlog`

Task ID*, Epic, Feature, User Story, Task Title*, Description, Priority,
Story Points, Estimated Hours, Remaining Hours, Actual Hours, Sprint,
Assignee, Status (Backlog/Ready/To Do/In Progress/Blocked/Testing/Review/
Done), Dependencies, Created Date, Start Date, Due Date, Completed Date,
Tags, Comments. *Duplicate Task IDs → error.* Status values feed the Kanban
board columns directly.

## 10. `Time Tracking`

Employee*, Date*, Task ID, Hours*, Activity, Project Phase. Rows referencing
Task IDs not present in the backlog → warning (logs from external tools may
predate backlog grooming).

## 11. `Sprints` (optional sheet)

Sprint Number*, Sprint Goal, Start Date, End Date, Capacity, Committed
Hours, Completed Hours, Velocity, Completion %. Enables burndown/velocity
charts; when absent the Sprint views simply hide.

## Validation summary

Errors (block import): missing required sheet/column, missing mandatory
charter fields (name, code, PM, budget, planned dates), start after end,
negative budget, duplicate Task/Milestone/Output/Risk/Issue IDs, invalid
dates, missing deliverable names.

Warnings (import allowed, flagged): missing sponsor (surfaced by governance
checks and executive recommendations), allocation > 100 %, budget sheet vs
charter mismatch > 10 %, unknown Task IDs in time logs, unknown sprint
references, missing optional-but-recommended fields (business unit,
priority, funding type, progress %).
