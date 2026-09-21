# AUD/THB Forecast Dashboard — Project Status

Last verified against live code + Supabase: 2026-09-20. Replaces the 2026-09-16
version of this file, which described a pre-redesign ZIP snapshot (component
names like `CurrentRateCard`/`DataHealth.tsx`, the old `/api/macro-status`-era
routes, a stale SHA256 file inventory) that no longer matches the codebase.
For the historical correlation study behind the current model weights, see
`AUDTHB-historical-analysis-2026-09.md` instead of duplicating it here.

## Stack

Next.js 16 (App Router, async Server Components, `force-dynamic`), Supabase
(Postgres + pg_cron + pg_net) for both data and scheduling, Tailwind CSS v4
with class-based dark mode. No separate job runner -- every ingest/score/
outcome route is a CRON_SECRET-gated `GET` handler that Supabase Cron hits on
a schedule (`select * from cron.job` for the current list).

## Workflow status (A -> I from the original roadmap)

| Step | What it is | Status |
|---|---|---|
| A | Ingest (FX, commodities, yields, macro, news) | Live -- see `app/api/*` routes, each with its own cron |
| B | Score snapshot (`fx_score_snapshots`) | Live |
| C | Forecast engine (`forecast_runs`) | Live in the backend (hourly, issues 1H + 4H + DAILY per run as of 2026-09-20, `lib/forecast-data.ts`) **and surfaced as a number per horizon in Hero's Forecast panel** -- see below |
| D | Outcome matching (`forecast_outcomes`) | Live -- `update-forecast-outcome-hourly` cron |
| E | Evaluation (accuracy vs. a naive baseline) | Live -- `lib/evaluation-data.ts` + "Track Record" card on the dashboard |
| F | Confidence | Live -- `lib/confidence-data.ts`, badge next to Core FX Score in Hero |
| G | Event Risk | Live -- `lib/event-calendar-data.ts`, surfaces into Hero/Alerts/Event Calendar from one shared table |
| H | Action (plain-language signal summary) | Live, deliberately descriptive not prescriptive -- `lib/action-data.ts` / `components/ActionSummary.tsx` |
| I | UI | Full redesign done: gradient header, per-section accent colors, 7-day trend sparklines, dismissible Alerts popup |
| J | Backtest (`backtest_daily_rates`) | Live -- `/backtest` page + `BacktestPreview` on the dashboard, `lib/backtest-data.ts`. Auto-updated daily -- see below |

**Daily Forecast now shows a number -- deliberately, before it clearly beats a
baseline**: as of 2026-09-18, `forecast_runs` had 46 matched outcomes for
`DAILY`/`1.0.0`, clearing Evaluation's `MIN_SAMPLE_SIZE` gate of 20. This file
previously said "do not turn on a live forecast number before that gate
clears," but the gate is sample size, not accuracy, and the user explicitly
asked to reveal it anyway after being shown the (weak) numbers. Hero now
shows the live UNCALIBRATED prediction (direction/move/range from
`buildForecast`) with an "Uncalibrated" badge and a caveat line that pulls
Track Record's *current* numbers live (via `getEvaluationSummary`) rather
than a static disclaimer, so if/when the model's real accuracy changes, the
caveat text updates with it. There was a real bug earlier (evaluation read
`direction_correct`/`within_range` columns that the outcome job intentionally
always left null, which would have silently shown a permanent 0% accuracy);
it's fixed now (evaluation computes both fields itself from
`actual_move_pct` instead).

