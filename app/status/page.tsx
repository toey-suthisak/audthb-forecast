import Link from "next/link";
import { getCronHealth } from "@/lib/cron-health-data";
import StatusBadge from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";
import InfoTip from "@/components/InfoTip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function lastRunTone(status: string | null): "emerald" | "red" | "slate" {
  if (status === "succeeded") return "emerald";
  if (status === "failed") return "red";
  return "slate";
}

function httpErrorTone(statusCode: number | null, timedOut: boolean): "red" | "amber" {
  if (timedOut || statusCode === null || statusCode >= 500) return "red";
  return "amber";
}

export default async function StatusPage() {
  const health = await getCronHealth();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-masthead border-b border-brass-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
            &larr; AUD/THB Forecast Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">System Status</h1>
          <p className="text-stone-400 mt-1 text-sm sm:text-base">
            Are the scheduled data jobs behind this dashboard actually running?
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {health.error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{health.error}</p>
        ) : (
          <>
            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface divide-y divide-stone-200 dark:divide-stone-800">
              <div className="p-6">
                <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
                  <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
                  Scheduled Jobs
                  <InfoTip text="'Succeeded' only means the scheduled call was dispatched without a database error -- it does not confirm the endpoint it called actually returned success. See Recent HTTP Errors below for the real failure signal." />
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                  {health.jobs.length} jobs registered in Supabase Cron
                </p>
              </div>

              <div className="divide-y divide-stone-200 dark:divide-stone-800">
                {health.jobs.map((job) => (
                  <div key={job.jobid} className="p-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{job.jobname}</p>
                      <p className="text-xs text-stone-600 dark:text-stone-400 font-mono">{job.schedule}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {!job.active && <StatusBadge label="Disabled" tone="amber" />}
                      <div className="text-right">
                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          {job.lastRunAt ? `${relativeTime(job.lastRunAt)} (${absoluteTime(job.lastRunAt)})` : "never run"}
                        </p>
                      </div>
                      <StatusBadge
                        label={job.lastRunStatus ?? "unknown"}
                        tone={lastRunTone(job.lastRunStatus)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface p-6 mt-6">
              <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
                <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
                Recent HTTP Errors
                <InfoTip text="Real non-2xx responses or timeouts from the last 7 days, read directly from pg_net's own response log -- the ground truth the job list above can't show on its own." />
              </h2>

              {health.recentErrors.length === 0 ? (
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">
                  No errors in the last 7 days -- every dispatched request got a normal response.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {health.recentErrors.map((err) => (
                    <div key={err.id} className="rounded-md bg-inset p-3">
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge
                          label={err.timedOut ? "Timed out" : `HTTP ${err.statusCode ?? "?"}`}
                          tone={httpErrorTone(err.statusCode, err.timedOut)}
                        />
                        <p className="text-xs text-stone-600 dark:text-stone-400">{absoluteTime(err.createdAt)}</p>
                      </div>
                      <pre className="text-[11px] text-stone-600 dark:text-stone-400 mt-2 whitespace-pre-wrap break-words">
                        {err.errorMsg ?? err.content ?? "(no response body)"}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-6 leading-relaxed">
          Data: <code className="text-[11px]">cron.job_run_details</code> and{" "}
          <code className="text-[11px]">net._http_response</code>, read via two SECURITY DEFINER functions (see{" "}
          <code className="text-[11px]">supabase/migrations/20260920_create_cron_health_functions.sql</code>). Operational
          detail, not a market signal -- unrelated to the Core FX Score or Track Record.
        </p>
      </div>
    </main>
  );
}
