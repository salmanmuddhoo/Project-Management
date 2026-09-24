# Metrics & Calculations Reference

This document explains **every calculated metric** in the app — how it is
computed, what thresholds decide its colour/verdict, and **which file and
setting to change** (from the in-app Settings menu) if you want to tune it.

> All calculations run in the browser over the imported Planner board + Timorc
> time. Nothing is stored. Each view (Overview, EVM, Reports…) reads the same
> numbers, all built once per import in `buildSnapshot()`
> (`src/lib/metrics/portfolioMetrics.ts`).

---

## 0. Settings you can tune

Every threshold, weight and name below can be changed **in the app** from the
**Settings** menu (sidebar). Changes apply immediately to every page and
report and are remembered in the browser (`localStorage`, key
`ppm-settings`); no project data is stored. Each field shows its default and
can be reset individually, per section, or all at once, and the whole set can
be exported/imported as JSON to share with a team.

The defaults are defined in **`src/lib/config.ts`** (`DEFAULT_SETTINGS`):

| Setting (Settings page) | Key | Default | Meaning |
| --- | --- | --- | --- |
| Hours per working day | `hoursPerDay` | `7` | 1 working day = 7 hours. Converts Timorc man-days, task estimates and day-based budgets to hours. |
| Schedule / Budget / Delivery weight | `weightSchedule` · `weightBudget` · `weightDelivery` | `0.4` · `0.3` · `0.3` | Health-score weights, normalised to sum to 1 (see §3). |
| Green from score / Amber from score | `ragGreenMin` · `ragAmberMin` | `80` · `60` | RAG bands of the 0–100 health score. |
| Neutral score (no data) | `neutralScore` | `75` | Score of a dimension with no data. |
| Behind schedule gap / critical gap | `behindScheduleGap` · `behindScheduleCriticalGap` | `20` · `40` | (time elapsed % − progress %) beyond this → a "behind schedule" reason / critical. |
| SPI / CPI warning below | `spiWarn` · `cpiWarn` | `0.9` · `0.9` | SPI/CPI below this adds a schedule/budget risk reason. |
| SPI / CPI critical below | `indexCritical` | `0.75` | …which becomes critical below this. |
| Budget nearly exhausted at | `overBudgetWarnPct` | `90` | Hours consumed ≥ 90 % of budget → warning, Budget light **Amber**. |
| Significantly over budget at | `overBudgetRedPct` | `110` | Hours consumed ≥ 110 % → **hard-stop Red** (§3) and Budget light **Red**. |
| Burn ahead of delivery | `budgetBurnAheadPct` | `25` | % budget used − % progress beyond this → warning, Budget light **Amber**. |
| Overdue tasks — critical from | `overdueTasksCritical` | `3` | The overdue-tasks reason becomes critical. |
| Overdue tasks — hard Red from | `overdueTasksRed` | `5` | **Hard-stop Red** and Deliverables light **Red**. |
| Schedule Amber / Red from | `scheduleLateAmberDays` · `scheduleLateRedDays` | `5` · `10` | Schedule traffic light by days late (§3.5). |
| Deliverables Red from | `deliveryBlockedRed` | `3` | This many blocked tasks → Deliverables light **Red**. |
| Budget / Schedule tolerance | `forecastBudgetTolerancePct` · `forecastScheduleTolerancePct` | `5` · `5` | Forecast slack before "over budget" / "late" (§5). |
| Governance standard | `governanceStandard` | `70` | Governance score below this → recommendation. |
| Done / Blocked / In-progress buckets | `doneBuckets` · `blockedBuckets` · `progressBuckets` | see Settings | Bucket names (case-insensitive) that classify tasks. |
| Planner import names | `projectDetailsBucket` · `charterCardTitle` · `timorcCardTitle` · `resourcesCardTitle` · `defaultBucket` | `Project Details` · `Project Charter` · `Taches Timorc` · `Resources` · `Backlog` | Special bucket/card names. Applied at the next import. |
| Score formula (advanced) | `scheduleLagFactor` · `scheduleOverduePenalty` · `budgetOverrunFactor` · `budgetBurnAheadFactor` · `deliveryBaseBonus` · `deliveryBlockedPenalty` · `deliveryOverduePenalty` | `1.5` · `8` · `2.5` · `0.4` · `40` · `12` · `6` | Coefficients inside the three health dimensions (§3). |

