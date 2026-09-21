import type { DecisionSnapshot as DecisionSnapshotData } from "@/lib/decision-snapshot-data";
import type { ConfidenceLevel } from "@/lib/confidence-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import Figure from "@/components/Figure";
import { tLabel, formatHoursUntil, type Locale } from "@/lib/i18n";

const STR = {
  en: {
    postfund: "Postfund lean",
    prefund: "Prefund lean",
    neutral: "No clear lean",
    confidence: "Confidence",
    eventWarning: (name: string, currency: string, hours: string) =>
      `${name} (${currency}) in ${hours} -- expect volatility around that time.`,
    trackRecord: (pct: string, n: number) => `DAILY forecast track record: ${pct}% direction accuracy (last ${n})`,
    trackRecordNotEnough: (n: number, min: number) => `DAILY forecast track record: not enough resolved forecasts yet (${n}/${min})`,
    unavailable: "Core FX Score is not available right now.",
  },
  th: {
    postfund: "เอนไปทาง Postfund",
    prefund: "เอนไปทาง Prefund",
    neutral: "ยังไม่มีทิศทางชัดเจน",
    confidence: "ความมั่นใจ",
    eventWarning: (name: string, currency: string, hours: string) =>
      `${name} (${currency}) ในอีก ${hours} -- คาดว่าจะผันผวนช่วงนั้น`,
    trackRecord: (pct: string, n: number) => `Track Record ของพยากรณ์ DAILY: ทายทิศทางถูก ${pct}% (จาก ${n} ครั้งล่าสุด)`,
    trackRecordNotEnough: (n: number, min: number) => `Track Record ของพยากรณ์ DAILY: ข้อมูลยังไม่พอ (${n}/${min})`,
    unavailable: "ไม่มี Core FX Score ในขณะนี้",
  },
} as const;

function directionColor(direction: DecisionSnapshotData["direction"]) {
  if (direction === "POSTFUND") return "text-emerald-700 dark:text-emerald-400";
  if (direction === "PREFUND") return "text-red-700 dark:text-red-400";
  return "text-stone-700 dark:text-stone-300";
}

function confidenceTone(level: ConfidenceLevel): BadgeTone {
  if (level === "HIGH") return "emerald";
  if (level === "MEDIUM") return "amber";
  return "red";
}

export default function DecisionSnapshot({
  snapshot,
  locale,
}: {
  snapshot: DecisionSnapshotData;
  locale: Locale;
}) {
  const t = STR[locale];

  if (!snapshot.available) {
    return (
      <div className="mt-6 rounded-md border border-stone-200 dark:border-stone-800 bg-surface p-4">
        <p className="text-sm text-stone-500 dark:text-stone-400">{t.unavailable}</p>
      </div>
    );
  }

  const directionLabel =
    snapshot.direction === "POSTFUND" ? t.postfund : snapshot.direction === "PREFUND" ? t.prefund : t.neutral;

  return (
    <div className="mt-6 rounded-md border border-stone-200 dark:border-stone-800 bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className={`text-lg font-semibold ${directionColor(snapshot.direction)}`}>{directionLabel}</p>
        <Figure
          value={snapshot.score !== null ? `${snapshot.score > 0 ? "+" : ""}${snapshot.score}` : null}
          className="text-sm text-stone-500 dark:text-stone-400"
        />
        <StatusBadge label={`${t.confidence}: ${tLabel(snapshot.confidenceLevel, locale)}`} tone={confidenceTone(snapshot.confidenceLevel)} />
      </div>

      {snapshot.eventWarning && (
        <p
          className={`text-xs mt-2 leading-relaxed ${
            snapshot.eventWarning.level === "HIGH"
              ? "text-red-700 dark:text-red-400"
              : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {t.eventWarning(
            snapshot.eventWarning.name,
            snapshot.eventWarning.currency,
            formatHoursUntil(snapshot.eventWarning.hoursUntil, locale),
          )}
        </p>
      )}

      {snapshot.trackRecord && (
        <p className="text-xs text-stone-500 dark:text-stone-500 mt-1.5">
          {!snapshot.trackRecord.insufficientData && snapshot.trackRecord.accuracyPct !== null
            ? t.trackRecord(snapshot.trackRecord.accuracyPct.toFixed(1), snapshot.trackRecord.sampleSize)
            : t.trackRecordNotEnough(snapshot.trackRecord.sampleSize, snapshot.trackRecord.minSampleSize)}
        </p>
      )}
    </div>
  );
}
