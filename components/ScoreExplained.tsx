import type { ScoreExplained as ScoreExplainedData, FactorAttribution } from "@/lib/score-explained-data";
import type { FactorKey } from "@/lib/score-factors";
import Figure from "@/components/Figure";
import StatusLight from "@/components/StatusLight";
import type { Locale } from "@/lib/i18n";

const FACTOR_LABELS: Record<FactorKey, { en: string; th: string }> = {
  priceMomentum: { en: "Price / Momentum", th: "ราคา / โมเมนตัม" },
  crossCurrency: { en: "Cross Currency", th: "Cross Currency" },
  relativeMarket: { en: "Relative Market", th: "Relative Market" },
  commodity: { en: "Commodity", th: "สินค้าโภคภัณฑ์" },
  meanReversion: { en: "Mean Reversion", th: "Mean Reversion" },
  macro: { en: "Macro / Policy", th: "Macro / นโยบาย" },
  risk: { en: "Risk / VIXY", th: "ความเสี่ยง / VIXY" },
};

const STR = {
  en: {
    title: "Score Explained",
    whatChanged: "What changed",
    hoursAgo: (h: number) => `vs. ${h.toFixed(1)}h ago`,
    notEnoughHistory: "Not enough history yet under the current model version to compare -- check back once a day's worth of snapshots accumulate.",
    noDelta: "No meaningful change in any factor's contribution since the last comparison point.",
    whatsDriving: "What's driving today",
    dominantShare: (pct: number) => `${pct.toFixed(0)}% of today's weighted score`,
    mixed: "No single factor clearly dominates today -- the score is spread across several.",
    mixedShare: (pct: number) => `Largest single factor is only ${pct.toFixed(0)}% of the total.`,
  },
  th: {
    title: "อธิบายคะแนน",
    whatChanged: "อะไรเปลี่ยนไปบ้าง",
    hoursAgo: (h: number) => `เทียบกับ ${h.toFixed(1)} ชม. ก่อน`,
    notEnoughHistory: "โมเดลเวอร์ชันปัจจุบันยังมีประวัติไม่พอที่จะเปรียบเทียบ -- กลับมาดูอีกครั้งเมื่อมีข้อมูลสะสมครบวัน",
    noDelta: "ไม่มีปัจจัยไหนที่คะแนนเปลี่ยนแปลงอย่างมีนัยสำคัญตั้งแต่จุดเปรียบเทียบล่าสุด",
    whatsDriving: "อะไรขับเคลื่อนคะแนนวันนี้",
    dominantShare: (pct: number) => `${pct.toFixed(0)}% ของน้ำหนักคะแนนวันนี้`,
    mixed: "ไม่มีปัจจัยใดปัจจัยหนึ่งเด่นชัดวันนี้ -- คะแนนกระจายอยู่หลายปัจจัย",
    mixedShare: (pct: number) => `ปัจจัยที่มีสัดส่วนมากที่สุดคิดเป็นแค่ ${pct.toFixed(0)}% ของทั้งหมด`,
  },
} as const;

function deltaColor(delta: number | null) {
  if (delta === null || delta === 0) return "text-stone-500 dark:text-stone-400";
  if (delta > 0) return "text-emerald-700 dark:text-emerald-400";
  return "text-red-700 dark:text-red-400";
}

function deltaArrow(delta: number | null) {
  if (delta === null || delta === 0) return "";
  return delta > 0 ? "↑" : "↓";
}

function FactorRow({ factor, locale }: { factor: FactorAttribution; locale: Locale }) {
  const label = FACTOR_LABELS[factor.key][locale];
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
      <span className="text-sm truncate">{label}</span>
      <span className="flex items-center gap-3 shrink-0 text-xs">
        <span className="text-stone-500 dark:text-stone-400">
          {factor.currentContribution !== null ? factor.currentContribution.toFixed(1) : "--"}
        </span>
        <span className={`font-semibold ${deltaColor(factor.delta)}`}>
          {factor.delta !== null && factor.delta !== 0
            ? `${factor.delta > 0 ? "+" : ""}${factor.delta.toFixed(1)} ${deltaArrow(factor.delta)}`
            : "--"}
        </span>
      </span>
    </div>
  );
}

export default function ScoreExplained({
  explained,
  locale,
}: {
  explained: ScoreExplainedData;
  locale: Locale;
}) {
  const t = STR[locale];

  if (!explained.available || explained.currentScore === null) return null;

  const meaningfulFactors = explained.attribution.factors.filter((f) => f.delta !== null && Math.abs(f.delta) >= 0.5);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
        {t.title}
      </h2>

      <div className="grid sm:grid-cols-2 gap-6 mt-4">
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest">
              {t.whatChanged}
            </p>
            {explained.attribution.hoursAgo !== null && (
              <span className="text-[11px] text-stone-500 dark:text-stone-500">
                {t.hoursAgo(explained.attribution.hoursAgo)}
              </span>
            )}
          </div>

          {!explained.attribution.available ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">{t.notEnoughHistory}</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mt-2">
                <Figure value={String(explained.currentScore)} className="text-2xl font-semibold" />
                {explained.attribution.previousScore !== null && (
                  <span className="text-sm text-stone-500 dark:text-stone-400">
                    ({explained.attribution.previousScore > 0 ? "+" : ""}
                    {explained.attribution.previousScore} {"→"} {explained.currentScore > 0 ? "+" : ""}
                    {explained.currentScore})
                  </span>
                )}
              </div>

              {meaningfulFactors.length > 0 ? (
                <div className="mt-2">
                  {meaningfulFactors.map((f) => (
                    <FactorRow key={f.key} factor={f} locale={locale} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">{t.noDelta}</p>
              )}
            </>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-widest">
            {t.whatsDriving}
          </p>

          {explained.regime && explained.regime.key !== "MIXED" && explained.regime.dominantSharePct !== null ? (
            <>
              <p className="text-lg font-semibold text-stone-800 dark:text-stone-200 mt-2">
                {FACTOR_LABELS[explained.regime.key as FactorKey][locale]}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-500 mt-0.5">
                {t.dominantShare(explained.regime.dominantSharePct)}
              </p>
            </>
          ) : explained.regime ? (
            <>
              <p className="text-sm text-stone-600 dark:text-stone-400 mt-2 leading-relaxed">{t.mixed}</p>
              {explained.regime.dominantSharePct !== null && (
                <p className="text-xs text-stone-500 dark:text-stone-500 mt-1">
                  {t.mixedShare(explained.regime.dominantSharePct)}
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