**Neutral-band and move-scale constants were recalibrated 2026-09-20, and
`FORECAST_VERSION` bumped to `1.0.1`**: `NEUTRAL_BAND_PCT` (backtest) and
`BASELINE_NEUTRAL_BAND_PCT` (evaluation) were both 0.02%, an arbitrary guess
that sat below even the quietest 10% of days in the 927-day RBA backtest
(p10 0.047%, median 0.301%) -- "no real move" was effectively never true, and
the earlier "10.9% vs. 6.5% baseline" numbers mentioned above were an
artifact of that, not a real measurement. Both are now 0.10% (~p15).
`REFERENCE_DAILY_RANGE_PCT` (guessed from 7 days of history) moved from
0.35% to 0.39%, the same backtest's actual mean absolute daily move -- barely
changed, but now grounded in real data. None of this establishes that Core
FX Score actually predicts direction; only the *scale* of "no real move" and
the forecast's move magnitude are now real. The version bump resets Hero's
Daily Forecast caveat to "insufficient data" until `1.0.1` accumulates its
own 20+ resolved outcomes (the `1.0.0` bucket stays visible in Track Record,
re-graded live under the corrected band: now 39% vs. 41% baseline, "Beats
Baseline: No" -- also more honest than before). One finding this
recalibration overturned: the backtest's apparent "Mean Reversion beats a
coin flip across the Friday-to-Monday weekend gap" result (50.3%) drops to
40.5% under the corrected band -- that edge was itself partly an artifact of
the same miscalibrated threshold.

**1H and 4H forecasts added 2026-09-20, alongside DAILY**: the user found
DAILY's ~20-day wait for Track Record's 20-sample gate too slow to be useful
by demo time. `lib/forecast-data.ts` generalized `buildForecast(horizon, ...)`
over `FORECAST_HORIZONS = ["1H", "4H", "DAILY"]`, each with its own
move-scale constant (`HORIZON_CONFIG`) -- DAILY still 0.39% from the 927-day
RBA backtest, 1H/4H calibrated instead against this project's own live
AUD/THB feed (`market_prices`, 2026-09-11..20, ~9 days at 10-min resolution:
mean |1H move| 0.042%, mean |4H move| 0.071%) since no free historical
intraday source exists. `forecast_runs`'s natural key was migrated to
`(run_slot, model_version, forecast_version, horizon)` so one score-snapshot
run can issue all three without conflicting. `lib/evaluation-data.ts`'s
neutral band is now per-horizon too (1H 0.01%, 4H 0.02%, DAILY 0.10%) --
a single 0.10% band would have made every 1H/4H move register as "no real
move," silently favoring the no-change baseline. Outcome matching
(`app/api/forecast-outcome`) needed no changes: it already worked generically
off `target_time`, regardless of horizon. Because 1H/4H resolve in 1-4 hours
instead of 24, they clear the 20-sample gate in about a day instead of ~20 --
**backfilled once, retroactively, from the 73 hourly `fx_score_snapshots`
rows already on hand (2026-09-17..20)**: same formula, same historical
`core_fx_score`/`rate` at each past hour, matched against real `market_prices`
at run_slot+1h/+4h -- no lookahead, since the formula only ever used
information available at that past hour. This seeded 73 resolved samples
each for 1H (33% vs. 30% baseline, beats baseline) and 4H (26% vs. 26%,
does not) immediately, rather than waiting a day for the live cron alone to
accumulate them. Going forward the live hourly cron keeps adding to the same
`1.0.1` bucket.

DAILY got the same backfill treatment right after, once the user asked why
DAILY wasn't included too: of the 73 `fx_score_snapshots` rows, 49 already
had a target_time (run_slot + 24h) in the past, comfortably above the
20-sample gate on their own. Same method -- same formula and inputs
available at each historical hour, matched against real `market_prices` --
seeded DAILY/`1.0.1` straight to 49 resolved samples (41% vs. 43% baseline,
does not beat it) instead of the ~20-day wait a purely-live cron would have
needed. All three horizons now show real Track Record numbers the same day
they were added.

**Backtest (workflow J) is now on a live cron, not just a one-time
backfill**: `app/api/backtest-update` (CRON_SECRET-gated, same pattern as
every other ingest route) fetches RBA's F11.1 CSV and upserts rows newer
than `max(rate_date)`. Runs weekdays 08:00 UTC (`update-backtest-daily` in
`cron.job`, comfortably after RBA's ~4pm AEST/AEDT publish time). Notable
finding: RBA's Akamai bot detection blocks curl outright (HTTP 403 even with
full browser headers spoofed), but a plain Node `fetch()` with an ordinary
User-Agent passes -- verified manually, then end-to-end against the live
table before wiring the cron up. If the backtest ever looks stale again,
check `select max(rate_date) from backtest_daily_rates` first -- RBA could
tighten bot detection further with no warning, and this cron would then
start silently no-op'ing (it fails safely, never writes bad data) rather
than erroring loudly.

**Economic Consensus added 2026-09-20** (workflow G extension, forward-looking
context): the user wanted upcoming news factored into the forecast. Real
consensus data (forecast/previous/actual) for scheduled releases turned out
to have no free-and-compliant source -- `event_calendar`'s own migration
comment already noted every real provider checked (Finnhub, FMP) gates this
behind a paid plan. ForexFactory's public weekly export
(`https://nfs.faireconomy.media/ff_calendar_thisweek.xml`) is free and has
real forecast/previous/actual values, but its own page asks not to be
fetched more than once an hour ("can result in being blocked") --
`app/api/economic-consensus` respects that by running once a day
(`update-economic-consensus-daily`, 00:10 UTC), not hourly. Deliberately
does **not** compute a directional score from these numbers: an indicator's
"surprise" polarity (higher-is-bullish vs higher-is-bearish) varies by type
and this feed has no structured metadata for that -- guessing wrong would
be actively misleading. Shows the raw forecast/previous/actual under a new
"Market Consensus" block in `EventCalendar`, scoped to AUD/USD High/Medium
impact only, explicitly labeled "not scored -- read direction yourself,"
same spirit as News Sentiment being context-only. Found and fixed a real
parsing bug during testing: FF mixes CDATA-wrapped tags (date, impact,
forecast) with plain-text tags (title, country) in the same feed --
`extractTag` in the route now matches either shape.

**Directional lean added right after**: the user pointed out ForexFactory
shows a "Usual Effect" note per event on each event's own detail page (e.g.
"higher than expected is good for the currency") -- the real polarity
source, but it lives only on ~75 individual per-event pages, not the one
weekly export file already fetched. Scraping those would be a materially
riskier pattern than the single daily export fetch. Instead, `POLARITY_RULES`
in `lib/economic-consensus-data.ts` hand-codes the same well-known textbook
polarity for a narrow set of common indicator types (employment change,
unemployment rate, retail sales/GDP/PMI/confidence, CPI/inflation) and
compares actual-vs-forecast (once released) or forecast-vs-previous
(before release). Anything outside that list gets no badge -- never a
guessed one. Not wired into the live Core FX Score -- shown as context
in `Market Consensus` only, since doing so would reset Track Record's
version bucket again and is a bigger decision on its own.