The formulas below are written with the default values; each number that is
a setting is followed by its key where it first appears.

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
- `consumedDays = Σ Timorc entry days` · `consumedHours = consumedDays × hoursPerDay`
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

Weights (Settings › Health score & RAG, normalised to sum to 1): **Schedule 40 % · Budget 30 % · Delivery 30 %**.

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
- hours consumed **≥ `overBudgetRedPct` (110 %)** of budget, or
- **≥ `overdueTasksRed` (5)** overdue tasks.

A forced Red adds a critical reason explaining why (`ragForcedRed = true`).

### Risk reasons (the "why", shown on Overview & in the report)
| Reason | Trigger |
| --- | --- |
| Behind schedule | `lag > behindScheduleGap (20)` (critical if `lag > behindScheduleCriticalGap (40)`) |
| Schedule performance behind plan | `SPI < spiWarn (0.9)` (critical if `< indexCritical (0.75)`) |
| Past its end date | `overdue` |
| N overdue task(s) | `tasksOverdue > 0` (critical if `≥ 3`) |
| Over budget | `overBudget` (critical) |
| Budget nearly exhausted | `budgetConsumedPct ≥ overBudgetWarnPct (90)` |
| Cost efficiency below plan | `CPI < cpiWarn (0.9)` and not over budget (critical if `< indexCritical (0.75)`) |
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
| 🟢 green | late `< scheduleLateAmberDays (5)` days |
| 🟡 amber | late `≥ 5` and `< scheduleLateRedDays (10)` days |
| 🔴 red | late `≥ 10` days |

*Example:* a project 12 days past its end date and still open shows **red**
("Past the end date by 12 day(s), not yet complete."). A project only 6 days
behind its expected pace shows **amber**.

### Budget light
Grey if there is no hours budget / no time logged. Let
`burnAhead = max(0, budgetConsumedPct − overallProgressPct)`.

| Colour | Rule |
| --- | --- |
| 🔴 red | `budgetConsumedPct ≥ overBudgetRedPct (110 %)` |
| 🟡 amber | `budgetConsumedPct ≥ overBudgetWarnPct (90 %)`, **or** `burnAhead > budgetBurnAheadPct (25 pp)` |
| 🟢 green | otherwise |

*Example:* 95 % of the hours used shows **amber**; 40 % of hours used while only
10 % of the work is done (`burnAhead = 30`) also shows **amber**.

### Deliverables light
Grey if there are no work tasks.

| Colour | Rule |
| --- | --- |
| 🔴 red | `tasksOverdue ≥ overdueTasksRed (5)` **or** `tasksBlocked ≥ deliveryBlockedRed (3)` |
| 🟡 amber | at least one task overdue or blocked |
| 🟢 green | none overdue or blocked |

---

## 4. Forecast ("will it finish on time and on budget?")

File: **`src/lib/metrics/forecast.ts`**. Uses the EVM outputs above.

### Budget outlook (from EAC / VAC, primary unit)
```
overrunPct = (EAC − BAC) ÷ BAC × 100
outlook = overrunPct > forecastBudgetTolerancePct (5)  →  "over"
          else                                            →  "within"
          (EAC unknown, e.g. no time logged)              →  "unknown"
```
`VAC = BAC − EAC` (positive ⇒ under budget).

