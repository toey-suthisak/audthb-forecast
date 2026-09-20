import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

// Reads public.get_cron_job_status()/get_recent_http_errors(), two
// SECURITY DEFINER functions (see
// supabase/migrations/20260920_create_cron_health_functions.sql) that
// bridge into pg_cron/pg_net's own tables -- schemas PostgREST doesn't
// expose directly, so this can't be a plain .from() query.
//
// last_run_status only reflects whether the SQL command (net.http_get)
// executed without error -- NOT whether the HTTP call it dispatched got a
// 2xx back. recentErrors is the actual ground truth: real failures
// (non-2xx responses or timeouts) surface there even when every job
// above reports "succeeded".
export type CronJobStatus = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
};

export type RecentHttpError = {
  id: number;
  statusCode: number | null;
  content: string | null;
  timedOut: boolean;
  errorMsg: string | null;
  createdAt: string;
};

export type CronHealthSummary = {
  jobs: CronJobStatus[];
  recentErrors: RecentHttpError[];
  error: string | null;
};

type JobRow = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
};

type ErrorRow = {
  id: number;
  status_code: number | null;
  content: string | null;
  timed_out: boolean;
  error_msg: string | null;
  created: string;
};

export async function getCronHealth(): Promise<CronHealthSummary> {
  const [jobsResult, errorsResult] = await Promise.all([
    supabaseAdmin.rpc("get_cron_job_status"),
    supabaseAdmin.rpc("get_recent_http_errors"),
  ]);

  if (jobsResult.error) {
    return { jobs: [], recentErrors: [], error: `Cron job query failed: ${jobsResult.error.message}` };
  }

  if (errorsResult.error) {
    return { jobs: [], recentErrors: [], error: `HTTP error query failed: ${errorsResult.error.message}` };
  }

  const jobs = ((jobsResult.data ?? []) as JobRow[]).map((j) => ({
    jobid: j.jobid,
    jobname: j.jobname,
    schedule: j.schedule,
    active: j.active,
    lastRunAt: j.last_run_at,
    lastRunStatus: j.last_run_status,
  }));

  const recentErrors = ((errorsResult.data ?? []) as ErrorRow[]).map((e) => ({
    id: e.id,
    statusCode: e.status_code,
    content: e.content,
    timedOut: e.timed_out,
    errorMsg: e.error_msg,
    createdAt: e.created,
  }));

  return { jobs, recentErrors, error: null };
}
