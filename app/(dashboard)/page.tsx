import Card from "@/components/v2/Card";
import KpiCard from "@/components/v2/KpiCard";
import BadgeChip from "@/components/v2/BadgeChip";
import RangeChart from "@/components/v2/RangeChart";
import WatchlistRow from "@/components/v2/WatchlistRow";
import { getLocale } from "@/lib/i18n-server";
import { tLabel } from "@/lib/i18n";
import { getDashboardData } from "@/lib/dashboard-data";
import { getTechnicalOutlook } from "@/lib/technical-outlook-data";
import { getDecisionSnapshot } from "@/lib/decision-snapshot-data";
import { getAlerts } from "@/lib/alerts-data";
import { getRelatedMarkets } from "@/lib/watchlist-data";
import { getEconomicConsensus } from "@/lib/economic-consensus-data";
import type { ChipTone } from "@/components/v2/BadgeChip";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    rate: "AUD/THB",
    live: "LIVE",
    open: "Open",
    high: "High",
    low: "Low",
    today: "Today's Range",
    coreScore: "Core FX Score",
    actionBias: "Action Bias",
    confidence: "Confidence",
    intraday: "Price",
    technicalLevels: "Technical Levels",
    forecast: "Forecast",
    upcoming: "Upcoming Events",
    noUpcoming: "No upcoming HIGH-impact events with a forecast right now.",
    relatedMarkets: "Related Markets",
    caution: "Caution",
    r2: "R2",
    r1: "R1",
    pivot: "Pivot",
    s1: "S1",
    s2: "S2",
  },
  th: {
    rate: "AUD/THB",
    live: "LIVE",
    open: "เปิด",
    high: "สูงสุด",
    low: "ต่ำสุด",
    today: "ช่วงราคาวันนี้",
    coreScore: "Core FX Score",
    actionBias: "แนวทาง Action",
    confidence: "ความมั่นใจ",
    intraday: "ราคา",
    technicalLevels: "แนวรับ-แนวต้าน",
    forecast: "พยากรณ์",
    upcoming: "ข่าวที่จะประกาศเร็วๆ นี้",
    noUpcoming: "ตอนนี้ไม่มีข่าวผลกระทบสูงที่มีตัวเลขคาดการณ์รอประกาศ",
    relatedMarkets: "ตลาดที่เกี่ยวข้อง",
    caution: "ข้อควรระวัง",
    r2: "R2",
    r1: "R1",
    pivot: "จุดหมุน",
    s1: "S1",
    s2: "S2",
  },
} as const;