### Timeline outlook (from SPI)
```
forecastDuration = durationDays ÷ SPI          (independent estimate of duration)
forecastEnd      = startDate + forecastDuration
daysVariance     = days(plannedEnd → forecastEnd)   (positive ⇒ late)
tolDays          = forecastScheduleTolerancePct (5%) × durationDays
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

## 4.5 Burndown (actual vs expected)
File: **`src/lib/metrics/burndown.ts`** (`computeBurndown`, `burndownVerdict`),
shown on the Overview as the **Burndown — actual vs expected** chart with two
views, and on the first page of the PDF report as two cards (Work, Hours
Budget) with the same verdict.

**Window:** charter start date → charter end date (extended to today when the
project is past its end date). Needs both dates; otherwise the chart explains
what is missing. Long projects are sampled to at most 180 points.

**Expected** (both views) — the ideal straight-line burn:
```
expected(d) = scope × (1 − clamp((d − start) ÷ (end − start), 0, 1))
```

**Work view** — scope is the total **estimated hours** when tasks carry
estimates, else the **task count** (the same basis as Overall progress):
```
actual(d) = scope − Σ weight of tasks completed on or before d
```
A task burns on its Planner **completion date**. A task that is done but has no
completion date (e.g. moved to a done bucket) burns **today**. Partial
progress (`Avancement`) is not burned until the task is complete — the
standard burndown convention — so the line is a step chart.

**Hours budget view** — scope is the charter hours budget:
```
actual(d) = budgetHours − Σ Timorc hours logged on or before d
```
Entries without a date count from the start. The line goes below zero when the
project is over budget.

**Verdict** (today): `variance = actual − expected`.
- Work: `variance > tolerance` ⇒ **Behind plan**; `< −tolerance` ⇒ **Ahead of
  plan**; else **On plan**. Tolerance = `forecastScheduleTolerancePct` (5 %) of
  scope.
- Budget: `variance < −tolerance` ⇒ **Burning fast**; `> tolerance` ⇒ **Under
  burn**; else **On plan**. Tolerance = `forecastBudgetTolerancePct` (5 %) of
  the budget.

Scope is taken as it is today (task creation dates aren't imported), so scope
added mid-project shows up as a higher starting point rather than a step up.

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
  standard **`governanceStandard` (70)**.

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

Values are changed from the **Settings** menu; the table names the setting
and, for rules that are code rather than numbers, the function to edit.

| To change… | Where |
| --- | --- |
| Hours per working day | Settings › Units (`hoursPerDay`) |
| Health weights (schedule/budget/delivery) | Settings › Health score & RAG |
| RAG bands (Green/Amber/Red cut-offs) | Settings › Health score & RAG (`ragGreenMin`, `ragAmberMin`) |
| Neutral score for missing data | Settings › Health score & RAG (`neutralScore`) |
| Hard-stop Red thresholds | Settings › Risk reasons & hard-stop rules (`overBudgetRedPct`, `overdueTasksRed`) |
| Overview traffic-light thresholds | Settings › Overview traffic lights (+ logic in `dimensionRag.ts`) |
| Lifecycle (not started / active / complete) rule | Settings › Bucket classification (+ `computeLifecycle()` in `dimensionRag.ts`) |
| SPI/CPI warning thresholds | Settings › Risk reasons (`spiWarn`, `cpiWarn`, `indexCritical`) |
| Behind-schedule / near-budget warnings | Settings › Risk reasons (`behindScheduleGap`, `overBudgetWarnPct`) |
| How each health dimension is scored | Settings › Score formula (advanced), or the blocks in `computeHealthScore()` |
| Forecast tolerances | Settings › Forecast |
| Forecast formulas | `computeForecast()` in `forecast.ts` |
| Burndown calculation / verdict | `computeBurndown()` in `burndown.ts`; tolerances in Settings › Forecast |
| EVM formulas / cost rate | `evm.ts` |
| Governance checks | the `checks` array in `governance.ts` |
| Governance company standard | Settings › Governance (`governanceStandard`) |
| Which buckets mean done / blocked / in progress | Settings › Bucket classification |
| Planner special bucket / card names | Settings › Planner import |
| Default values themselves | `DEFAULT_SETTINGS` in `src/lib/config.ts` |
