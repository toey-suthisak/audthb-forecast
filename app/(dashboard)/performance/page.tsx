import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";
import { getEvaluationSummary } from "@/lib/evaluation-data";
import { getBacktestSummary } from "@/lib/backtest-data";
import { getForecastHistory } from "@/lib/forecast-history-data";
import { FORECAST_HORIZONS, FORECAST_VERSION } from "@/lib/forecast-data";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    title: "Forecast Performance",
    subtitle: "How accurate has this project's own Forecast engine actually been -- measured against a naive baseline.",
    trackRecord: "Track Record",
    accuracy: "Direction Accuracy",
    vsBaseline: (pct: string) => `vs. ${pct}% baseline`,
    avgError: "Avg. Error",
    rangeHit: "Range Hit Rate",
    totalForecasts: "Total Forecasts",
    notEnough: (n: number, min: number) => `Not enough resolved forecasts yet (${n}/${min}).`,
    chart: (h: string) => `Forecast vs. Actual (${h})`,
    chartLegendPredicted: "Predicted",
    chartLegendActual: "Actual",
    noHistory: "No resolved forecasts yet for this horizon.",
    recentHistory: "Recent Forecast History",
    colTime: "Time",
    colHorizon: "Horizon",
    colPredicted: "Predicted Range",
    colActual: "Actual",
    colResult: "Result",
    inRange: "In Range",
    outOfRange: "Out of Range",
    backtest: "Backtest",
    backtestNote: (from: string, to: string, source: string, n: number) =>
      `A different question from Track Record above -- historical price-only strategies replayed against ${source} (${from} to ${to}, ${n} trading days), not a real-time replay of Core FX Score.`,
    baseline: "Baseline (No Change)",
    beatsBaseline: "Beats baseline",
    yes: "Yes",
    no: "No",
  },
  th: {
    title: "ผลงานการพยากรณ์",
    subtitle: "Forecast engine ของโปรเจคนี้แม่นยำแค่ไหนจริงๆ เทียบกับ baseline แบบไม่ทำอะไรเลย",
    trackRecord: "Track Record",
    accuracy: "ความแม่นยำทิศทาง",
    vsBaseline: (pct: string) => `เทียบ baseline ${pct}%`,
    avgError: "ค่าคลาดเคลื่อนเฉลี่ย",
    rangeHit: "อยู่ในช่วงที่พยากรณ์",
    totalForecasts: "จำนวนพยากรณ์ทั้งหมด",
    notEnough: (n: number, min: number) => `ยังมีผลลัพธ์ไม่พอ (${n}/${min})`,
    chart: (h: string) => `พยากรณ์ vs ตัวเลขจริง (${h})`,
    chartLegendPredicted: "พยากรณ์",
    chartLegendActual: "จริง",
    noHistory: "ยังไม่มีผลพยากรณ์ที่จับคู่ได้สำหรับกรอบเวลานี้",
    recentHistory: "ประวัติการพยากรณ์ล่าสุด",
    colTime: "เวลา",
    colHorizon: "กรอบเวลา",
    colPredicted: "ช่วงที่พยากรณ์",
    colActual: "ตัวเลขจริง",
    colResult: "ผลลัพธ์",
    inRange: "อยู่ในช่วง",
    outOfRange: "หลุดช่วง",
    backtest: "Backtest",
    backtestNote: (from: string, to: string, source: string, n: number) =>
      `คนละคำถามกับ Track Record ด้านบน -- ทดสอบกลยุทธ์ที่ใช้แค่ราคาย้อนหลังกับ ${source} (${from} ถึง ${to}, ${n} วันซื้อขาย) ไม่ใช่การเล่นซ้ำ Core FX Score แบบเรียลไทม์`,
    baseline: "Baseline (ไม่เปลี่ยนแปลง)",
    beatsBaseline: "ชนะ Baseline",
    yes: "ใช่",
    no: "ไม่ใช่",
  },
} as const;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const CHART_W = 560;
const CHART_H = 180;

