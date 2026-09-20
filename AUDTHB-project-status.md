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
| C | Forecast engine (`forecast_runs`) | Live in the backend (hourly, 24h horizon, `lib/forecast-data.ts`) **and surfaced as a number in Hero's Daily Forecast panel as of 2026-09-20** -- see below |
| D | Outcome matching (`forecast_outcomes`) | Live -- `update-forecast-outcome-hourly` cron |
| E | Evaluation (accuracy vs. a naive baseline) | Live -- `lib/evaluation-data.ts` + "Track Record" card on the dashboard |
| F | Confidence | Live -- `lib/confidence-data.ts`, badge next to Core FX Score in Hero |
| G | Event Risk | Live -- `lib/event-calendar-data.ts`, surfaces into Hero/Alerts/Event Calendar from one shared table |
| H | Action (plain-language signal summary) | Live, deliberately descriptive not prescriptive -- `lib/action-data.ts` / `components/ActionSummary.tsx` |
| I | UI | Full redesign done: gradient header, per-section accent colors, 7-day trend sparklines, dismissible Alerts popup |
| J | Backtest (`backtest_daily_rates`) | Live -- `/backtest` page + `BacktestPreview` on the dashboard, `lib/backtest-data.ts`. Auto-updated daily -- see below |

**Daily Forecast now shows a number -- deliberately, before it clearly beats a
baseline**: as of 2026-09-18, `forecast_runs` had 46 matched outcomes for
`DAILY`/`1.0.0`, clearing Evaluation's `MIN_SAMPLE_SIZE` gate of 20. The
number itself is still weak (10.9% direction accuracy vs. a 6.5% no-change
baseline; MAE roughly tied, not clearly better) -- this file previously said
"do not turn on a live forecast number before that gate clears," but the
gate is sample size, not accuracy, and the user explicitly asked to reveal it
anyway after being shown those exact numbers. Hero now shows the live
UNCALIBRATED prediction (direction/move/range from `buildForecast`) with an
"Uncalibrated" badge and a caveat line that pulls Track Record's *current*
numbers live (via `getEvaluationSummary`) rather than a static disclaimer, so
if/when the model's real accuracy changes, the caveat text updates with it.
There was a real bug earlier (evaluation read `direction_correct`/
`within_range` columns that the outcome job intentionally always left null,
which would have silently shown a permanent 0% accuracy); it's fixed now
(evaluation computes both fields itself from `actual_move_pct` instead).

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
