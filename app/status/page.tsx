import Link from "next/link";
import { getCronHealth } from "@/lib/cron-health-data";
import StatusBadge from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";
import InfoTip from "@/components/InfoTip";
import MarketClock from "@/components/MarketClock";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STR = {
  en: {
    title: "System Status",
    subtitle: "Are the scheduled data jobs behind this dashboard actually running?",
    scheduledJobs: "Scheduled Jobs",
    scheduledJobsTooltip:
      "'Succeeded' only means the scheduled call was dispatched without a database error -- it does not confirm the endpoint it called actually returned success. See Recent HTTP Errors below for the real failure signal.",
    jobsRegistered: (n: number) => `${n} jobs registered in Supabase Cron`,
    disabled: "Disabled",
    neverRun: "never run",
    recentErrors: "Recent HTTP Errors",
    recentErrorsTooltip:
      "Real non-2xx responses or timeouts from the last 7 days, read directly from pg_net's own response log -- the ground truth the job list above can't show on its own.",
    noErrors: "No errors in the last 7 days -- every dispatched request got a normal response.",
    timedOut: "Timed out",
    noResponseBody: "(no response body)",
    footer:
      "Data: cron.job_run_details and net._http_response, read via two SECURITY DEFINER functions (see supabase/migrations/20260920_create_cron_health_functions.sql). Operational detail, not a market signal -- unrelated to the Core FX Score or Track Record.",
    never: "never",
    justNow: "just now",
    minAgo: (n: number) => `${n} min ago`,
    hAgo: (n: number) => `${n}h ago`,
    dAgo: (n: number) => `${n}d ago`,
  },
  th: {
    title: "สถานะระบบ",
    subtitle: "งานที่ตั้งเวลาทำงานอัตโนมัติเบื้องหลังแดชบอร์ดนี้ทำงานอยู่จริงไหม?",
    scheduledJobs: "งานที่ตั้งเวลาไว้",
    scheduledJobsTooltip:
      "'สำเร็จ' หมายความแค่ว่าการเรียกที่ตั้งเวลาไว้ถูกส่งออกไปโดยไม่มี database error -- ไม่ได้ยืนยันว่า endpoint ที่เรียกนั้นส่งค่ากลับสำเร็จจริง ดู Recent HTTP Errors ด้านล่างสำหรับสัญญาณความล้มเหลวที่แท้จริง",
    jobsRegistered: (n: number) => `มี ${n} งานลงทะเบียนไว้ใน Supabase Cron`,
    disabled: "ปิดใช้งาน",
    neverRun: "ไม่เคยรัน",
    recentErrors: "HTTP Error ล่าสุด",
    recentErrorsTooltip:
      "การตอบกลับที่ไม่ใช่ 2xx จริง หรือ timeout ใน 7 วันที่ผ่านมา อ่านตรงจาก response log ของ pg_net เอง -- เป็นความจริงที่รายการงานด้านบนแสดงเองไม่ได้",
    noErrors: "ไม่มี error ใน 7 วันที่ผ่านมา -- ทุกคำขอที่ส่งออกไปได้รับการตอบกลับปกติ",
    timedOut: "หมดเวลา",
    noResponseBody: "(ไม่มีเนื้อหาตอบกลับ)",
    footer:
      "ข้อมูล: cron.job_run_details และ net._http_response อ่านผ่านฟังก์ชัน SECURITY DEFINER สองตัว (ดู supabase/migrations/20260920_create_cron_health_functions.sql) เป็นรายละเอียดการทำงาน ไม่ใช่สัญญาณตลาด -- ไม่เกี่ยวกับ Core FX Score หรือ Track Record",
    never: "ไม่เคย",
    justNow: "เมื่อสักครู่",
    minAgo: (n: number) => `${n} นาทีที่แล้ว`,
    hAgo: (n: number) => `${n} ชม.ที่แล้ว`,
    dAgo: (n: number) => `${n} วันที่แล้ว`,
  },
} as const;

function relativeTime(iso: string | null, t: (typeof STR)[Locale]): string {
  if (!iso) return t.never;
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minAgo(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t.hAgo(hours);
  const days = Math.round(hours / 24);
  return t.dAgo(days);
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
  const locale = await getLocale();
  const t = STR[locale];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-masthead border-b border-brass-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
              &larr; AUD/THB Forecast Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">{t.title}</h1>
            <p className="text-stone-400 mt-1 text-sm sm:text-base">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <MarketClock variant="inverted" locale={locale} />
            <div className="flex items-center gap-2">
              <LanguageToggle locale={locale} variant="inverted" />
              <ThemeToggle variant="inverted" />
            </div>
          </div>
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
                  {t.scheduledJobs}
                  <InfoTip text={t.scheduledJobsTooltip} />
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                  {t.jobsRegistered(health.jobs.length)}
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
                      {!job.active && <StatusBadge label={t.disabled} tone="amber" />}
                      <div className="text-right">
                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          {job.lastRunAt ? `${relativeTime(job.lastRunAt, t)} (${absoluteTime(job.lastRunAt)})` : t.neverRun}
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
                {t.recentErrors}
                <InfoTip text={t.recentErrorsTooltip} />
              </h2>

              {health.recentErrors.length === 0 ? (
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">
                  {t.noErrors}
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {health.recentErrors.map((err) => (
                    <div key={err.id} className="rounded-md bg-inset p-3">
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge
                          label={err.timedOut ? t.timedOut : `HTTP ${err.statusCode ?? "?"}`}
                          tone={httpErrorTone(err.statusCode, err.timedOut)}
                        />
                        <p className="text-xs text-stone-600 dark:text-stone-400">{absoluteTime(err.createdAt)}</p>
                      </div>
                      <pre className="text-[11px] text-stone-600 dark:text-stone-400 mt-2 whitespace-pre-wrap break-words">
                        {err.errorMsg ?? err.content ?? t.noResponseBody}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-6 leading-relaxed">
          {locale === "th" ? (
            <>
              ข้อมูล: <code className="text-[11px]">cron.job_run_details</code> และ{" "}
              <code className="text-[11px]">net._http_response</code> อ่านผ่านฟังก์ชัน SECURITY DEFINER สองตัว (ดู{" "}
              <code className="text-[11px]">supabase/migrations/20260920_create_cron_health_functions.sql</code>) เป็นรายละเอียดการทำงาน
              ไม่ใช่สัญญาณตลาด -- ไม่เกี่ยวกับ Core FX Score หรือ Track Record
            </>
          ) : (
            <>
              Data: <code className="text-[11px]">cron.job_run_details</code> and{" "}
              <code className="text-[11px]">net._http_response</code>, read via two SECURITY DEFINER functions (see{" "}
              <code className="text-[11px]">supabase/migrations/20260920_create_cron_health_functions.sql</code>). Operational
              detail, not a market signal -- unrelated to the Core FX Score or Track Record.
            </>
          )}
        </p>
      </div>
    </main>
  );
}
