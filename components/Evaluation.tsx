import { getEvaluationSummary } from "@/lib/evaluation-data";
import InfoTip from "@/components/InfoTip";
import StatusLight from "@/components/StatusLight";
import Figure from "@/components/Figure";
import { tLabel, type Locale } from "@/lib/i18n";

function formatPct(value: number | null) {
  if (value === null) return null;
  return `${Math.round(value * 100)}%`;
}

function formatMae(value: number | null) {
  if (value === null) return null;
  return `${value.toFixed(3)}%`;
}

const STR = {
  en: {
    title: "Track Record",
    titleTooltip:
      "Checks the forecast against what actually happened, and against a plain 'no change' guess. Needs 20+ resolved forecasts before showing real numbers.",
    noneResolved: "No forecasts have resolved yet -- the first ones are 24 hours out, check back tomorrow.",
    resolved: (n: number) => `${n} resolved`,
    moreNeeded: (n: number) => `${n} more resolved forecast${n === 1 ? "" : "s"} needed before this is meaningful.`,
    directionAccuracy: "Direction Accuracy",
    vsBaseline: "vs",
    baseline: "baseline",
    avgError: "Avg Error",
    inRange: "In Predicted Range",
    beatsBaseline: "Beats Baseline",
  },
  th: {
    title: "สถิติผลงาน",
    titleTooltip:
      "ตรวจสอบพยากรณ์เทียบกับสิ่งที่เกิดขึ้นจริง และเทียบกับการทาย 'ไม่เปลี่ยนแปลง' ธรรมดา ต้องมีผลลัพธ์ครบ 20 ครั้งขึ้นไปก่อนถึงจะแสดงตัวเลขจริง",
    noneResolved: "ยังไม่มีพยากรณ์ที่ได้ผลลัพธ์ -- ชุดแรกจะรู้ผลใน 24 ชั่วโมง ลองกลับมาดูพรุ่งนี้",
    resolved: (n: number) => `${n} ครั้ง`,
    moreNeeded: (n: number) => `ต้องการผลลัพธ์อีก ${n} ครั้งก่อนที่ตัวเลขนี้จะมีความหมาย`,
    directionAccuracy: "ความแม่นยำทิศทาง",
    vsBaseline: "เทียบกับ",
    baseline: "baseline",
    avgError: "ค่าคลาดเคลื่อนเฉลี่ย",
    inRange: "อยู่ในช่วงที่พยากรณ์",
    beatsBaseline: "ชนะ Baseline",
  },
} as const;

// Workflow E: once the outcome-matching cron (workflow D) has resolved
// enough forecasts, this shows whether the Forecast engine actually
// beats a naive "predict no change" guess -- the only honest way to
// answer "is this model any good" instead of asserting it.
export default async function Evaluation({ locale }: { locale: Locale }) {
  const summary = await getEvaluationSummary();
  const t = STR[locale];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-emerald-500 dark:text-emerald-400" />
        {t.title}
        <InfoTip text={t.titleTooltip} />
      </h2>

      {summary.error ? (
        <p className="text-sm text-red-700 dark:text-red-400 mt-2">{summary.error}</p>
      ) : summary.groups.length === 0 ? (
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">
          {t.noneResolved}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {summary.groups.map((g) => (
            <div key={`${g.horizon}-${g.forecastVersion}`} className="rounded-md bg-inset p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {g.horizon}{" "}
                  <span className="text-xs font-normal text-stone-600 dark:text-stone-400">v{g.forecastVersion}</span>
                </p>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  {t.resolved(g.sampleSize)}
                </p>
              </div>

              {g.insufficientData ? (
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">
                  {t.moreNeeded(g.minSampleSize - g.sampleSize)}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{t.directionAccuracy}</p>
                    <Figure value={formatPct(g.model.directionalAccuracy)} className="block text-lg font-semibold" />
                    <p className="text-[11px] text-stone-600 dark:text-stone-400">
                      {t.vsBaseline} <Figure value={formatPct(g.baselineNoChange.directionalAccuracy)} /> {t.baseline}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{t.avgError}</p>
                    <Figure value={formatMae(g.model.mae)} className="block text-lg font-semibold" />
                    <p className="text-[11px] text-stone-600 dark:text-stone-400">
                      {t.vsBaseline} <Figure value={formatMae(g.baselineNoChange.mae)} /> {t.baseline}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{t.inRange}</p>
                    <Figure value={formatPct(g.model.intervalCoverage)} className="block text-lg font-semibold" />
                  </div>

                  <div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{t.beatsBaseline}</p>
                    <p
                      className={`text-lg font-semibold ${
                        g.beatsBaseline.directionally
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {g.beatsBaseline.directionally === null ? "--" : tLabel(g.beatsBaseline.directionally ? "Yes" : "No", locale)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
