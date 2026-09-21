"use client";

import { useState } from "react";
import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import RangeChart from "@/components/v2/RangeChart";
import type { ChipTone } from "@/components/v2/BadgeChip";
import type { TechnicalOutlook } from "@/lib/technical-outlook-data";
import type { ScoreExplained } from "@/lib/score-explained-data";
import type { ReleasedEvent, ConsensusEvent } from "@/lib/economic-consensus-data";
import type { CorrelationRow } from "@/lib/correlation-data";
import type { FactorKey } from "@/lib/score-factors";
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

const SUB_TABS = ["price", "drivers", "why", "events", "technical", "correlation"] as const;
type SubTab = (typeof SUB_TABS)[number];

const STR = {
  en: {
    price: "Price & Chart",
    drivers: "Drivers",
    why: "Why is it moving?",
    events: "Event Impact",
    technical: "Technical",
    correlation: "Correlation",
    dominantFactor: "What's driving today",
    mixed: "No single factor clearly dominates -- spread across several.",
    shareOfScore: (pct: number) => `${pct.toFixed(0)}% of today's weighted score`,
    whatChanged: "What changed vs. ~24h ago",
    notEnoughAttribution: "Not enough history under the current model version to compare yet.",
    released: "Recently Released",
    noReleased: "No HIGH-impact events released yet.",
    upcoming: "Upcoming",
    noUpcoming: "No upcoming HIGH-impact events with a forecast right now.",
    pivotBasis: (date: string) => `Based on ${date}'s close`,
    swingRange: (days: number) => `${days}-day range`,
    trend: "Trend (SMA)",
    momentum: "Momentum (RSI)",
    corrNote: "Pearson correlation of daily % change vs. AUD/THB's own daily % change, over whatever real overlapping history exists.",
    notEnoughCorr: (min: number) => `Needs ${min}+ overlapping days of real history`,
    strong: "Strong",
    moderate: "Moderate",
    weak: "Weak",
  },
  th: {
    price: "ราคา & กราฟ",
    drivers: "ปัจจัยขับเคลื่อน",
    why: "ทำไมราคาถึงเคลื่อนไหว",
    events: "ผลกระทบข่าว",
    technical: "เทคนิค",
    correlation: "ความสัมพันธ์",
    dominantFactor: "อะไรขับเคลื่อนคะแนนวันนี้",
    mixed: "ไม่มีปัจจัยใดปัจจัยหนึ่งเด่นชัด -- กระจายอยู่หลายปัจจัย",
    shareOfScore: (pct: number) => `${pct.toFixed(0)}% ของน้ำหนักคะแนนวันนี้`,
    whatChanged: "อะไรเปลี่ยนไปจากเมื่อ ~24 ชม. ก่อน",
    notEnoughAttribution: "โมเดลเวอร์ชันปัจจุบันยังมีประวัติไม่พอที่จะเปรียบเทียบ",
    released: "ประกาศแล้วล่าสุด",
    noReleased: "ยังไม่มีข่าวผลกระทบสูงประกาศจริง",
    upcoming: "กำลังจะมาถึง",
    noUpcoming: "ตอนนี้ไม่มีข่าวผลกระทบสูงที่มีตัวเลขคาดการณ์รอประกาศ",
    pivotBasis: (date: string) => `คำนวณจากราคาปิดวันที่ ${date}`,
    swingRange: (days: number) => `กรอบ ${days} วัน`,
    trend: "แนวโน้ม (SMA)",
    momentum: "Momentum (RSI)",
    corrNote: "ค่าสหสัมพันธ์ Pearson ของ % การเปลี่ยนแปลงรายวัน เทียบกับ % การเปลี่ยนแปลงรายวันของ AUD/THB เอง จากข้อมูลจริงที่ซ้อนทับกันเท่าที่มี",
    notEnoughCorr: (min: number) => `ต้องมีข้อมูลจริงซ้อนทับกันอย่างน้อย ${min} วัน`,
    strong: "แรง",
    moderate: "ปานกลาง",
    weak: "อ่อน",
  },
} as const;

function corrTone(value: number | null): ChipTone {
  if (value === null) return "slate";
  const abs = Math.abs(value);
  if (abs >= 0.6) return value > 0 ? "emerald" : "red";
  if (abs >= 0.3) return "amber";
  return "slate";
}

function corrStrength(value: number, t: (typeof STR)[Locale]): string {
  const abs = Math.abs(value);
  if (abs >= 0.6) return t.strong;
  if (abs >= 0.3) return t.moderate;
  return t.weak;
}

