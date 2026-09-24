-- Distinguishes forecast_runs rows written by the live hourly cron from
-- rows seeded by a one-time historical backfill script (see
-- AUDTHB-project-status.md's 2026-09-20 / 2026-09-24 backfill entries).
--
-- Both `issued_at` and `created_at` default to now() at insert time
-- (20260917_create_forecast_runs_and_outcomes.sql), so a live cron row
-- always has the two nearly identical (both set in the same request).
-- A backfill script instead explicitly sets `issued_at` to a past
-- run_slot while `created_at` still defaults to the backfill's own
-- (recent) run time -- a real, structural gap, not a fragile heuristic.
--
-- Why this matters: forecast-data.ts's calibratedSlope/calibratedIntercept
-- were fit by regressing actual_move_pct on core_fx_score over the same
-- historical fx_score_snapshots rows that every backfill replays. Grading
-- the model against backfilled outcomes is therefore in-sample (like
-- reporting training accuracy for a fitted regression), not a genuine
-- out-of-sample measurement. lib/evaluation-data.ts uses this column to
-- report a second, honest "out of sample" accuracy computed only from
-- rows the live cron produced after that fit.
alter table public.forecast_runs
  add column if not exists is_backfilled boolean not null default false;

update public.forecast_runs
set is_backfilled = true
where created_at - issued_at > interval '1 hour';

comment on column public.forecast_runs.is_backfilled is
  'True for rows inserted by a one-time historical backfill script rather than the live hourly score-snapshot cron. See lib/evaluation-data.ts outOfSample stats.';