**Full weekly Economic Calendar added same day**: the user wanted the whole
week's ForexFactory data, not just the AUD/USD subset `economic_consensus`
curates. `app/api/economic-consensus` now also upserts every event (every
currency, every impact level, including Low/Holiday) into a second table,
`ff_weekly_calendar` -- same single daily fetch, no extra requests against
FF's feed. New page `/economic-calendar` (masthead-lite pattern, like
`/backtest` and `/status`) lists it grouped by day, linked from the
homepage's Event Calendar card.

**Track Record de-duplicated**: `getEvaluationSummary()` now filters to
only the current `FORECAST_VERSION` per horizon. DAILY's old `v1.0.0`
bucket (pre-recalibration) was still showing alongside the current `v1.0.1`
one, which read as a confusing duplicate rather than useful history --
the old version's rows stay in the DB, just not surfaced on the dashboard.

## Current model weights (MODEL_VERSION 1.3.0)

Top-level (sums to 100 when every factor has data):

| Factor | Max weight |
|---|---:|
| Price / Momentum | 35 |
| Cross Currency | 20 |
| Relative Market | 15 |
| Commodity | 8 |
| Macro / Policy | 10 |
| Risk / VIXY | 7 |
| Mean Reversion | 5 |

Internal splits that changed this session, both driven by the 10-year
correlation study (`AUDTHB-historical-analysis-2026-09.md` + its "รอบสอง"
follow-up section):
- **Commodity**: Brent 55 / Iron Ore 45 (Gold stays monitor-only -- 15 years
  of data show ~zero correlation with AUD/THB; tested and confirmed twice,
  including at quarterly resolution for Iron Ore, which didn't help either).
- **Relative Market**: yield spread 26 / USD-CNH 15 / USD-SGD 59 (USD/SGD
  turned out to be the strongest and most stable of the three, r=-0.50 vs.
  0.22 for yield and -0.13 -- not even significant -- for CNH; the previous
  50/35/15 split had the strongest and weakest signals nearly reversed).

Macro's internal split (Policy 4 / Inflation 3 / Labour 2 / Growth 1, out of
its 10-point max) was not changed this session. It was tested against real
data in a third correlation-study round, using proxies that approximate but
don't exactly match the app's own definitions -- none of the four
sub-factors cleared the significance bar at the resolutions tested (Policy
r=0.01, Inflation AU-US r=-0.11, Inflation US-TH r=0.07, Labour AU-US-only
r=-0.08, Growth r=0.31 but on only 14 annual data points). Deliberately not
acted on given the proxy-fidelity gap and Growth's tiny sample -- see
`AUDTHB-historical-analysis-2026-09.md`'s "รอบสาม" section before touching
these weights.