export default function AnalysisTabs({
  locale,
  technicalOutlook,
  scoreExplained,
  releasedEvents,
  upcomingEvents,
  correlations,
}: {
  locale: Locale;
  technicalOutlook: TechnicalOutlook;
  scoreExplained: ScoreExplained;
  releasedEvents: ReleasedEvent[];
  upcomingEvents: ConsensusEvent[];
  correlations: { rows: CorrelationRow[]; minSamples: number };
}) {
  const t = STR[locale];
  const [tab, setTab] = useState<SubTab>("price");

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-v2-border mb-5">
        {SUB_TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-v2-muted hover:text-v2-foreground"
            }`}
          >
            {t[key]}
          </button>
        ))}
      </div>

      {tab === "price" && (
        <Card title={t.price}>
          {technicalOutlook.priceSeries.length > 0 ? (
            <RangeChart
              series={technicalOutlook.priceSeries.map((p) => ({ date: p.date, close: p.close }))}
              locale={locale}
              pivots={technicalOutlook.pivots}
              currentRate={technicalOutlook.currentRate}
            />
          ) : (
            <p className="text-sm text-v2-muted">{technicalOutlook.error}</p>
          )}
        </Card>
      )}

      {tab === "drivers" && (
        <Card title={t.dominantFactor}>
          {scoreExplained.regime && scoreExplained.regime.key !== "MIXED" && scoreExplained.regime.dominantSharePct !== null ? (
            <div>
              <p className="text-xl font-semibold text-v2-foreground">{FACTOR_LABELS[scoreExplained.regime.key][locale]}</p>
              <p className="text-sm text-v2-muted mt-1">{t.shareOfScore(scoreExplained.regime.dominantSharePct)}</p>
            </div>
          ) : (
            <p className="text-sm text-v2-muted">{t.mixed}</p>
          )}

          <div className="mt-5 space-y-2">
            {scoreExplained.attribution.factors.map((f) => (
              <div key={f.key} className="flex items-center justify-between text-sm">
                <span className="text-v2-muted">{FACTOR_LABELS[f.key][locale]}</span>
                <span className="font-mono text-v2-foreground">
                  {f.currentContribution !== null ? f.currentContribution.toFixed(1) : "--"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "why" && (
        <Card title={t.whatChanged}>
          {!scoreExplained.attribution.available ? (
            <p className="text-sm text-v2-muted">{t.notEnoughAttribution}</p>
          ) : (
            <ul className="space-y-2 mb-5">
              {technicalOutlook.narrative.map((line, i) => (
                <li key={i} className="text-sm text-v2-muted leading-relaxed list-disc list-inside">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "events" && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card title={t.released}>
            {releasedEvents.length === 0 ? (
              <p className="text-sm text-v2-muted">{t.noReleased}</p>
            ) : (
              <div className="space-y-3">
                {releasedEvents.map((e, i) => (
                  <div key={i} className="text-sm">
                    <p className="text-v2-foreground font-medium">
                      {e.currency} {e.eventName}
                    </p>
                    <p className="font-mono text-xs text-v2-muted">{e.actualValue}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title={t.upcoming}>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-v2-muted">{t.noUpcoming}</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((e, i) => (
                  <div key={i} className="text-sm">
                    <p className="text-v2-foreground font-medium">
                      {e.currency} {e.eventName}
                    </p>
                    <p className="font-mono text-xs text-v2-muted">
                      {e.forecastValue ?? "--"} / {e.previousValue ?? "--"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "technical" && (
        <Card title={t.technical}>
          {technicalOutlook.pivots ? (
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2 text-sm">
                {[
                  { label: "R2", value: technicalOutlook.pivots.r2 },
                  { label: "R1", value: technicalOutlook.pivots.r1 },
                  { label: "Pivot", value: technicalOutlook.pivots.pivot },
                  { label: "S1", value: technicalOutlook.pivots.s1 },
                  { label: "S2", value: technicalOutlook.pivots.s2 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-v2-muted">{row.label}</span>
                    <span className="font-mono text-v2-foreground">{row.value.toFixed(4)}</span>
                  </div>
                ))}
                <p className="text-xs text-v2-muted pt-2">{t.pivotBasis(technicalOutlook.pivots.basedOnDate)}</p>
                {technicalOutlook.swingHigh !== null && technicalOutlook.swingLow !== null && (
                  <p className="text-xs text-v2-muted">
                    {t.swingRange(technicalOutlook.swingLookbackDays)}: {technicalOutlook.swingLow.toFixed(4)} - {technicalOutlook.swingHigh.toFixed(4)}
                  </p>
                )}
              </div>
              <div className="space-y-3">
                {technicalOutlook.smaShortValue !== null && (
                  <div>
                    <p className="text-xs text-v2-muted">{t.trend} ({technicalOutlook.smaShortPeriod})</p>
                    <p className="font-mono text-lg text-v2-foreground">{technicalOutlook.smaShortValue.toFixed(4)}</p>
                  </div>
                )}
                {technicalOutlook.rsiValue !== null && (
                  <div>
                    <p className="text-xs text-v2-muted">{t.momentum} ({technicalOutlook.rsiPeriod})</p>
                    <p className="font-mono text-lg text-v2-foreground">{technicalOutlook.rsiValue.toFixed(1)}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-v2-muted">{technicalOutlook.error}</p>
          )}
        </Card>
      )}

      {tab === "correlation" && (
        <Card title={t.correlation}>
          <p className="text-xs text-v2-muted mb-4">{t.corrNote}</p>
          <div className="space-y-2">
            {correlations.rows.map((row) => (
              <div key={row.symbol} className="flex items-center justify-between text-sm">
                <span className="text-v2-muted">{row.label}</span>
                {row.correlation !== null ? (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-v2-foreground">{row.correlation.toFixed(2)}</span>
                    <BadgeChip label={corrStrength(row.correlation, t)} tone={corrTone(row.correlation)} />
                  </span>
                ) : (
                  <BadgeChip label={t.notEnoughCorr(correlations.minSamples)} tone="slate" />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
