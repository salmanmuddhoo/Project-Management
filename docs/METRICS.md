# Metrics & Calculations Reference

This document explains **every calculated metric** in the app — how it is
computed, what thresholds decide its colour/verdict, and **which file and
constant to change** if you want to tune it.

> All calculations run in the browser over the imported Planner board + Timorc
> time. Nothing is stored. Each view (Overview, EVM, Reports…) reads the same
> numbers, all built once per import in `buildSnapshot()`
> (`src/lib/metrics/portfolioMetrics.ts`).

---

## 0. Constants you can tune

All the knobs live in **`src/lib/config.ts`**:

| Constant | Value | Meaning |
| --- | --- | --- |
| `HOURS_PER_DAY` | `7` | 1 working day = 7 hours. Converts Timorc man-days ↔ hours and task-estimate days ↔ hours. |
| `OVER_BUDGET_WARN_PCT` | `90` | Hours consumed ≥ 90 % of budget → a "budget nearly exhausted" warning. |
| `BEHIND_SCHEDULE_GAP` | `20` | (time elapsed % − progress %) beyond this → a "behind schedule" risk reason. |
| `SPI_WARN` | `0.9` | SPI below this adds a schedule risk reason (critical below 0.75). |
| `CPI_WARN` | `0.9` | CPI below this adds a budget risk reason (critical below 0.75). |
| `OVER_BUDGET_RED_PCT` | `110` | Hours consumed ≥ 110 % of budget → **hard-stop Red** (see §3). |
| `OVERDUE_TASKS_RED` | `5` | This many overdue tasks → **hard-stop Red**. |
| `SCHEDULE_LATE_AMBER_DAYS` | `5` | Schedule traffic light turns **Amber** at ≥ 5 days late (see §3.5). |
| `SCHEDULE_LATE_RED_DAYS` | `10` | Schedule traffic light turns **Red** at ≥ 10 days late (see §3.5). |
| `BUDGET_BURN_AHEAD_AMBER_PCT` | `25` | Hours burned this far ahead of progress → Budget traffic light **Amber**. |
| `DELIVERY_BLOCKED_RED` | `3` | This many blocked tasks → Deliverables traffic light **Red**. |
| `FORECAST_BUDGET_TOLERANCE_PCT` | `5` | Forecast within ±5 % of budget still counts as "within budget". |
| `FORECAST_SCHEDULE_TOLERANCE_PCT` | `5` | Forecast finish within ±5 % of planned duration still counts as "on time". |

The **health weights** (40 / 30 / 30) are in `HEALTH_WEIGHTS`
(`src/lib/metrics/healthScore.ts`). The **governance standard** (70) is in
`src/lib/metrics/recommendations.ts`.

---

## 1. Core inputs & progress

File: **`src/lib/metrics/projectMetrics.ts`**

### Is a task "done"?
A task counts as done if **any** of these is true:
- its bucket is a done bucket (`completed`, `done`, `terminé`, `terminée`, `terminées`, `termine`, `closed`, `clos`), or
- it has an end/completion date, or
- its status text starts with `termin`, or
- its progress % is ≥ 100.

### Task progress (0–100)
`taskProgress(t)` = **100** if the task is done, otherwise its entered
`Avancement : N%` (clamped 0–100, `0` when blank).

### Overall progress %
Two ways, in priority order:
1. **Effort-weighted** (preferred, used when tasks carry estimates):
   `effortCompletionPct = Σ(estimateHours × taskProgress/100) ÷ Σ(estimateHours) × 100`
2. **Task-count average** (fallback): the plain average of `taskProgress` over all tasks.

`overallProgressPct = effortCompletionPct ?? taskCompletionPct ?? 0` (clamped 0–100).
This single number feeds EVM, the health score and the forecast.

### Schedule position
- `durationDays = days(start → end)` (from the charter dates)
- `timeElapsedPct = clamp(days(start → today) ÷ max(1, days(start → end)) × 100, 0, 100)`
- `daysRemaining = days(today → end)`
- `overdue = end < today AND overall completion < 100 %`