function biasTone(direction: string): ChipTone {
  if (direction === "POSTFUND" || direction === "BULLISH") return "emerald";
  if (direction === "PREFUND" || direction === "BEARISH") return "red";
  return "slate";
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = STR[locale];

  const data = await getDashboardData();
  const [technicalOutlook, decisionSnapshot, alerts, relatedMarkets, consensus] = await Promise.all([
    getTechnicalOutlook(locale, data),
    getDecisionSnapshot(data, locale),
    getAlerts(data, locale),
    getRelatedMarkets(data),
    getEconomicConsensus(),
  ]);

  const upcoming = consensus.events
    .filter((e) => e.impact === "HIGH" && e.forecastValue !== null && e.actualValue === null)
    .slice(0, 4);

  const rangeSeries = technicalOutlook.priceSeries.map((p) => ({ date: p.date, close: p.close }));

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-1.5">{t.caution}</p>
          <ul className="space-y-1">
            {alerts.map((a, i) => (
              <li key={i} className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-medium">{a.label}:</span> {a.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <KpiCard
            label={t.rate}
            value={data.latestPrice ? Number(data.latestPrice.rate).toFixed(4) : "--"}
            badge={<BadgeChip label={t.live} tone="emerald" dot />}
            sub={
              data.change1H !== null && (
                <span className={data.change1H >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  {data.change1H >= 0 ? "+" : ""}
                  {data.change1H.toFixed(2)}% (1H)
                </span>
              )
            }
          />
          <div className="grid grid-cols-3 gap-2 mt-4 text-xs text-v2-muted">
            <div>
              <p>{t.high}</p>
              <p className="font-mono text-v2-foreground">{data.intradayHigh?.toFixed(4) ?? "--"}</p>
            </div>
            <div>
              <p>{t.low}</p>
              <p className="font-mono text-v2-foreground">{data.intradayLow?.toFixed(4) ?? "--"}</p>
            </div>
            <div>
              <p>{t.today}</p>
              <p className="font-mono text-v2-foreground">
                {data.intradayLow !== null && data.intradayHigh !== null
                  ? `${data.intradayLow.toFixed(2)}-${data.intradayHigh.toFixed(2)}`
                  : "--"}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <KpiCard
            label={t.coreScore}
            value={data.coreFxScore !== null ? `${data.coreFxScore > 0 ? "+" : ""}${data.coreFxScore}` : "--"}
            valueClassName={
              data.coreFxScore === null
                ? ""
                : data.coreFxScore >= 15
                  ? "text-emerald-600 dark:text-emerald-400"
                  : data.coreFxScore <= -15
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
            }
            sub={<span>{tLabel(data.coreBias, locale)}</span>}
            badge={<BadgeChip label={`${t.confidence}: ${tLabel(decisionSnapshot.confidenceLevel, locale)}`} tone={decisionSnapshot.confidenceLevel === "HIGH" ? "emerald" : decisionSnapshot.confidenceLevel === "MEDIUM" ? "amber" : "red"} />}
          />
        </Card>

        <Card>
          <KpiCard
            label={t.actionBias}
            value={technicalOutlook.actionBias.label}
            valueClassName={biasTone(technicalOutlook.actionBias.direction) === "emerald" ? "text-emerald-600 dark:text-emerald-400" : biasTone(technicalOutlook.actionBias.direction) === "red" ? "text-red-600 dark:text-red-400" : ""}
            sub={<span className="leading-relaxed">{technicalOutlook.actionBias.note}</span>}
          />
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title={t.intraday} className="lg:col-span-2">
          <RangeChart series={rangeSeries} locale={locale} />
        </Card>

        <Card title={t.technicalLevels}>
          {technicalOutlook.pivots ? (
            <div className="space-y-2 text-sm">
              {[
                { label: t.r2, value: technicalOutlook.pivots.r2 },
                { label: t.r1, value: technicalOutlook.pivots.r1 },
                { label: t.pivot, value: technicalOutlook.pivots.pivot },
                { label: t.s1, value: technicalOutlook.pivots.s1 },
                { label: t.s2, value: technicalOutlook.pivots.s2 },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-v2-muted">{row.label}</span>
                  <span className="font-mono text-v2-foreground">{row.value.toFixed(4)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-v2-muted">{technicalOutlook.error}</p>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title={t.forecast} className="lg:col-span-2">
          <div className="grid sm:grid-cols-3 gap-4">
            {technicalOutlook.forecasts.map((f) => (
              <div key={f.horizon} className="rounded-lg border border-v2-border p-3">
                <p className="text-xs font-semibold text-v2-muted">{f.horizon}</p>
                <p className={`text-sm font-semibold mt-1 ${biasTone(f.direction) === "emerald" ? "text-emerald-600 dark:text-emerald-400" : biasTone(f.direction) === "red" ? "text-red-600 dark:text-red-400" : "text-v2-muted"}`}>
                  {tLabel(f.direction, locale)}
                </p>
                {f.priceRange && (
                  <p className="font-mono text-xs text-v2-muted mt-1">
                    {f.priceRange.low.toFixed(4)}-{f.priceRange.high.toFixed(4)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title={t.upcoming}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-v2-muted">{t.noUpcoming}</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((e, i) => (
                <div key={i} className="text-sm">
                  <p className="text-v2-foreground font-medium">
                    {e.currency} {e.eventName}
                  </p>
                  <p className="text-xs text-v2-muted font-mono">
                    {e.forecastValue ?? "--"} / {e.previousValue ?? "--"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title={t.relatedMarkets}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          {relatedMarkets.map((item) => (
            <WatchlistRow key={item.label} item={item} />
          ))}
        </div>
      </Card>
    </div>
  );
}
