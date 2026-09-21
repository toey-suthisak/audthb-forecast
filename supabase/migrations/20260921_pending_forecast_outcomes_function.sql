-- Bug found 2026-09-21: /api/forecast-outcome fetched the oldest
-- BATCH_LIMIT (100) due forecast_runs (ORDER BY target_time ASC LIMIT
-- 100), then filtered out the ones that already had an outcome row
-- client-side, AFTER the limit was applied. Once more than 100 due
-- forecast_runs existed and the oldest 100 were all already matched
-- (true since the 2026-09-20 ~10:35 UTC backfill), every hourly cron
-- run kept re-fetching that same fully-matched oldest slice, found
-- nothing pending in it, and did nothing -- even though 70+ newer
-- forecast_runs (2026-09-19 07:00 UTC onward) sat completely
-- unprocessed. This is why "Recent Forecast History" on the
-- Performance tab appeared stuck around 19/09.
--
-- Fix: exclude already-matched forecast_runs *in the query itself*
-- (NOT EXISTS), before LIMIT is applied, so a full oldest-100 page can
-- never be "already handled" -- it only ever contains genuinely
-- pending rows, matching the daily-bars aggregation convention already
-- used by get_daily_price_bars (do the exclusion/aggregation in SQL,
-- not after paging in the client).
create or replace function public.get_pending_forecast_outcomes(p_before timestamptz, p_limit int)
returns table (
  id bigint,
  target_time timestamptz,
  reference_rate numeric,
  predicted_move_pct numeric
)
language sql
stable
as $$
  select fr.id, fr.target_time, fr.reference_rate, fr.predicted_move_pct
  from public.forecast_runs fr
  where fr.target_time <= p_before
    and not exists (
      select 1 from public.forecast_outcomes fo where fo.forecast_run_id = fr.id
    )
  order by fr.target_time asc
  limit p_limit;
$$;
