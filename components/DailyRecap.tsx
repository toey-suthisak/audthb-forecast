import type { DailyRecap } from "@/lib/daily-recap-data";
import type { DashboardData } from "@/lib/dashboard-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import Figure from "@/components/Figure";
import StatusLight from "@/components/StatusLight";
import { tLabel, type Locale } from "@/lib/i18n";

function scoreTextColor(score: number | null) {
  if (score === null) return "text-stone-500";
  if (score >= 15) return "text-emerald-700 dark:text-emerald-400";
  if (score <= -15) return "text-red-700 dark:text-red-400";
  return "text-amber-700 dark:text-amber-400";
}

function biasTone(bias: string): BadgeTone {
  if (bias.includes("Bullish")) return "emerald";
  if (bias.includes("Bearish")) return "red";
  return "slate";
}

function changeColor(value: number | null) {
  if (value === null) return "text-stone-600 dark:text-stone-400";
  if (value > 0) return "text-emerald-700 dark:text-emerald-400";
  if (value < 0) return "text-red-700 dark:text-red-400";
  return "text-stone-600 dark:text-stone-400";
}

const STR = {
  en: {
    title: "Daily Recap",
    noSnapshots: "No price snapshots yet today -- check back after the score-snapshot cron has run.",
    todaySnapshots: (n: number) => `AUD/THB today -- ${n} snapshot${n === 1 ? "" : "s"}`,
    todayChange: (pct: string) => `${pct}% today`,
    open: "Open",
    high: "High",
    low: "Low",
    coreFxScore: "Core FX Score",
    dominantBias: "Dominant bias today",
  },
  th: {
    title: "สรุปรายวัน",
    noSnapshots: "ยังไม่มีข้อมูลราคาวันนี้ -- ลองกลับมาดูใหม่หลัง cron บันทึกคะแนนทำงาน",
    todaySnapshots: (n: number) => `AUD/THB วันนี้ -- ${n} ครั้ง`,
    todayChange: (pct: string) => `${pct}% วันนี้`,
    open: "เปิด",
    high: "สูงสุด",
    low: "ต่ำสุด",
    coreFxScore: "Core FX Score",
    dominantBias: "แนวโน้มหลักวันนี้",
  },
} as const;

// Where today's latest rate sits between today's low and high -- same
// visual language as ScoreGauge, just on the day's own Low..High scale
// instead of -100..+100.
function RangeBar({ min, max, current }: { min: number; max: number; current: number }) {
  const span = max - min || 1;
  const pct = Math.max(0, Math.min(100, ((current - min) / span) * 100));

  return (
    <div className="mt-4">
      <div className="relative h-1.5 rounded-full bg-stone-200 dark:bg-stone-800">
        <div className="absolute inset-y-0 left-0 rounded-full bg-brass-600/40 dark:bg-brass-400/40" style={{ width: `${pct}%` }} />
        <div
          className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-stone-50 dark:border-stone-900 bg-brass-600 dark:bg-brass-400"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-stone-600 dark:text-stone-400 mt-1 font-mono">
        <span>{min.toFixed(4)}</span>
        <span>{max.toFixed(4)}</span>
      </div>
    </div>
  );
}

// Snapshots only land every few minutes, so "latest" out of
// fx_score_snapshots can lag the live tick shown in Hero by that much --
// enough to look like two different prices/scores for the same "now".
// Folding today's live data (data) in here keeps this card in sync with
// Hero: the live rate/score win as the headline, and also widen the
// Open/High/Low range immediately instead of waiting for the next
// snapshot to catch up.
export default function DailyRecap({ recap, data, locale }: { recap: DailyRecap; data: DashboardData; locale: Locale }) {
  const t = STR[locale];
  const liveRate = data.latestPrice ? Number(data.latestPrice.rate) : null;
  const liveScore = data.coreFxScore;

  if (recap.sampleSize === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
          <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
          {t.title}
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">
          {t.noSnapshots}
        </p>
      </div>
    );
  }

  const latestRate = liveRate ?? recap.latestRate;
  const latestScore = liveScore ?? recap.latestScore;

  const minRate = liveRate !== null && recap.minRate !== null ? Math.min(recap.minRate, liveRate) : recap.minRate;
  const maxRate = liveRate !== null && recap.maxRate !== null ? Math.max(recap.maxRate, liveRate) : recap.maxRate;

  const dominantBias = Object.entries(recap.biasCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "--";

  const changePct =
    recap.openRate !== null && latestRate !== null && recap.openRate !== 0
      ? ((latestRate - recap.openRate) / recap.openRate) * 100
      : null;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
            <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
            {t.title}
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.todaySnapshots(recap.sampleSize)}
          </p>
        </div>

        <div className="text-right">
          <Figure value={latestRate !== null ? latestRate.toFixed(4) : null} className="block text-2xl font-semibold" />
          <Figure
            value={changePct !== null ? t.todayChange(`${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}`) : null}
            className={`block text-sm mt-1 ${changeColor(changePct)}`}
          />
        </div>
      </div>

      {minRate !== null && maxRate !== null && latestRate !== null && (
        <RangeBar min={minRate} max={maxRate} current={latestRate} />
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between py-2 border-b border-stone-200 dark:border-stone-800">
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.open}</p>
          <Figure value={recap.openRate !== null ? recap.openRate.toFixed(4) : null} className="text-base font-semibold" />
        </div>

        <div className="flex items-center justify-between py-2 border-b border-stone-200 dark:border-stone-800">
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.high}</p>
          <Figure
            value={maxRate !== null ? maxRate.toFixed(4) : null}
            className="text-base font-semibold text-emerald-700 dark:text-emerald-400"
          />
        </div>

        <div className="flex items-center justify-between py-2 border-b border-stone-200 dark:border-stone-800">
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.low}</p>
          <Figure
            value={minRate !== null ? minRate.toFixed(4) : null}
            className="text-base font-semibold text-red-700 dark:text-red-400"
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.coreFxScore}</p>
          <Figure
            value={latestScore !== null ? String(latestScore) : null}
            className={`text-base font-semibold ${scoreTextColor(latestScore)}`}
          />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
        <p className="text-xs text-stone-600 dark:text-stone-400">{t.dominantBias}</p>
        <StatusBadge label={tLabel(dominantBias, locale)} tone={biasTone(dominantBias)} />
      </div>
    </div>
  );
}