## Data sources and known constraints

- Alpha Vantage News Sentiment: **25 requests/day, free tier**. This project
  already hit that cap silently once mid-session (News Signals returned 0
  candidates with no visible reason). Now self-tracked in an `api_usage`
  table (`lib/api-usage-data.ts`) and shown on the News Signals card itself
  ("Alpha Vantage: N/25 requests used today").
- Twelve Data: 8 credits/minute on the free tier. Only matters for one-off
  analysis scripts (sequential calls + backoff); the live app's own ingest
  routes stay well under this.
- DBnomics (IMF PCPS commodity prices): free, no key, but IMF's own publish
  lag is ~15 months behind "now" -- do not expect current-quarter commodity
  correlation numbers from it.
- No dedicated cron-execution-log table exists; feed staleness/missingness in
  `market_prices` etc. is the practical proxy for "a cron job isn't working,"
  same as before.

## Known open items

- **Check `event_calendar` vs. `ff_weekly_calendar` naming again around
  2026-09-29 (RBA Board Meeting Decision), and again for BOT MPC/FOMC
  around 2026-10-28, AU CPI 2026-09-30, US CPI 2026-10-14.** The
  Employment Change rename (2026-09-21, see above) was only checkable
  because that event fell inside ForexFactory's currently-fetched
  window (`ff_weekly_calendar` only ever holds the *current* week,
  refreshed daily -- there's no stored history of future weeks to
  check against ahead of time). Confirmed as of 2026-09-21:
  ForexFactory has **zero THB coverage at all** (checked
  `ff_weekly_calendar` and all-time `economic_consensus`), so BOT MPC
  events can never have a naming clash to fix -- skip those. RBA/FOMC/
  BOE/BOJ are the ones that could still mismatch; ForexFactory
  typically splits a rate decision into multiple line items (e.g.
  "Cash Rate" + "RBA Rate Statement" rather than one combined
  "Decision" row), which `event_calendar`'s single-row-per-meeting
  naming doesn't match today -- don't guess the exact rename before
  that week's real data is fetchable; verify live the same way the
  Employment Change fix was verified.
- Track Record (workflow E) needs 20 matched outcomes per horizon/version
  group before it reports real accuracy numbers instead of "insufficient
  data" -- this fills in automatically over the following days, no code
  change needed.
- Macro's internal split was tested (see above) but not acted on -- the
  proxies used don't exactly match the app's own Labour/Inflation/Growth
  definitions, and Growth's test sample was too small (14 annual points) to
  trust. Worth re-testing with better-matched data sources before touching
  these weights, unlike Commodity/Relative Market where the test data was
  the same series the app actually uses.
- Mobile horizontal-scroll bug (StickyBar's `position: fixed` wrapper
  computing a wider-than-viewport width at 375px) was found and fixed with
  `overflow-x: hidden` on `html`/`body` in `app/globals.css` -- resolved,
  kept here only as a note in case it resurfaces on a real device this
  session's tooling couldn't test against.
- **2026-09-21: renamed `event_calendar`'s AU Labour Force rows to
  "Employment Change"**, matching `economic_consensus`'s (ForexFactory)
  naming for the same real release. User noticed on a phone screenshot
  that the Event Risk alert ("Labour Force, Australia") didn't visibly
  match anything in Market Consensus below it ("Employment Change" /
  "Unemployment Rate") -- same event, two independently-built,
  never-reconciled tables (`event_calendar` from 2026-09-17,
  `economic_consensus` from 2026-09-20) using different source
  terminology (ABS's report title vs. ForexFactory's per-indicator
  names). Fixed by renaming `event_calendar`'s 4 AU EMPLOYMENT rows
  (`supabase/migrations/20260921_rename_labour_force_events.sql`), not
  by touching `economic_consensus` -- ForexFactory's own naming there
  should stay as ForexFactory names it. The two tables are still
  otherwise unlinked (no shared event ID); if this class of mismatch
  shows up again for AU CPI or the central bank meetings, it's the same
  root cause and same fix.
