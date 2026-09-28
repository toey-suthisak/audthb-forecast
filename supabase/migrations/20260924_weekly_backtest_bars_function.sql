-- Weekly-timeframe chart/pivot source. backtest_daily_rates (RBA F11.1,
-- 2023 onward, real daily reference rates) is the only real source with
-- enough depth for a meaningful weekly view -- the live AUD/THB feed
-- only goes back to 2026-09-11 (~2 real weeks), same reasoning already
-- used for the 3-month/6-month RSI/MA/MACD charts on Analysis. Currently
-- 937 rows and growing ~1/weekday -- aggregating server-side avoids ever
-- crossing PostgREST's 1000-row cap, the same class of bug found and
-- fixed elsewhere in forecast_outcomes this session, before it has a
-- chance to bite here too.
create or replace function public.get_weekly_backtest_bars(p_since date default '2000-01-01')
returns table (week_start date, open numeric, high numeric, low numeric, close numeric)
language sql
stable
as $$
  select
    date_trunc('week', rate_date)::date as week_start,
    (array_agg(aud_thb order by rate_date asc))[1] as open,
    max(aud_thb) as high,
    min(aud_thb) as low,
    (array_agg(aud_thb order by rate_date desc))[1] as close
  from public.backtest_daily_rates
  where rate_date >= p_since
  group by 1
  order by 1;
$$;