### Time & budget (hours)
- `consumedDays = Σ Timorc entry days` · `consumedHours = consumedDays × HOURS_PER_DAY`
- `budgetConsumedPct = consumedHours ÷ budgetHours × 100` (null if no hours budget)
- `remainingHours = budgetHours − consumedHours`
- `overBudget = consumedHours > budgetHours`

---

## 2. EVM (Earned Value Management)

File: **`src/lib/metrics/evm.ts`**. Computed per **unit** — hours (always, if an
hours budget exists) and/or cost (if a cost budget exists).

Let `pc = overallProgressPct` and `pp = timeElapsedPct`.

| Metric | Formula |
| --- | --- |
| **BAC** — Budget At Completion | the charter budget (hours or cost) |
| **PV** — Planned Value | `pp/100 × BAC` |
| **EV** — Earned Value | `pc/100 × BAC` |
| **AC** — Actual Cost | hours: `consumedHours` · cost: `consumedHours × rate` |
| **SV** — Schedule Variance | `EV − PV` |
| **CV** — Cost Variance | `EV − AC` |
| **SPI** — Schedule Performance Index | `EV ÷ PV` (= `pc ÷ pp`) |
| **CPI** — Cost Performance Index | `EV ÷ AC` |
| **EAC** — Estimate At Completion | `BAC ÷ CPI` |
| **ETC** — Estimate To Complete | `EAC − AC` |
| **VAC** — Variance At Completion | `BAC − EAC` (negative ⇒ forecast overrun) |

**Cost rate** (to price hours into money): `rate = budgetCost ÷ budgetHours`. If
there is a cost budget but no hours budget, cost CPI/EAC can't be derived (a
note is shown). SPI is unit-independent and always available once dates exist.

Interpretation: **SPI ≥ 1** = on/ahead of schedule; **CPI ≥ 1** = on/under budget.

---

## 3. Health score & RAG

File: **`src/lib/metrics/healthScore.ts`**

