-- Cron/job health visibility (see AUDTHB-project-status.md's "No dedicated
-- cron-execution-log table exists" gap). pg_cron and pg_net already keep
-- this data (cron.job_run_details, net._http_response), but both live in
-- schemas PostgREST doesn't expose, so the app can't read them directly via
-- supabaseAdmin. These two SECURITY DEFINER functions re-expose just what's
-- needed, with search_path pinned (same convention as
-- 20260919_secure_api_usage_table.sql's increment_api_usage fix) and
-- EXECUTE restricted to service_role only.
--
-- Already applied directly against the project via the Supabase MCP tool
-- (three passes: first as plain views, which the Supabase linter correctly
-- flagged as an ERROR -- "Security Definer View", since a plain view runs
-- with its OWNER's privileges for every grantee, an easy-to-miss footgun.
-- Replaced with explicit SECURITY DEFINER functions instead, which is this
-- project's already-established pattern for the same problem. A second
-- pass was needed because Supabase's default privileges auto-grant EXECUTE
-- on new public-schema functions to anon/authenticated regardless of
-- `revoke ... from public` -- caught by the WARN-level
-- anon/authenticated_security_definer_function_executable advisories,
-- fixed by revoking from anon/authenticated explicitly, not just PUBLIC).
-- This file documents the final state, same convention as this repo's
-- other migrations.
--
-- cron.job_run_details.status only means "the SQL command (net.http_get)
-- executed without error" -- it does NOT mean the HTTP call it dispatched
-- got a 2xx back. That's what get_recent_http_errors is for: a real 500
-- was found there once (yahoo-reference, "JWT issued at future") that
-- job_run_details had reported as a plain "succeeded".
create or replace function public.get_cron_job_status()
returns table (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_run_status text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    d.last_run_at,
    d.last_run_status
  from cron.job j
  left join lateral (
    select start_time as last_run_at, status as last_run_status
    from cron.job_run_details
    where jobid = j.jobid
    order by start_time desc
    limit 1
  ) d on true
  order by j.jobid;
$$;

create or replace function public.get_recent_http_errors()
returns table (
  id bigint,
  status_code integer,
  content text,
  timed_out boolean,
  error_msg text,
  created timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select id, status_code, content, timed_out, error_msg, created
  from net._http_response
  where created > now() - interval '7 days'
    and (status_code is null or status_code >= 400 or timed_out)
  order by created desc
  limit 50;
$$;

revoke execute on function public.get_cron_job_status() from anon, authenticated, public;
revoke execute on function public.get_recent_http_errors() from anon, authenticated, public;
grant execute on function public.get_cron_job_status() to service_role;
grant execute on function public.get_recent_http_errors() to service_role;
