-- Technical Outlook needed more real history than the raw market_prices
-- query could give it: PostgREST hard-caps any query at 1000 rows
-- regardless of .limit(), and AUD/THB accumulates ~140 raw ticks/day, so
-- fetching raw ticks only ever reached ~7 days back before truncating.
--
-- Aggregating per Bangkok calendar day *in SQL* sidesteps the cap
-- entirely -- the client gets back one row per day (currently ~10 rows
-- total, growing by 1/day) instead of thousands of raw ticks, however
-- far back p_since asks for. This lets the app compute real moving
-- averages / RSI over a genuine multi-week window once that much real
-- data exists, without ever touching the 1000-row ceiling.
create or replace function public.get_daily_price_bars(p_symbol text, p_since timestamptz)
returns table (bar_date date, open numeric, high numeric, low numeric, close numeric)
language sql
stable
as $$
  select
    (market_timestamp at time zone 'Asia/Bangkok')::date as bar_date,
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
