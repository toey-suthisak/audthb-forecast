-- Generalizes get_daily_price_bars to arbitrary sub-daily bucket sizes
-- (hours), for the 1H/4H multi-timeframe chart + pivot feature. Same
-- reason as get_daily_price_bars: aggregating server-side avoids ever
-- touching PostgREST's 1000-row cap, however far back p_since asks for
-- (p_since is bounded to ~14 real days by the app anyway, but this
-- scales safely regardless). Bucket boundaries are UTC-epoch-aligned
-- (floor(epoch / bucket_seconds) * bucket_seconds), which for a 4-hour
-- bucket lines up with the standard FX 4H-candle convention
-- (00/04/08/12/16/20 UTC) since UNIX epoch is UTC midnight.
create or replace function public.get_hourly_price_bars(p_symbol text, p_since timestamptz, p_bucket_hours int)
returns table (bar_start timestamptz, open numeric, high numeric, low numeric, close numeric)
language sql
stable
as $$
  select
    to_timestamp(floor(extract(epoch from market_timestamp) / (p_bucket_hours * 3600)) * (p_bucket_hours * 3600)) as bar_start,
    (array_agg(rate order by market_timestamp asc))[1] as open,
    max(rate) as high,
    min(rate) as low,
    (array_agg(rate order by market_timestamp desc))[1] as close
  from public.market_prices
  where symbol = p_symbol
    and market_timestamp >= p_since
  group by 1
  order by 1;
$$;