function ForecastVsActualChart({
  rows,
  t,
}: {
  rows: { targetTime: string; predictedRate: number; actualRate: number }[];
  t: (typeof STR)[Locale];
}) {
  if (rows.length < 2) {
    return <p className="text-sm text-v2-muted">{t.noHistory}</p>;
  }

  const chronological = [...rows].reverse();
  const allValues = chronological.flatMap((r) => [r.predictedRate, r.actualRate]);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = (rawMax - rawMin) * 0.1 || 0.01;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;
  const stepX = CHART_W / (chronological.length - 1);
  const yFor = (v: number) => CHART_H - ((v - min) / span) * CHART_H;

  const pathFor = (key: "predictedRate" | "actualRate") =>
    chronological.map((r, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${yFor(r[key]).toFixed(1)}`).join(" ");

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs">
        <span className="inline-flex items-center gap-1.5 text-v2-muted">
          <span className="inline-block w-3 h-0.5 bg-slate-400" /> {t.chartLegendPredicted}
        </span>
        <span className="inline-flex items-center gap-1.5 text-v2-muted">
          <span className="inline-block w-3 h-0.5 bg-blue-600" /> {t.chartLegendActual}
        </span>
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="w-full h-[180px]">
        <path d={pathFor("predictedRate")} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" className="text-slate-400" />
        <path d={pathFor("actualRate")} fill="none" stroke="currentColor" strokeWidth={2} className="text-blue-600 dark:text-blue-400" />
      </svg>
    </div>
  );
}

export default async function PerformancePage() {
  const locale = await getLocale();
  const t = STR[locale];

  const [evaluation, backtest, dailyHistory] = await Promise.all([
    getEvaluationSummary(),
    getBacktestSummary(locale),
    getForecastHistory("DAILY", 14),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-v2-foreground">{t.title}</h1>
        <p className="text-sm text-v2-muted mt-1">{t.subtitle}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {FORECAST_HORIZONS.map((horizon) => {
          const group = evaluation.groups.find((g) => g.horizon === horizon && g.forecastVersion === FORECAST_VERSION);

          return (
            <Card key={horizon} title={`${horizon} ${t.trackRecord}`}>
              {!group || group.insufficientData ? (
                <p className="text-sm text-v2-muted">{t.notEnough(group?.sampleSize ?? 0, group?.minSampleSize ?? 20)}</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-v2-muted">{t.accuracy}</p>
                    <p className="font-mono text-2xl font-semibold text-v2-foreground">
                      {((group.model.directionalAccuracy ?? 0) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-v2-muted">
                      {t.vsBaseline(((group.baselineNoChange.directionalAccuracy ?? 0) * 100).toFixed(0))}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-v2-muted">{t.avgError}</span>
                    <span className="font-mono text-v2-foreground">{(group.model.mae ?? 0).toFixed(3)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-v2-muted">{t.rangeHit}</span>
                    <span className="font-mono text-v2-foreground">{((group.model.intervalCoverage ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-v2-muted">{t.totalForecasts}</span>
                    <span className="font-mono text-v2-foreground">{group.sampleSize}</span>
                  </div>
                  <BadgeChip
                    label={`${t.beatsBaseline}: ${group.beatsBaseline.directionally ? t.yes : t.no}`}
                    tone={group.beatsBaseline.directionally ? "emerald" : "red"}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={t.chart("DAILY")}>
          <ForecastVsActualChart rows={dailyHistory.rows} t={t} />
        </Card>

        <Card title={t.recentHistory} padded={false}>
          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-v2-surface">
                <tr className="text-left text-v2-muted border-b border-v2-border">
                  <th className="px-4 py-2 font-medium">{t.colTime}</th>
                  <th className="px-4 py-2 font-medium">{t.colPredicted}</th>
                  <th className="px-4 py-2 font-medium">{t.colActual}</th>
                  <th className="px-4 py-2 font-medium">{t.colResult}</th>
                </tr>
              </thead>
              <tbody>
                {dailyHistory.rows.map((row) => (
                  <tr key={row.targetTime} className="border-b border-v2-border last:border-b-0">
                    <td className="px-4 py-2 text-v2-muted whitespace-nowrap">{fmtTime(row.targetTime)}</td>
                    <td className="px-4 py-2 font-mono text-v2-foreground whitespace-nowrap">
                      {row.rangeLowRate.toFixed(4)}-{row.rangeHighRate.toFixed(4)}
                    </td>
                    <td className="px-4 py-2 font-mono text-v2-foreground">{row.actualRate.toFixed(4)}</td>
                    <td className="px-4 py-2">
                      <BadgeChip label={row.inRange ? t.inRange : t.outOfRange} tone={row.inRange ? "emerald" : "red"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title={t.backtest}>
        {backtest.error || backtest.sampleSize === 0 ? (
          <p className="text-sm text-v2-muted">{backtest.error ?? "--"}</p>
        ) : (
          <>
            <p className="text-xs text-v2-muted mb-4">
              {t.backtestNote(backtest.dataFrom, backtest.dataTo, backtest.dataSource, backtest.sampleSize)}
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-v2-muted">{t.baseline}</p>
                <p className="font-mono text-lg font-semibold text-v2-foreground">
                  {(backtest.baseline.directionalAccuracy * 100).toFixed(1)}%
                </p>
              </div>
              {backtest.strategies.map((s) => (
                <div key={s.name}>
                  <p className="text-xs text-v2-muted">{s.name}</p>
                  <p
                    className={`font-mono text-lg font-semibold ${
                      s.directionalAccuracy < 0.5 ? "text-red-600 dark:text-red-400" : "text-v2-foreground"
                    }`}
                  >
                    {(s.directionalAccuracy * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
