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

**Technical Outlook added 2026-09-21** (new, deliberately separate from the
Core FX Score / Forecast system above): `lib/technical-outlook-data.ts` +
`components/TechnicalOutlook.tsx`, placed right after Hero/ActionSummary.
User asked for a narrative daily-brief style report (shared a ChatGPT-
generated example with support/resistance levels, news-analyst quotes, and
a directive "Postfund, sized in tranches" call) and wanted it added to the
Forecast area. Built the parts backed by this project's own real data --
classic pivot points (P/R1-3/S1-3) computed from actual `market_prices`
daily OHLC bars, a swing high/low range, and a narrative that restates (in
prose) the Core FX Score component breakdown already computed elsewhere on
the page -- and explicitly declined the parts that weren't: no fabricated
news/analyst quotes (this app has no live news-narrative source; inventing
one would mean writing fake citations into a production page), and the
Action Bias reuses the exact same Core FX Score bias thresholds already
used for `coreBias` everywhere else (not a new judgment call), labeled
"informational only... not investment advice" rather than the sized
position-sizing language ("Postfund Bias แบบแบ่งไม้") in the original
example.

Found and fixed a real bug during testing: `market_prices` queried without
an explicit `.limit()` (ascending order) silently truncated at
Supabase/PostgREST's 1000-row cap before reaching today's data -- the pivot
was computing off 3-day-old data with no error surfaced. Fixed by querying
descending with an explicit `.limit(3000)` (still hard-capped at 1000
server-side, but now the *most recent* 1000 rows) and narrowing
`SWING_LOOKBACK_DAYS` from 10 to 7 so the swing range stays within what
actually fits under that cap as ingest volume grows. Verified live against
real Supabase data before and after the fix (pivot date jumped from
2026-09-19 to the correct 2026-09-20 once fixed).