Three weighted dimensions, each scored 0–100. **A dimension with no data scores
a neutral `75`** (so incomplete projects aren't unfairly punished).

Weights (`HEALTH_WEIGHTS`): **Schedule 40 % · Budget 30 % · Delivery 30 %**.

Helper: `indexScore(i) = clamp(i × 100, 0, 100)` — maps an SPI/CPI onto 0–100.

### Schedule dimension
```
lag  = max(0, timeElapsedPct − overallProgressPct)
base = clamp(100 − lag × 1.5, 0, 100)
if SPI available:  base = (base + indexScore(SPI)) / 2   ← blends in EVM SPI
score = clamp(base − tasksOverdue × 8, 0, 100)
```

### Budget dimension
```
overPct   = max(0, budgetConsumedPct − 100)
base      = clamp(100 − overPct × 2.5, 0, 100)
burnAhead = max(0, budgetConsumedPct − overallProgressPct)
base      = clamp(base − burnAhead × 0.4, 0, 100)
if CPI available:  score = (base + indexScore(CPI)) / 2   ← blends in EVM CPI
else:              score = base
```

### Delivery dimension
```
score = clamp(overallProgressPct + 40 − tasksBlocked × 12 − tasksOverdue × 6, 0, 100)
```

### Final score
```
score = round( Σ (dimensionScore ?? 75) × weight )
```

### RAG bands (`ragOf`)
| RAG | Score |
| --- | --- |
| 🟢 **Green** | 80 – 100 |
| 🟡 **Amber** | 60 – 79 |
| 🔴 **Red** | 0 – 59 |

### Hard-stop rules (force Red)
Regardless of the weighted score, the RAG is forced to **Red** if **any** of:
- the project is **past its end date and not complete** (`overdue`), or
- hours consumed **≥ `OVER_BUDGET_RED_PCT` (110 %)** of budget, or
- **≥ `OVERDUE_TASKS_RED` (5)** overdue tasks.

A forced Red adds a critical reason explaining why (`ragForcedRed = true`).

### Risk reasons (the "why", shown on Overview & in the report)
| Reason | Trigger |
| --- | --- |
| Behind schedule | `lag > BEHIND_SCHEDULE_GAP (20)` (critical if `lag > 40`) |
| Schedule performance behind plan | `SPI < SPI_WARN (0.9)` (critical if `< 0.75`) |
| Past its end date | `overdue` |
| N overdue task(s) | `tasksOverdue > 0` (critical if `≥ 3`) |
| Over budget | `overBudget` (critical) |
| Budget nearly exhausted | `budgetConsumedPct ≥ OVER_BUDGET_WARN_PCT (90)` |
| Cost efficiency below plan | `CPI < CPI_WARN (0.9)` and not over budget (critical if `< 0.75`) |
| Hours burning faster than delivery | `burnAhead > 25` and not over budget |
| N blocked task(s) | `tasksBlocked > 0` |

---

## 3.5 Project lifecycle & the Overview traffic lights

File: **`src/lib/metrics/dimensionRag.ts`** (`computeStatusLights`). Built once per
import inside `buildSnapshot()` and shown as the **"Project status"** card at the
top of the Overview.

These lights are **separate from the weighted health score (§3)**. The health
score is a smooth 0–100 blend; the traffic lights are **discrete and
rule-based** so each one can state a plain "why" (e.g. "past the end date by 12
days"). They exist to give an at-a-glance RAG per dimension, matching the master
Excel's Calendrier / Budget / Périmètre colours.

### Colour vocabulary
| Colour | Meaning |
| --- | --- |
| 🟢 **green** | on track |
| 🟡 **amber** | at risk — watch it |
| 🔴 **red** | off track — needs action |
| 🔵 **blue** | complete |
| ⚪ **grey** | not started, or no data to judge |

### Lifecycle (derived from the Planner buckets)
The **Project Charter** card lives in the "Project Details" bucket, which the
importer excludes from `project.tasks` — so only real work cards are considered:
- **Complete** — there is at least one task and **every** task sits in a *done*
  bucket (`completed`, `done`, `terminé`, `closed`, …).
- **Not started** — there are **no** cards at all, **or** no card has moved into
  an *In Progress*, *Blocked* or *Completed* bucket yet (everything is still in
  backlog / to-do buckets).
- **Active** — anything in between.

The card header badge shows this state. It also drives the **overall** colour:
grey if *not started*, blue if *complete*, otherwise the **worst** of the three
lights below (red > amber > green).

### Schedule light
Grey if the charter has no start or end date. Otherwise the light is driven by
**how many days late** the project is — the worst of two independent measures:
- **Overdue days** — if past the end date and not complete: `days(end → today)`.
- **Behind-pace days** — how far delivery trails the clock:
  `max(0, (timeElapsedPct − overallProgressPct) / 100 × durationDays)`.

| Colour | Rule |
| --- | --- |
| 🟢 green | late `< SCHEDULE_LATE_AMBER_DAYS (5)` days |
| 🟡 amber | late `≥ 5` and `< SCHEDULE_LATE_RED_DAYS (10)` days |
| 🔴 red | late `≥ 10` days |

*Example:* a project 12 days past its end date and still open shows **red**
("Past the end date by 12 day(s), not yet complete."). A project only 6 days
behind its expected pace shows **amber**.

### Budget light
Grey if there is no hours budget / no time logged. Let
`burnAhead = max(0, budgetConsumedPct − overallProgressPct)`.

| Colour | Rule |
| --- | --- |
| 🔴 red | `budgetConsumedPct ≥ OVER_BUDGET_RED_PCT (110 %)` |
| 🟡 amber | `budgetConsumedPct ≥ OVER_BUDGET_WARN_PCT (90 %)`, **or** `burnAhead > BUDGET_BURN_AHEAD_AMBER_PCT (25 pp)` |
| 🟢 green | otherwise |

*Example:* 95 % of the hours used shows **amber**; 40 % of hours used while only
10 % of the work is done (`burnAhead = 30`) also shows **amber**.

### Deliverables light
Grey if there are no work tasks.

| Colour | Rule |
| --- | --- |
| 🔴 red | `tasksOverdue ≥ OVERDUE_TASKS_RED (5)` **or** `tasksBlocked ≥ DELIVERY_BLOCKED_RED (3)` |
| 🟡 amber | at least one task overdue or blocked |
| 🟢 green | none overdue or blocked |

---

## 4. Forecast ("will it finish on time and on budget?")

File: **`src/lib/metrics/forecast.ts`**. Uses the EVM outputs above.

### Budget outlook (from EAC / VAC, primary unit)
```
overrunPct = (EAC − BAC) ÷ BAC × 100
outlook = overrunPct > FORECAST_BUDGET_TOLERANCE_PCT (5)  →  "over"
          else                                            →  "within"
          (EAC unknown, e.g. no time logged)              →  "unknown"
```
`VAC = BAC − EAC` (positive ⇒ under budget).

### Timeline outlook (from SPI)
```
forecastDuration = durationDays ÷ SPI          (independent estimate of duration)
forecastEnd      = startDate + forecastDuration
daysVariance     = days(plannedEnd → forecastEnd)   (positive ⇒ late)
tolDays          = FORECAST_SCHEDULE_TOLERANCE_PCT (5%) × durationDays
outlook = daysVariance > tolDays  →  "over" (late)
          else                    →  "within" (on time)
```

### Overall verdict
Looking only at the known (non-unknown) outlooks:
| Verdict | Condition |
| --- | --- |
| **On track** | none are "over" |
| **At risk** | some (but not all) are "over" |
| **Off track** | all are "over" |
| **Insufficient data** | no budget and no dates |

> The timeline forecast (`duration ÷ SPI`) is a standard EVM projection, good
> for an executive read-out — not a critical-path reschedule. The UI labels it
> "estimates, not commitments".

---

## 5. Governance score

File: **`src/lib/metrics/governance.ts`**. Ten pass/fail checks; the score is
simply `passed ÷ 10 × 100`.

Checks: charter documented · start & end dates set · hours budget defined ·
project manager identified · resources listed · Timorc code linked · work tasks
created · time being logged · within hours budget · no overdue tasks.

---

## 6. Recommendations (risk findings)

File: **`src/lib/metrics/recommendations.ts`**. Collects every health **risk
reason** (categorised as Budget / Schedule / Delivery), and adds:
- a **Time** warning if no Timorc code is on the board, and
- a **Governance** warning if the governance score is below the company
  standard **`GOVERNANCE_STANDARD` (70)**.

Findings are sorted critical → warning → info.

---

## 7. Portfolio aggregation

File: **`src/lib/metrics/portfolioMetrics.ts`** (`computePortfolioMetrics`).
This app is single-project, but the report summary uses these:
- **Portfolio health** = health scores **weighted by each project's hours
  budget** (weight 1 when a project has no budget), then `ragOf(...)`.
- **On track** = count of Green projects · **At risk** = count of Red projects.

---

## Quick reference — what to change, and where

| To change… | Edit |
| --- | --- |
| Hours per working day | `HOURS_PER_DAY` in `config.ts` |
| Health weights (schedule/budget/delivery) | `HEALTH_WEIGHTS` in `healthScore.ts` |
| RAG bands (Green/Amber/Red cut-offs) | `ragOf()` in `healthScore.ts` |
| Neutral score for missing data | `NEUTRAL` in `healthScore.ts` |
| Hard-stop Red thresholds | `OVER_BUDGET_RED_PCT`, `OVERDUE_TASKS_RED` in `config.ts` (+ logic in `healthScore.ts`) |
| Overview traffic-light thresholds | `SCHEDULE_LATE_*_DAYS`, `BUDGET_BURN_AHEAD_AMBER_PCT`, `DELIVERY_BLOCKED_RED` in `config.ts` (+ logic in `dimensionRag.ts`) |
| Lifecycle (not started / active / complete) rule | `computeLifecycle()` in `dimensionRag.ts` |
| SPI/CPI warning thresholds | `SPI_WARN`, `CPI_WARN` in `config.ts` |
| Behind-schedule / near-budget warnings | `BEHIND_SCHEDULE_GAP`, `OVER_BUDGET_WARN_PCT` in `config.ts` |
| How each health dimension is scored | the three blocks in `computeHealthScore()` |
| Forecast tolerances | `FORECAST_*_TOLERANCE_PCT` in `config.ts` |
| Forecast formulas | `computeForecast()` in `forecast.ts` |
| EVM formulas / cost rate | `evm.ts` |
| Governance checks | the `checks` array in `governance.ts` |
| Governance company standard | `GOVERNANCE_STANDARD` in `recommendations.ts` |