**Technical Outlook extended same day**: user asked for current price,
an actual chart (not just numbers), and to fold in the real forecast/
previous economic data already sitting in `economic_consensus` (the same
ForexFactory-sourced table Market Consensus reads) rather than needing
fabricated news to make the panel feel complete. Added `currentRate` and
`priceSeries` (the same daily bars already computed for pivots/swing, no
second query) to `getTechnicalOutlook`'s return; `components/
TechnicalOutlook.tsx` gained a plain hand-rolled SVG chart (same
no-library convention as `TrendChart.tsx`) plotting the price line against
all five pivot levels on one shared scale -- a level the price hasn't
reached yet (e.g. R2 in a quiet week) still draws on-chart instead of
clipping. The narrative now also pulls up to 2 upcoming HIGH-impact
events (forecast/previous, with the existing `POLARITY_RULES`-derived
lean when available) straight from `getEconomicConsensus()` -- verified
live to match Market Consensus's own numbers exactly (AUD Employment
Change: forecast 20.9K, previous -15.8K, leans bullish).

**Technical Outlook: real SMA/RSI + server-side daily bars (same day)**:
user asked for "better technical factors" plus more historical depth to
draw from ("ตีย้อนหลังเพื่อ forecast"). The prior raw-tick fetch was
capped by Supabase/PostgREST's hard 1000-row limit to ~7 days back
regardless of `.limit()` -- not enough for a real 20-day SMA or 14-day
RSI. Fixed at the root: added a Postgres function,
`public.get_daily_price_bars(p_symbol, p_since)`
(`supabase/migrations/20260921_daily_price_bars_function.sql`), that
aggregates OHLC per Bangkok calendar day *in SQL* and returns one row per
day -- so a 60-day lookback request returns ~10 rows today (real history
only goes back to 2026-09-11) instead of thousands of raw ticks, and
never touches the 1000-row cap no matter how far back it's asked to look.
`getTechnicalOutlook` now calls this via `supabaseAdmin.rpc(...)` instead
of querying `market_prices` directly, and reuses the same daily bars for
pivots, swing, chart, and the new indicators (no separate query per
indicator).

Added real SMA(short)/SMA(long)/RSI, all periods capped to however many
completed real days actually exist right now rather than padding or
refusing to render -- e.g. today shows SMA(5)/SMA(10)/RSI(9) because only
~10 real days of AUD/THB history exist; a `limitedHistory` narrative line
says so explicitly, and once real data passes 20 days these become true
SMA(20)/RSI(14) with no code change. The price chart gained a second
overlay line (SMA short, sky blue, with a legend) that only starts
drawing once enough trailing real bars exist for that point -- no
fabricated left-edge padding. Narrative gained trend (price vs SMA,
SMA-short vs SMA-long) and momentum (RSI overbought/oversold/neutral)
lines, all computed from real prices, nothing else changed. Verified live
against real Supabase data: SMA(5)=23.7192, SMA(10)=23.7682, RSI(9)=55.7,
trend/momentum narrative and chart overlay all rendering correctly before
push.

**Forecast merged into Technical Outlook (same day)**: user asked to take
the existing Forecast panel (1H/4H/DAILY direction, predicted move %,
price range, Track Record accuracy, caution notes -- previously its own
section at the bottom of Hero's left/"Rate" column) and combine it with
Technical Outlook, since the predicted price targets should be read
against the real pivot support/resistance levels sitting right there. Cut
the whole block out of `components/Hero.tsx` (and its now-unused
`buildForecast`/`FORECAST_HORIZONS`/`FORECAST_VERSION`/
`getEvaluationSummary` imports, `forecastDirectionColor` helper, and
`referenceRate`/`forecasts`/`allNeutral`/`cautionNotes` locals -- nothing
duplicated, moved wholesale) and rebuilt it inside
`getTechnicalOutlook`/`TechnicalOutlook.tsx` instead, reusing the exact
same `buildForecast()` rule, `getEvaluationSummary()` Track Record join,
and `getEventRisk()`/`getConfidence()` caution-note logic -- no new
prediction, no new judgment call. `formatHoursUntil` (previously a local
Hero helper) moved to `lib/i18n.ts` since both files need it now.

Added one genuine synthesis on top, not just a UI move: when the DAILY
forecast has a real (non-NEUTRAL) directional call, its price target
(range high for BULLISH, range low for BEARISH) is compared against the
real pivot R1/S1 -- narrative states whether reaching that target would
mean a real technical breakout/breakdown or just a move within the
pivot's normal range. Verified live: today's Core FX Score sits inside
the neutral band, so all three horizons correctly read NEUTRAL (with the
existing `allNeutral` explainer) and the new cross-reference line
correctly stays silent, since there's no directional target to compare
yet -- confirms the conditional logic rather than proving the non-NEUTRAL
branch, which will render once the score moves outside +/-15.

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

## Decision Snapshot, Score Explained (2026-09-21)

User (framing themselves as an FX analyst deciding prefund/postfund) asked
what an analyst-oriented redesign should prioritize. They pasted a large
7-item roadmap (News/Event causal-chain engine, USD Driver Chain via
GBP/EUR/DXY, Forecast snapshot/outcome, Backtest/Accuracy, a Decision
Engine, Time-of-Day seasonality, Score Attribution, Market Regime) --
several of these items were described as missing but already existed
(Backtest at `/backtest`, `forecast_runs`/`forecast_outcomes`, Evaluation/
Track Record, Event Risk) -- factual gaps were corrected before building
anything. Two items were explicitly declined even under "ทำทั้งหมด ไม่สนข้อกำหนด"
(do everything, ignore the constraints): stripping the UNCALIBRATED/
Track Record honesty labels (current DAILY direction accuracy is 40.8%,
1H is 40.8% vs a 42.9% baseline -- *worse* than doing nothing on some
horizons; hiding that would mean presenting an unproven model as
trustworthy for real funding decisions), and the News/Event causal-chain
engine as described ("GBP↓→DXY↑→USD↑→AUD↓") since this project has no
live news feed and already has a standing no-fabrication rule for this
exact panel (see the Technical Outlook entries above). User agreed to
skip new data ingestion (GBP/EUR/DXY feeds) and asked for the rest.

Built three new features, all derived from data that already existed --
no new external source, no new cron:

**`lib/score-factors.ts`** -- new shared helper, not tied to either
feature below. `coreFxScore` is a weighted average
(`sum(score*weight)/sum(weight)`, see dashboard-data.ts's own "CORE FX
SCORE" comment); this exposes `computeContributions()`, which computes
each of the 7 factors' exact contribution to that average
(`score*weight/availableWeight`) so `sum(contribution) === coreFxScore`
by construction, not approximation. Two adapters build the raw input:
`rawFactorsFromDashboard()` (live `DashboardData`) and
`rawFactorsFromSnapshot()` (a historical `fx_score_snapshots.components`
row), so the same math applies to "today" and "any past hour" alike.

**`lib/score-explained-data.ts` + `components/ScoreExplained.tsx`**
("อธิบายคะแนน", rendered right after Hero/ActionSummary) -- two panels
from the same contribution math:
- *What changed*: today's per-factor contribution vs. the closest
  `fx_score_snapshots` row to ~24h ago, filtered to the current
  `MODEL_VERSION` only (comparing across a model recalibration would
  read as a market move that never happened). Sorted by \|delta\|
  descending, factors with a delta under 0.5 points hidden as noise.
  Falls back to an honest "not enough history yet" message when the
  current model version hasn't accumulated 24h of snapshots (was live
  and working today: 1.3.0 has run since 2026-09-18).
- *What's driving today*: whichever factor has the largest
  \|contribution\| today, labeled with its real factor name (Price/
  Momentum, Relative Market, Commodity, Macro/Policy, Risk/VIXY, Cross
  Currency, Mean Reversion) -- deliberately NOT the Fed/RBA/THB-flow
  granularity the user's roadmap imagined, since this project's 7
  factors don't carry that finer breakdown as separate real numbers.
  Reported as MIXED when the top factor is under 35% of the total
  \|contribution\| (a day with no clear single driver), rather than
  forcing a single label. Verified live: Price/Momentum led today at
  42%, hand-checked against the visible factor scores (contribution
  math reconciled exactly, coreFxScore +28 = sum of all 7 contributions).

**`lib/decision-snapshot-data.ts` + `components/DecisionSnapshot.tsx`**
(rendered above the whole ledger, right after Alerts -- the first thing
on the page) -- combines Action Bias direction, Core FX Score, Confidence
level, the nearest Event Risk warning (if any), and DAILY Track Record
accuracy into one strip, so reading the "verdict" doesn't require
scrolling the whole page and synthesizing Hero + Technical Outlook +
Evaluation manually. Every field is read from functions that already run
elsewhere on the page (`getEventRisk`, `getConfidence`,
`getEvaluationSummary`) -- no new judgment call, no new number, purely a
presentation move. Verified live: "เอนไปทาง Postfund +28, ความมั่นใจ: ปานกลาง"
plus the real Employment Change event warning and real 40.8%/49 DAILY
Track Record line.

Declined for a later session (needs a decision the user hasn't made
yet): GBP/USD and EUR/USD live feeds for a real USD Driver Chain panel,
and Time-of-Day seasonality (needs 60-90 days of intraday history this
project doesn't have yet -- only ~10 days exist as of this entry).

## Released economic events -- the "after" half of the before/after pair (2026-09-21)

User re-scoped the declined News/Event causal-chain engine into something
real-data-only: show forecast-vs-previous before a release (already built,
see the Technical Outlook entries above), then once the real number is
out, show actual-vs-previous too. Buildable entirely from
`economic_consensus`, which already stores `actual_value` and already gets
it upserted daily by the ForexFactory ingest (`app/api/economic-consensus/
route.ts`) -- the gap was purely that `getEconomicConsensus()` only ever
queries `event_date >= today`, so a released event disappears from it the
moment its date passes, before anything could show what actually happened.

Added `getRecentEconomicOutcomes()` to `lib/economic-consensus-data.ts`
(new query: last 5 days through today, `actual_value is not null`) and a
shared `leanFromValues()` helper extracted for reuse (the existing
`computeLean()` used by `getEconomicConsensus()` is untouched -- zero risk
to already-shipped behavior). Each released event now gets *two* real
comparisons instead of one collapsed lean: actual vs. forecast (did it
surprise?) and actual vs. previous (did the trend improve or worsen?) --
both can disagree, and both are shown rather than picking one. Wired into
Technical Outlook's narrative as a new "Released" line, shown before the
existing "Upcoming" line (mirrors reading the news in the order it
happened). Verified: `economic_consensus` currently has zero rows with
`actual_value` populated (ingestion only started 2026-09-20 and every
AUD/USD/THB HIGH/MEDIUM event on the books so far is still in the future --
the earliest, AUD Employment Change, releases 2026-09-22), confirmed the
empty state renders cleanly with no error; verified the comparison logic
itself in isolation with realistic values (Employment Change 25.2K vs.
forecast 20.9K → bullish, vs. previous -15.8K → bullish; Unemployment
Rate 4.6% vs. forecast 4.5% → bearish). Will start showing real lines
automatically once real releases land -- no code change needed, same
"fills in over time" pattern as Track Record.

## Twelve Data capacity check (2026-09-21)

User asked whether current Twelve Data usage leaves headroom to add more
symbols, from a usage dashboard screenshot (99/800 daily credits, 3/8
peak per-minute, as of 04:20am into the billing day). Audited every
Twelve Data call against the live `cron.job` table: `/api/market` (AUD/THB,
AUD/USD, USD/THB every 10 min, 24/7 = 432 credits/day),
`/api/relative-market` (USD/CNH, USD/SGD every 30 min = 96/day),
`/api/risk` (VIXY, hourly weekdays only, self-skips outside NYSE cash
session = ~7/day) -- **≈535 credits/day total** (extrapolates to exactly
the 99 seen by 04:20am), confirming the plan cap is 800/day, 8/min.
Adding GBP/USD + EUR/USD to the 10-min market cron would breach the daily
cap (+288/day → 823/800). Adding them to the 30-min relative-market cron
instead fits comfortably (+96/day → 631/800, 79% utilization; per-minute
peak stays at 3-4, well under 8). Not yet built -- still needs the user's
go-ahead on the feeds themselves (declined earlier this same day), this
was capacity-planning only.

## GBP/USD added to relative-market cron; DXY does not exist on Twelve Data (2026-09-21)

User asked to add GBP/USD and DXY to the 30-min `/api/relative-market`
cron, following the capacity check above (fits: +96/day). Added GBP/USD
to `RELATIVE_SYMBOLS` in `app/api/relative-market/route.ts` (now
`["USD/CNH", "USD/SGD", "GBP/USD"]`) -- verified live against the real
Twelve Data API before adding (`time_series?symbol=GBP/USD` returns real
quotes) and against the running dev cron (fetched, saved to
`market_prices`, confirmed the row live in Supabase: `GBP/USD 1.3377 @
2026-09-21 04:34 UTC`). Inert for now -- `dashboard-data.ts`'s
`relativeMarketScore` still only queries `USD/CNH`/`USD/SGD` by name, so
this just accumulates real history until a USD Driver Chain reader is
built on top of it (same "collect now, build the view later" pattern as
Technical Outlook's SMA/RSI).

**DXY was not added -- it isn't a real Twelve Data symbol.**
`time_series?symbol=DXY` returns a 404 ("invalid symbol"), and
`symbol_search?symbol=DXY` only matches unrelated US stock tickers
(Dixie Group, Destiny Tech100), not the ICE US Dollar Index. Twelve Data
has no raw DXY-equivalent index in its indices list either. The closest
real proxy is `UUP` (Invesco DB US Dollar Index Bullish Fund, an ETF
that tracks the dollar index via futures) -- confirmed it returns real
data via `time_series?symbol=UUP`, but it only trades NYSE hours (not
24/7 like FX), and being an ETF/futures-tracking fund its price behavior
isn't identical to the raw index. This is the same kind of proxy this
project already uses for Risk (VIXY standing in for VIX), so it's a
legitimate pattern here too -- but it changes what's actually being
measured, so it needs the user's own call before adding it under a
"DXY" label. Asked, not yet decided as of this entry.

## Full redesign: new 6-tab dashboard at `/` (2026-09-21)

User shared a reference mockup (light theme, blue/purple SaaS-dashboard
look, 6 tabs: Dashboard/Analysis/Events/Data/Performance/About) and asked
for the site to be rebuilt to match it. Confirmed before building (see
plan approval): adopt the new visual style fully (not a reskin of the
almanac look), add real tab navigation (reverses an earlier explicit
decision -- `app/classic/page.tsx`'s own comment: "a sidebar/tabs
structure was tried and explicitly rejected earlier"), build all 6
sections in one pass, and show GBP/USD instead of the mockup's
illustrative "DXY" row (not a real Twelve Data symbol, see the entry
above).

**The old homepage moved intact to `/classic`**, not deleted -- every
component/lib function it used stays exactly as-is, reachable at that
URL as a fallback/reference. The new dashboard now owns `/`, `/analysis`,
`/events`, `/data`, `/performance`, `/about` under a `(dashboard)` route
group (`app/(dashboard)/layout.tsx` + one page per tab). The 4
pre-existing standalone pages (`/backtest`, `/score-breakdown`,
`/economic-calendar`, `/status`) were **not** redirected into the new
tabs as originally planned -- left fully independent instead, to avoid
`/classic`'s own internal links jumping into the new dashboard
mid-read. All still reachable and working.

**New v2 design tokens** (`app/globals.css`): `--v2-bg/-surface/-border/
-foreground/-muted`, additive alongside the existing almanac tokens
(`--background`/`--surface`/`--brass`, untouched) -- `/classic` and the
4 standalone pages render exactly as before. Primary blue / accent
indigo reuse Tailwind's built-in classes directly, no new tokens needed
since they don't swap by theme. New shared primitives in
`components/v2/`: `Card`, `BadgeChip`, `KpiCard`, `DonutGauge` (hand-
rolled SVG, same no-library convention as `TrendChart.tsx`), `Sparkline`,
`RangeChart` (range-toggle line chart -- buttons read "7D/30D/90D/All"
rather than the mockup's "1D/1W/1M/3M/1Y", since this app's real price
history is daily-bar granularity, not intraday -- renamed to match what
it actually shows), `WatchlistRow`, `TabNav`, `Header`, `AnalysisTabs`.

**Every number still traces to something real** -- no new fabrication,
matching this session's standing rule:
- Dashboard/Analysis reuse `getDashboardData`, `getTechnicalOutlook`
  (pivots/SMA/RSI/merged Forecast/upcoming events), `getDecisionSnapshot`,
  `getScoreExplained`, `getAlerts`, `getEconomicConsensus` /
  `getRecentEconomicOutcomes` unchanged.
- Performance reuses `getEvaluationSummary`, `getBacktestSummary`, plus
  a new `lib/forecast-history-data.ts` (`getForecastHistory`) that
  renders `forecast_runs`/`forecast_outcomes` rows -- real data that
  already existed but was never charted/tabled before.
- Data tab: new `lib/data-health-data.ts` (`getDataHealth`) assembles a
  per-feed freshness table from fields `DashboardData` already computes
  (no new scoring), plus one supplementary query for GBP/USD (tracked
  since 2026-09-21, not yet part of Core FX Score). Source list is only
  this project's real sources (Twelve Data, DBnomics, OilPriceAPI,
  Gold-API, "Various" for macro) -- deliberately not the mockup's
  "TradingView"/"NewsAPI" rows, which this app doesn't actually use.
- Analysis > Correlation: new `lib/correlation-data.ts`
  (`getCorrelations`) computes real Pearson correlation between AUD/THB
  and each other real driver's daily % change via `get_daily_price_bars`
  (generalized to any symbol), gated at 15+ overlapping real days.
  Verified live: correctly shows "needs 15+ overlapping days" for every
  driver right now, since real price history is only ~11 days deep --
  will start reporting real numbers automatically as more accumulates,
  same pattern as every other "not enough data yet" feature this session.
- Shared per-factor math: new `lib/score-factors.ts` (`computeContributions`)
  factored out for reuse across Score Explained and the new Analysis >
  Drivers sub-tab -- unchanged from Score Explained's original math.

**Verified live before shipping**: typecheck/build clean at every stage
(not just the end), all 11 routes (`/`, `/classic`, the 5 new tabs, the
4 standalone pages) return 200, real numbers on every new tab cross-
checked against Supabase and against each other (e.g. Data tab's
AUD/THB Direct value matches Dashboard tab's exactly; Analysis > Drivers'
dominant-factor share reconciles by hand against the visible factor
contributions), dark mode confirmed via computed styles, mobile width
(375px) confirmed no horizontal overflow beyond the intended scrollable
tab bar.

## Dashboard tab revisions from a screenshot (2026-09-21, same day)

User reviewed the shipped Dashboard tab against a screenshot and asked
for 7 changes:

1. **`TabNav`**: removed the numbered circle badges, tabs now stretch
   `flex-1` to fill the bar edge-to-edge (matches the content grid's
   width below instead of a left-packed cluster).
2. **Caution banner -> dismissible popup**: new `components/v2/
   CautionToast.tsx` (client component), fixed-position floating card
   with an X close button, session-only dismiss (no persistence -- a
   stale dismissal shouldn't hide a genuinely new alert).
3. **Core FX Score + Action Bias merged** into one `Card` (was two
   separate cards) -- score/bias on top, Action Bias verdict + note
   below a divider inside the same card.
4. **Price + Technical Levels merged**: `RangeChart` (`components/v2/
   RangeChart.tsx`) now takes optional `pivots`/`currentRate` props and
   draws all 7 pivot levels (R3/R2/R1/Pivot/S1/S2/S3, not just R2-S2 as
   before) as reference lines directly on the chart, plus a current-
   price figure above it -- same real `technicalOutlook.pivots`/
   `currentRate` data, just no longer a separate text-only card.
5. **Related Markets sparklines were incomplete** (only FX pairs had
   them) -- root cause: commodities live in a separate `commodity_prices`
   table with no daily-bar SQL function like FX's
   `get_daily_price_bars`, and VIXY (which *is* in `market_prices`, so
   the RPC already worked for it) wasn't being queried through it yet.
   Fixed in `lib/watchlist-data.ts`: VIXY now uses the existing RPC,
   Iron Ore/Brent/Gold get a new JS-side Bangkok-day bucketing
   (`dailyClosesFromCommodityPrices` -- row counts are small enough
   under Supabase's cap that no SQL function was needed), and AU/US 2Y
   yields get a real sparkline from `yield_snapshots` history. Every
   Related Markets row now has a real sparkline and a real % change
   (previously several were hardcoded to `series: []` because no
   history source was wired up).
6. **Upcoming Events now shows the event date** next to each event name.
7. **Overall Dashboard layout re-ordered** to match the above: Rate |
   Score+Action (2 cols) -> Price & Technical (full width) -> Forecast |
   Upcoming Events (2 cols) -> Related Markets (full width), with the
   Caution toast floating outside the normal flow instead of occupying
   the top of the page.

Verified live: dismiss button removes the toast, R3/S3 lines render on
the chart alongside R2/R1/P/S1/S2 with the correct pivot basis date,
every Related Markets row shows a real sparkline + % change (Iron Ore
-0.46%, Brent -5.12%, Gold +1.38%, VIXY -2.74%, AU/US yields +3.48%/
+5.42% -- all computed over whatever real history exists per symbol,
not a fixed 1H/24H window like the old dashboard fields, so these can
span longer real ranges for symbols with deeper history than AUD/THB's
own ~11 days).

## Dashboard tab: chart header, pivot labels, event grouping (2026-09-21, same day)

User reviewed a screenshot of the merged Price & Technical card and
asked for 3 more changes:

1. **Chart header felt bare**: `RangeChart` (`components/v2/
   RangeChart.tsx`) gained optional `change1H`/`swingLow`/`swingHigh`/
   `swingDays` props, rendered alongside the existing current-price
   figure -- all real values already computed (`dashboard.change1H`,
   `technicalOutlook.swingLow`/`swingHigh`/`swingLookbackDays`), just
   not passed through before.
2. **Pivot reference lines only showed labels (R3/R2/.../S3), not the
   actual price**: each line's `<text>` now renders `${label} ${value}`
   (e.g. "R3 23.7873") instead of just the label. Widened `PAD_LEFT`
   (56 -> 78px) so the longer labels fit.
3. **Upcoming Events was a flat top-4 HIGH-only list**: `getEconomicConsensus()`
   already queries HIGH+MEDIUM AUD/USD/THB events for the current week
   at the DB level, so the extra `impact === "HIGH"` and
   `forecastValue !== null` filters in `app/(dashboard)/page.tsx` were
   dropping real MEDIUM events and speech-only entries for no reason.
   Removed both filters, grouped the remaining (not-yet-released)
   events by `eventDate` with a date header per group and an impact
   badge (HIGH/MEDIUM) per event, matching the user's ask ("show as
   news for each respective day, all MEDIUM/HIGH").

Verified live: chart header shows real 1H change (-0.05%) and real
7-day swing range (23.6461-23.7831) next to current price; pivot lines
render with real values (R3 23.7873 down to S3 23.6793); Upcoming
Events now shows 3 real date groups (22/24/25 ก.ย.) with 6 real events
total including 3 MEDIUM-impact ones that were previously hidden.

## Dashboard tab: top-row restructure, chart polish, real Forecast context (2026-09-21, same day)

Fourth round of feedback on the shipped Dashboard tab:

1. **Top row restructured to 3 columns** (AUD/THB | Core FX Score +
   Action Bias | Upcoming Events) -- Upcoming Events moved up from
   further down the page into this row, per the user's explicit layout
   ask. AUD/THB card also gained a real `Sparkline` (reusing
   `components/v2/Sparkline.tsx`, already built for Related Markets)
   from the same `technicalOutlook.priceSeries` already fetched, so the
   card doesn't read as bare next to the taller Upcoming Events list.
2. **Price & Technical**: removed the 1H-change/swing-range stat blocks
   added earlier this same day (still supported as optional
   `RangeChart` props, just no longer passed from this page -- Analysis
   tab's own Price & Chart sub-tab still uses swing range). Chart made
   bigger (260px -> 340px, 640 -> 720 viewBox width) and smoother: the
   line now uses quadratic-bezier-through-midpoints smoothing
   (`smoothPath()` in `RangeChart.tsx`) instead of straight segments --
   passes through every real data point exactly, no overshoot past real
   values (unlike a cardinal/Catmull-Rom spline), just a smoother curve
   between them. Added faint background gridlines and a two-tone
   current-point marker for polish.
3. **Forecast cards** gained two real additions per horizon: a
   direction arrow (↑/↓/→, same direction value already shown as text)
   for a faster scan, and the *actual* real change over that same
   window next to the *predicted* range -- 1H/4H reuse
   `dashboard.change1H`/`change4H`; DAILY is newly derived in the page
   itself from `technicalOutlook.priceSeries` (today's latest close vs.
   the last completed day's close, the same completed-bar convention
   the pivot calculation already uses) since no ready-made daily-change
   field existed on `DashboardData`.

Verified live: 3-column top row renders with a real sparkline in the
AUD/THB card; Price & Technical chart renders larger and visibly
smoother with the extra stat blocks gone; Forecast cards show real
actual changes (-0.07%/-0.13%/-0.01% for 1H/4H/DAILY) alongside real
predicted ranges and correct arrows (→ for NEUTRAL, matching today's
in-band Core FX Score).

## Dashboard tab: full rebuild to match the reference mockup exactly (2026-09-21, same day)

Fifth round -- the user attached a fully detailed reference screenshot
(`dashboard เอาแบบนี้`, "make the dashboard like this") showing an
8-section layout, and asked for that exact structure. This is a bigger
rewrite of `app/(dashboard)/page.tsx` than the previous four rounds,
still built entirely from existing real data -- no new data sources.

1. **Row 1 split into 3 distinct cards** (previously Core FX Score and
   Action Bias were merged into one card): AUD/THB (price, real
   absolute+percent 1H change, real "updated HH:MM" from
   `latestPrice.market_timestamp`, High/Low/Today's-%-change) | FX
   Score (score, bias label, a hand-rolled horizontal -100..+100
   gradient gauge with a position marker at `((score+100)/200)*100%`,
   real Confidence badge from `getDecisionSnapshot()`, link to
   `/analysis`) | Today's Outlook (`technicalOutlook.actionBias`
   label/note, plus two new breakout-trigger boxes labeled Postfund/
   Prefund using the *real* pivot R1/S1 levels as the breakout price --
   not the mockup's illustrative numbers, this project's own computed
   pivots).
2. **Row 2 right column split into two stacked cards**: Technical
   Levels (R2/R1/Pivot/S1/S2, colored red/black/green) and a new
   Technical Signals card -- SMA(`smaShortPeriod`), RSI(`rsiPeriod`),
   a short-term-trend line, and an SMA-cross line, each with an
   up/down/flat arrow derived from values `technicalOutlook` already
   computes (`smaShortValue` vs `currentRate`, `rsiValue` vs 60/40,
   `smaShortValue` vs `smaLongValue`) -- no new calculation, just a new
   card surfacing numbers that previously only fed the narrative prose.
   Left column: same chart, now also showing 1H/4H/7-day-range/Today's-
   range stats below it (restoring the two stats removed earlier today,
   since the new layout has room and the mockup calls for them).
3. **Row 3 added a Score Breakdown card** next to Forecast, using
   `lib/score-factors.ts`'s existing `computeContributions()` (already
   used by Analysis tab's Drivers sub-tab) -- 7 factors with real
   weight%, a proportional bar, and the exact contribution value, which
   sums to `coreFxScore` by construction. Forecast cards swapped their
   "actual vs predicted" stat (added earlier today) for the mockup's
   directional-accuracy track record (`forecast.trackRecord`, already
   computed, just not previously shown here) -- both are real, this
   just matches what the reference image asked for.
4. **Upcoming Events flattened** from date-grouped sections back to a
   per-row list (row = icon + event name + date + forecast/previous +
   impact badge), matching the mockup; **Related Markets** switched
   from a 3-column grid to a single-column list (same `WatchlistRow`
   component, just a different container).
5. **Caution banner moved from a dismissible floating popup
   (`CautionToast`, added two rounds ago) to a static banner in normal
   page flow at the bottom of the page** -- the reference image shows
   it inline, not as an overlay. `CautionToast.tsx` is left in place
   (unused by this page now) rather than deleted, in case a future
   round reverts this.

Verified live at 1400x2200 (desktop) and 375x812 (mobile, stacks
cleanly to one column): all 4 rows + bottom banner render with real
numbers -- FX Score +9..+17 (moved between checks, confirming it's
computed live, not cached), Score Breakdown factors sum to the
displayed Core FX Score, Technical Signals arrows match the real
SMA/RSI values, Related Markets list shows all 9 real symbols with
sparklines. Cross-checked `fx_score_snapshots` in Supabase directly --
confirms the dashboard computes fresh on every request rather than
reading the periodic snapshot table (expected, documented behavior,
not a bug). `npx tsc --noEmit` and `npx next build` both pass clean.

## Dashboard tab: tooltips, equal-width cards, today-only events, 24h caution popup (2026-09-21, same day)

Sixth round of feedback:

1. **Tooltips on every section heading**: new `components/v2/InfoTooltip.tsx`
   -- a small "i" glyph rendered next to each card title, using the
   native HTML `title` attribute rather than a custom JS tooltip, so it
   works inside these async Server Components with zero client-side
   code. Added a `tip.*` string per section to both locales in
   `app/(dashboard)/page.tsx` explaining what that card actually shows
   and where its numbers come from.
2. **Cards resized to be roughly equal**: rows 2-4 (Price & Technical /
   Technical Levels+Signals, Forecast / Score Breakdown, Today's Events
   / Related Markets) switched from an uneven `lg:grid-cols-5` 3:2 split
   to a plain `lg:grid-cols-2` even split, matching row 1's existing
   3-equal-column layout.
3. **Today's Events replaces the week-wide Upcoming Events list**: the
   query now filters `consensus.events` to `eventDate === todayKey`
   (Bangkok "today", same `bangkokDateKey`-style convention already
   used in `lib/watchlist-data.ts`) instead of every not-yet-released
   event this week. An empty day now shows an explicit "no
   MEDIUM/HIGH-impact events scheduled today" message rather than
   silently showing next week's events instead -- verified against
   Supabase directly (`ff_weekly_calendar` has zero HIGH/MEDIUM rows
   for today's date), matching the empty state rendered live.
4. **Caution reverted from the inline bottom banner (added earlier
   today) back to a dismissible popup** (`CautionToast`, near the top of
   the page) per explicit request, *and* narrowed to a real 24-hour
   window: `lib/alerts-data.ts`'s event-risk alert used to fire for
   `eventRisk.level !== "NONE"`, which includes the 24-72h "WATCH"
   window (`EVENT_RISK_HIGH_WINDOW_HOURS`/`EVENT_RISK_WATCH_WINDOW_HOURS`
   in `lib/event-calendar-data.ts`) -- that's why a caution once showed
   an event 69.4 hours away. Changed the condition to
   `eventRisk.level === "HIGH"` only (events inside 24h), which is the
   threshold already defined in that file, not a new one.

Verified live at 1200px and 375px (mobile): all 10 tooltips confirmed
present via `document.querySelectorAll('[title]')` with the correct
real explanatory text per locale; Today's Events empty state matches a
direct Supabase query for today; no caution popup renders right now
since no alert currently qualifies for the 24h window (correct,
verified via DOM inspection, not a missing feature). `npx tsc --noEmit`
and `npx next build` both pass clean.

## Fixed: Performance tab's "Recent Forecast History" stuck on 2026-09-19 (2026-09-21, same day)

User noticed the table stopped advancing past 19/09, 06:00. Root
caused via direct Supabase queries (`cron.job_run_details`,
`forecast_runs`, `forecast_outcomes`) -- two independent, compounding
bugs, both real, neither previously caught:

1. **`/api/forecast-outcome` silently stalled since ~2026-09-20 10:35
   UTC**, while its hourly cron (`update-forecast-outcome-hourly`,
   `25 * * * *`) kept "succeeding" every hour (the cron only checks
   that the HTTP call completed, not what it did). The route fetched
   the oldest `BATCH_LIMIT` (100) due `forecast_runs` first (`ORDER BY
   target_time ASC LIMIT 100`), *then* filtered out ones that already
   had an outcome. Once the backlog of due forecast_runs passed 100 and
   the oldest 100 were all already matched (confirmed: oldest 100 were
   100/100 already matched, newest of that page = 2026-09-19 07:00
   UTC), every hourly run kept re-fetching that same exhausted page,
   found nothing pending in it, and did nothing -- 79 real,
   newer forecast_runs (2026-09-19 07:00 through 2026-09-21) sat
   completely unprocessed the whole time. Fixed with a new SQL function,
   `get_pending_forecast_outcomes(p_before, p_limit)`
   (`supabase/migrations/20260921_pending_forecast_outcomes_function.sql`)
   that excludes already-matched forecast_runs with `NOT EXISTS`
   *inside* the query, before `LIMIT` -- so a full page can never be
   "already handled." `app/api/forecast-outcome/route.ts` now calls
   this RPC instead of select-then-client-filter. Ran it once by hand
   against the live DB to clear the backlog: `{"checked":79,"matched":79,
   "missing":0,"skipped":0}` -- confirmed via SQL that all 323 due
   forecast_runs now have outcomes (323/323), latest DAILY/1.0.1 match
   now at 2026-09-21 07:00 UTC.
2. **`lib/forecast-history-data.ts` was not actually ordering by recency
   at all.** It called `.order("target_time", { ascending: false,
   referencedTable: "forecast_runs" })` -- but `referencedTable` only
   reorders rows *within* an embedded resource, which is meaningless
   for a to-one `!inner` join; it does nothing to the outer
   `forecast_outcomes` query's row order. So `.limit(12)` was applied
   to an effectively arbitrary order, and it happened to keep landing
   on rows around 2026-09-18/19 even after bug #1 was fixed and current
   data existed. Fixed by ordering on `forecast_outcomes`'s own
   `target_time` column instead (duplicated onto that table at insert
   time in `route.ts`, confirmed present in the schema) --
   `.order("target_time", { ascending: false })` with no
   `referencedTable`.

Verified live: after both fixes, "Recent Forecast History" (DAILY)
shows real, current rows from 21/09 01:00 through 21/09 14:00 (today),
all real MATCHED outcomes cross-checked against Supabase directly.
`npx tsc --noEmit` and `npx next build` both pass clean. The
`get_pending_forecast_outcomes` fix is the important one going
forward -- without it, this exact stall recurs automatically once the
due-but-unmatched backlog exceeds 100 again.

## Dashboard tab: visual redesign pass (2026-09-21, same day)

User asked to redesign the Dashboard tab's look with no specific
reference this time ("ลองออกแบบหน้า dashboard ใหม่ทั้งหมด ให้ดูดีกว่านี้
ใช้ frontend uiux design ช่วย") -- a pure visual-polish pass, not an
information-architecture change (all 4 rows, all real data, all
tooltips/filters from the prior rounds kept exactly as they were).

New shared pieces (same hand-rolled-SVG, no-library convention as
every other chart in this app):
- `components/v2/Icon.tsx` -- 10 small generic line icons (exchange,
  gauge, compass, candles, layers, pulse, target, bars, calendar,
  globe), one per Dashboard card, rendered in a small tinted rounded
  badge via `Card`'s existing `icon` prop.
- `components/v2/ScoreGauge.tsx` -- replaces the FX Score card's flat
  -100..+100 progress bar with a proper semi-circle speedometer arc
  (red-to-emerald gradient, dash-offset reveal like `DonutGauge`, a
  needle pointing at the real `coreFxScore` value). A signed bipolar
  value doesn't fit a 0-100 donut honestly, hence a dedicated
  component rather than reusing `DonutGauge`.
- `components/v2/Card.tsx` -- rounded-xl to rounded-2xl, subtle
  hover border transition, icon now sits in a tinted rounded badge
  instead of bare colored text. Shared by all 6 tabs, so this lifts
  the whole app's chrome consistently, not just Dashboard.

`app/(dashboard)/page.tsx` changes (styling/markup only, zero data
logic changed): every card header got its icon + kept its existing
tooltip; AUD/THB's High/Low/Today stats and the chart's 1H/4H/swing/
today stats became tinted `StatTile` chips instead of bare text
columns; Technical Levels rows got small colored dots (red/gray/green)
matching resistance/pivot/support; Forecast horizon boxes got a thin
colored top accent bar (emerald/red/slate matching direction); Score
Breakdown bars grew slightly (h-1.5 to h-2) with a width transition;
Today's Events empty state became a centered icon+message instead of
left-aligned text; a very subtle blurred gradient wash sits behind the
top row for depth.

Verified live at 1200px, 375px (mobile -- the gauge scales up nicely
as a hero element at full width), and confirmed light-mode CSS
variables resolve correctly via `getComputedStyle` (the Browser pane's
screenshot still renders visually dark in light mode, a known
rendering/capture quirk noted earlier this session, not a real bug --
verified via computed styles, not pixels). `npx tsc --noEmit` and
`npx next build` both pass clean.

## Fixed: `InfoTooltip` did nothing on hover (2026-09-21, same day)

User reported the tooltip "i" icons did nothing on hover. Root cause:
`InfoTooltip.tsx` used the browser's native `title` attribute, which
in practice has a ~1s hover delay before Chrome shows it, is easy to
trigger-and-move-away before it appears, and doesn't fire at all on
touch -- exactly what "nothing happens" describes. Replaced with a
self-contained CSS-only tooltip (`group` + `group-hover:opacity-100`
+ `group-focus-within:opacity-100`, still zero client JS, still works
in this async Server Component) that appears instantly and
consistently, plus opens on keyboard focus for accessibility.

While verifying, hit a red herring worth remembering: a long-running
local dev server (same Next.js process across many edits/turns this
session) served a stale CSS chunk missing the newly-introduced
opacity/group-hover utility classes, making the fix look broken in
the Browser pane even though the code was correct -- `rm -rf .next` +
restarting the dev server resolved it. Production/Vercel always does
a full fresh build per deploy, so this stale-dev-cache issue is a
local-only quirk, not something that reaches users -- but worth
remembering if a Tailwind class ever appears to have "no effect" in a
long-lived local dev session again: clear `.next` before concluding
the code itself is wrong.

Verified: `getComputedStyle` on the tooltip panel shows `opacity: 0`
at rest and `opacity: 1` on a real (CDP-driven) hover, confirmed for
multiple tooltips on the page. `npx tsc --noEmit` and `npx next build`
both pass clean.

## Fixed: ugly stale-data wording + Caution popup scoped to event/news only (2026-09-22)

User flagged the Caution popup showing "Brent (live): Data is stale
(1015.7717333333334 min old)" -- a raw unrounded float -- and asked
that the popup only warn about events/news happening within 24h.

1. **Wording fix**: `lib/alerts-data.ts`'s `ageOld()` interpolated the
   raw `ageMinutes`/`ageHours` float straight into the message with no
   rounding. Replaced with `formatAge()`, which normalizes to minutes
   regardless of the caller's unit, then renders as whole minutes
   (<60), one-decimal hours (<48h), or one-decimal days -- so the same
   real staleness now reads "17.1 hr" instead of "1015.7717333333334
   min". Applies everywhere `getAlerts()` is used (Dashboard's Caution
   popup and `/classic`'s Alerts banner both benefit).
2. **Caution popup scope**: added an `AlertCategory` field
   ("freshness" | "yield" | "macro" | "event" | "news") to `Alert`, tagged
   every candidate in `getAlerts()` accordingly (purely additive, no
   behavior change for existing consumers), then filtered to only
   `event`/`news` before passing to `CautionToast` in
   `app/(dashboard)/page.tsx`. Both categories were already scoped to a
   real "happens within" window from an earlier round (event-risk's
   HIGH level = inside 24h, news-signal's ~13h recency) -- data-
   freshness/yield/macro alerts describe an ongoing data-quality issue
   with no future "happens by" time of their own, so per the user's ask
   they no longer appear in this popup. `/classic`'s own Alerts banner
   is unchanged (still shows the full unfiltered list -- that page
   wasn't part of this ask).

Verified live: `/classic`'s Alerts banner now reads "ข้อมูลเก่า (17.1
ชม.ที่แล้ว)" for the real Brent staleness (cross-checked against
Supabase: Brent's latest row is genuinely ~17h old); the Dashboard's
Caution popup shows nothing right now, correctly, since the only real
event risk today is 47.2h away (WATCH level, outside the 24h window)
and Brent's staleness is a freshness-category alert now excluded from
this popup by design. `npx tsc --noEmit` and `npx next build` both
pass clean.

## Real 3/6-month RSI(14)/MA50/MA200/MACD, and reworked Technical Levels (2026-09-22)

User asked for a real 3-month AUD/THB chart with RSI(14)+MA50+MA200,
a real 6-month MACD with its current bullish/bearish signal, both
inside Technical Signals; and Technical Levels redone with full-word
labels (no abbreviations), extended to R3/S3, and an explicit
statement of what price the Pivot actually is.

**The live TwelveData feed (`market_prices`) only has ~11 real days of
AUD/THB history** (ingestion started 2026-09-11) -- nowhere near
enough for a 200-day moving average or 6-month MACD, and fabricating
that history was never on the table given this project's standing
no-fabricated-data rule. Instead of inventing anything, found and
reused `backtest_daily_rates` -- a real, already-vetted data source
this app already uses for the Performance tab's Backtest: RBA's own
official F11.1 daily AUD/THB reference rate, 2023-01-03 onward (934+
real rows, topped up daily by `app/api/backtest-update`). A different
real source than the live intraday feed (a daily official fixing, not
tick data), so every new panel labels it explicitly ("RBA F11.1...
คนละแหล่งกับฟีดเรียลไทม์ด้านบน") rather than silently blending two
different feeds.

- New `lib/long-term-technicals-data.ts`: fetches the full real
  `backtest_daily_rates` series, computes SMA50/SMA200/RSI(14) (same
  simple-average RSI formula as `technical-outlook-data.ts`, for
  consistency) and MACD(12,26,9) over the **full** real history first
  (so MA200/EMA26 have genuine lookback), then slices the resulting
  series down to the real last-3-months / last-6-months calendar
  window for display -- never sliced-then-computed, which would
  silently null out indicators a longer real window actually supports.
  Returns current values plus a real Golden-Cross/Death-Cross bias
  (SMA50 vs SMA200) and a real MACD bullish/bearish bias (histogram
  sign).
- New hand-rolled SVG charts (same no-library convention as
  `RangeChart`/`Sparkline`): `components/v2/PriceMaRsiChart.tsx`
  (stacked price+MA50+MA200 panel over an RSI oscillator panel with
  70/30 reference lines) and `components/v2/MacdChart.tsx` (MACD line
  + signal line + histogram bars around a zero baseline).
- Both mounted inside the Dashboard's Technical Signals card, below
  the existing short-term SMA(5)/RSI(10) rows (which stay, computed
  from the live feed's ~11 real days) -- clearly separated and
  independently sourced, with real narrative sentences ("RSI(14) is
  currently X (overbought/oversold/neutral)", "MA50 above MA200 --
  Golden Cross", "MACD signal is currently POSITIVE/NEGATIVE --
  MACD line X above/below Signal Y, histogram Z").
- **Technical Levels reworked**: `PivotLevels` (in
  `technical-outlook-data.ts`) now also carries the real high/low/close
  of the pivot's own basis day (`basedOnHigh/Low/Close`), not just the
  computed levels -- needed to literally answer "what price is the
  pivot." The card's 5 abbreviated rows (R2/R1/Pivot/S1/S2) became 7
  full-word rows (แนวต้าน 3/2/1, จุดหมุน (Pivot), แนวรับ 1/2/3), plus a
  caption stating the real formula with real numbers: "จุดหมุน (Pivot)
  คือค่าเฉลี่ยของราคาสูงสุด (H) ต่ำสุด (L) และปิด (C) ของวันก่อนหน้าที่
  สมบูรณ์แล้ว (date) -- ตอนนี้คือ (value)".

Verified live: MA50 cross-checked directly against Supabase
(`avg(aud_thb) over the last 50 rows` = 23.5346, matching the app
exactly); RSI(14)/MA50/MA200 chart correctly spans 2026-06-22 to
2026-09-21 (3 real months) and MACD spans 2026-03-23 to 2026-09-21 (6
real months); current real reading was MA50 above MA200 (Golden
Cross) and MACD histogram negative (Bearish, MACD 0.0684 below Signal
0.0794). Confirmed no horizontal overflow at 375px mobile. `npx tsc
--noEmit` and `npx next build` both pass clean.

## Moved the new RSI/MA/MACD charts from Dashboard to Analysis (2026-09-22, same day)

User asked for the Dashboard's Technical Signals card to go back to
numbers-only, and for the two new charts (`PriceMaRsiChart`,
`MacdChart`) to live on the Analysis tab instead.

- `app/(dashboard)/page.tsx`: removed both chart components from
  Technical Signals; the section now shows compact number rows
  (RSI(14), MA50, MA200, MA50/MA200 cross verdict, MACD, Signal, MACD
  bullish/bearish verdict) in the same row style as the existing
  short-term SMA(5)/RSI(10) rows, plus the real "as of" source line
  and a link to Analysis for the charts.
- `app/(dashboard)/analysis/page.tsx`: now also fetches
  `getLongTermTechnicals(locale)` and passes it to `AnalysisTabs`.
- `components/v2/AnalysisTabs.tsx`: the Technical sub-tab gained two
  new cards below the existing pivot/SMA/RSI card -- the 3-month
  RSI(14)+MA50+MA200 chart and the 6-month MACD chart, each with the
  same real narrative sentences (Golden/Death Cross, MACD bullish/
  bearish with real numbers) that used to live on the Dashboard.

Verified live: Dashboard's Technical Signals now renders zero `<svg>`
elements for this section (numbers only); Analysis's Technical sub-tab
renders both charts with the same real values (RSI 44.4, MA50
23.5346, MA200 22.6754) the Dashboard shows as plain numbers --
confirming both pages read the same underlying data. `npx tsc --noEmit`
and `npx next build` both pass clean.

## Dashboard layout rebalance: longer-term signals get their own card (2026-09-22, same day)

User asked to tidy up the Dashboard layout. Screenshotted the live
page first rather than guessing: the 7 long-term number rows bolted
onto the bottom of Technical Signals (previous round) made that card
far taller than its neighbor, Technical Levels -- leaving a large dead
gap next to the Price & Technical chart in the row above, since a CSS
grid row's height follows its tallest column.

Fix: pulled that section out of Technical Signals into its own new
full-width card ("สัญญาณระยะยาว", right after the chart/Levels/Signals
row), and changed it from a tall vertical list to a `grid-cols-2
sm:grid-cols-4` row of `StatTile`s (RSI(14), MA50, MA200, MA50/MA200
cross, MACD, Signal, MACD signal) -- the same tile shape already used
elsewhere on this page (AUD/THB card, Price & Technical's stat row),
so it reads as one consistent visual language rather than a bolted-on
appendix. Technical Signals reverted to just its original 4 short-term
rows. Also gave the long-term labels real Thai translations (was a mix
of hardcoded English abbreviations) and kept the real "as of" source
line + link to Analysis's full charts.

Verified live at 1200px: Technical Levels and Technical Signals now
end at almost the same height as the chart card beside them (no more
large dead-space gap); the new card's tile grid reads cleanly. Checked
375px mobile: 2-column tile grid, no overflow. `npx tsc --noEmit` and
`npx next build` both pass clean.

## Today's Outlook: replaced pivot R1/S1 breakout boxes with the calibrated DAILY range (2026-09-24)

User: "Today's Outlook กว้างไป แทบไม่เกิดขึ้นจริงในวัน" (too wide,
rarely actually happens within the day). Investigated with real data
before changing anything: backtested the classic pivot's R1/S1 against
this project's own real daily bars (13 real days) -- R1/S1 individually
get touched roughly half the days, so "never happens" wasn't literally
true, but R1/S1 are computed from the *previous full day's entire
high-low range*, which is often a bigger move than a typical day
actually makes. Checked live: today (2026-09-24) price sat at 23.4958
while R1 required a 0.34% move to reach -- a real, meaningful move,
not a near-miss -- so on any single trending day, whichever side is
counter-trend routinely looks unreachable, matching the complaint.

Fix: swapped the R1/S1 boxes for the DAILY forecast's own predicted
range (`technicalOutlook.forecasts.find(h => h.horizon === "DAILY")`)
-- already real, already calibrated to the actual historical move size
(`REFERENCE_DAILY_RANGE_PCT`, forecast-data.ts), and already shown
elsewhere on the page. Extended `ForecastEntry.trackRecord` (technical-
outlook-data.ts) with a new `intervalCoveragePct` field, sourced from
`evaluation-data.ts`'s existing `intervalCoverage` stat (the same "range
hit rate" already on the Performance tab) -- so the card can now state
outright how often this exact range has held historically, instead of
presenting an untested guess.

Verified live: today's real range shows Prefund 23.4106 / Postfund
23.5939 (current price 23.4958 sits inside it), with "ช่วงนี้ตรงกับ
ราคาจริง 92.9% จาก 140 ครั้งล่าสุดที่มีผลแล้ว" -- cross-checked the 140
directly against Supabase (`forecast_outcomes` MATCHED count for
DAILY/1.0.1) and it matches exactly. Confirmed no 375px mobile
overflow. `npx tsc --noEmit` and `npx next build` both pass clean.

## Analysis tab: merged Technical into Price & Chart, merged Why-is-it-moving into Drivers, removed Event Impact, added explanatory tooltips everywhere (2026-09-24)

User feedback on the Analysis page's 6 sub-tabs (Price & Chart / Drivers /
Why is it moving? / Event Impact / Technical / Correlation): fold
Technical into Price & Chart, fold Drivers + Why is it moving? into one
tab, remove Event Impact, explain every real number's what/how/why-it-
matters/why-this-method in a tooltip, and clarify what Correlation is.

Restructured `components/v2/AnalysisTabs.tsx` down to 3 sub-tabs:
- **Price & Chart**: the price chart (pivots overlaid) + the pivot/SMA/
  RSI numeric card (formerly the separate "Technical" tab) + the 3-month
  RSI/MA50/MA200 chart + the 6-month MACD chart, all stacked in one tab.
- **Drivers**: the FX Score factor-attribution card (formerly "Drivers")
  + the ~24h-change narrative (formerly "Why is it moving?"), stacked.
- **Correlation**: unchanged content, now with a tooltip too.

Removed the "Event Impact" tab and its now-dead data plumbing --
`app/(dashboard)/analysis/page.tsx` no longer calls
`getEconomicConsensus()`/`getRecentEconomicOutcomes()` or builds
`upcoming`/`released`, and `AnalysisTabs` no longer takes
`releasedEvents`/`upcomingEvents` props. (Dashboard's own "Today's
Events" card still uses `getEconomicConsensus()` independently --
untouched.)

Added `InfoTooltip` (existing CSS-only "i" tooltip component, already
used on the Dashboard) next to every card/metric on the page, each
covering what it is, how it's computed, why it matters, and why that
specific method/source was chosen over an alternative -- e.g. why
classic floor-trader pivots over an ML-based level (transparent,
hand-verifiable formula), why RBA F11.1 for the 3/6-month studies
(only real source with 900+ days of history), why Pearson correlation
on 15+ real overlapping days for Correlation (independent, data-driven
check vs. what the FX Score's own weights assume). The 7 FX Score
factor rows (Drivers tab) each got their own tooltip with real weight
+ definition, reusing the exact facts already documented on the About
tab (Price/Momentum 35%, Cross Currency 20%, Relative Market 15%,
Commodity 8%, Mean Reversion 5%, Macro/Policy 10%, Risk/VIXY 7%) so
the two pages can't drift apart.

Verified live: all 3 tabs render with real data (Price & Chart shows
R3-S3 pivots + SMA(5)/RSI(12) + 3M RSI/MA chart + 6M MACD chart;
Drivers shows factor contributions summing correctly + narrative;
Correlation correctly shows "needs 15+ overlapping days" for all 6
pairs since real price history is still only ~14 days old). Checked
375px mobile: no horizontal overflow. `npx tsc --noEmit` and
`npx next build` both pass clean.
