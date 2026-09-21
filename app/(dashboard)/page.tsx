import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import RangeChart from "@/components/v2/RangeChart";
import WatchlistRow from "@/components/v2/WatchlistRow";
import CautionToast from "@/components/v2/CautionToast";
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
    high: "High",
    low: "Low",
    today: "Today's Range",
    coreScore: "Core FX Score",
    actionBias: "Action Bias",
    confidence: "Confidence",
    priceTechnical: "Price & Technical",
    forecast: "Forecast",
    upcoming: "Upcoming Events",
    noUpcoming: "No upcoming MEDIUM/HIGH-impact AUD/USD/THB events this week.",
    relatedMarkets: "Related Markets",
  },
  th: {
    rate: "AUD/THB",
    live: "LIVE",
    high: "สูงสุด",
    low: "ต่ำสุด",
    today: "ช่วงราคาวันนี้",
    coreScore: "Core FX Score",
    actionBias: "แนวทาง Action",
    confidence: "ความมั่นใจ",
    priceTechnical: "ราคา & เทคนิค",
    forecast: "พยากรณ์",
    upcoming: "ข่าวที่จะประกาศเร็วๆ นี้",
    noUpcoming: "สัปดาห์นี้ไม่มีข่าวผลกระทบปานกลาง/สูงของ AUD/USD/THB",
    relatedMarkets: "ตลาดที่เกี่ยวข้อง",
  },
} as const;

function impactTone(impact: "HIGH" | "MEDIUM"): ChipTone {
  return impact === "HIGH" ? "red" : "amber";
}

function biasTone(direction: string): ChipTone {
  if (direction === "POSTFUND" || direction === "BULLISH") return "emerald";
  if (direction === "PREFUND" || direction === "BEARISH") return "red";
  return "slate";
}

function biasTextClass(direction: string): string {
  const tone = biasTone(direction);
  if (tone === "emerald") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "red") return "text-red-600 dark:text-red-400";
  return "text-v2-muted";
}

function formatEventDate(isoDate: string, locale: "en" | "th"): string {
  return new Date(isoDate).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
  });
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

  // Every MEDIUM/HIGH-impact AUD/USD/THB event this week that hasn't
  // released yet -- getEconomicConsensus() already scopes to that
  // impact/currency set at the query level, so no extra filtering here
  // beyond "still upcoming". Grouped by date per the user's request
  // ("news for each respective day"), not a flat top-N list.
  const upcomingByDate = new Map<string, typeof consensus.events>();
  for (const event of consensus.events) {
    if (event.actualValue !== null) continue;
    const bucket = upcomingByDate.get(event.eventDate);
    if (bucket) bucket.push(event);
    else upcomingByDate.set(event.eventDate, [event]);
  }
  const upcomingGroups = Array.from(upcomingByDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  const rangeSeries = technicalOutlook.priceSeries.map((p) => ({ date: p.date, close: p.close }));

  return (
    <div className="space-y-6">
      <CautionToast alerts={alerts} locale={locale} />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-v2-muted uppercase tracking-wide">{t.rate}</p>
            <BadgeChip label={t.live} tone="emerald" dot />
          </div>
          <p className="font-mono mt-1 text-3xl font-semibold text-v2-foreground">
            {data.latestPrice ? Number(data.latestPrice.rate).toFixed(4) : "--"}
          </p>
          {data.change1H !== null && (
            <p className={`text-sm mt-1 ${data.change1H >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {data.change1H >= 0 ? "+" : ""}
              {data.change1H.toFixed(2)}% (1H)
            </p>
          )}
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-v2-muted uppercase tracking-wide">{t.coreScore}</p>
              <p
                className={`font-mono mt-1 text-3xl font-semibold ${
                  data.coreFxScore === null
                    ? "text-v2-foreground"
                    : data.coreFxScore >= 15
                      ? "text-emerald-600 dark:text-emerald-400"
                      : data.coreFxScore <= -15
                        ? "text-red-600 dark:text-red-400"
                        : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {data.coreFxScore !== null ? `${data.coreFxScore > 0 ? "+" : ""}${data.coreFxScore}` : "--"}
              </p>
              <p className="text-xs text-v2-muted mt-1">{tLabel(data.coreBias, locale)}</p>
            </div>
            <BadgeChip
              label={`${t.confidence}: ${tLabel(decisionSnapshot.confidenceLevel, locale)}`}
              tone={decisionSnapshot.confidenceLevel === "HIGH" ? "emerald" : decisionSnapshot.confidenceLevel === "MEDIUM" ? "amber" : "red"}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-v2-border">
            <p className="text-xs font-medium text-v2-muted uppercase tracking-wide">{t.actionBias}</p>
            <p className={`text-lg font-semibold mt-1 ${biasTextClass(technicalOutlook.actionBias.direction)}`}>
              {technicalOutlook.actionBias.label}
            </p>
            <p className="text-xs text-v2-muted mt-1 leading-relaxed">{technicalOutlook.actionBias.note}</p>
          </div>
        </Card>
      </div>

      <Card title={t.priceTechnical}>
        <RangeChart
          series={rangeSeries}
          locale={locale}
          pivots={technicalOutlook.pivots}
          currentRate={technicalOutlook.currentRate}
          change1H={data.change1H}
          swingLow={technicalOutlook.swingLow}
          swingHigh={technicalOutlook.swingHigh}
          swingDays={technicalOutlook.swingLookbackDays}
        />
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title={t.forecast} className="lg:col-span-2">
          <div className="grid sm:grid-cols-3 gap-4">
            {technicalOutlook.forecasts.map((f) => (
              <div key={f.horizon} className="rounded-lg border border-v2-border p-3">
                <p className="text-xs font-semibold text-v2-muted">{f.horizon}</p>
                <p className={`text-sm font-semibold mt-1 ${biasTextClass(f.direction)}`}>{tLabel(f.direction, locale)}</p>
                {f.priceRange && (
                  <p className="font-mono text-xs text-v2-muted mt-1">
                    {f.priceRange.low.toFixed(4)}-{f.priceRange.high.toFixed(4)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title={t.upcoming} padded={false}>
          {upcomingGroups.length === 0 ? (
            <p className="text-sm text-v2-muted p-5">{t.noUpcoming}</p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {upcomingGroups.map(([date, events]) => (
                <div key={date} className="px-5 py-3 border-b border-v2-border last:border-b-0">
                  <p className="text-[11px] font-semibold text-v2-muted uppercase tracking-wide mb-2">
                    {formatEventDate(date, locale)}
                  </p>
                  <div className="space-y-2.5">
                    {events.map((e, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-v2-foreground font-medium">
                            {e.currency} {e.eventName}
                          </p>
                          <BadgeChip label={e.impact} tone={impactTone(e.impact)} />
                        </div>
                        {(e.forecastValue !== null || e.previousValue !== null) && (
                          <p className="text-xs text-v2-muted font-mono">
                            {e.forecastValue ?? "--"} / {e.previousValue ?? "--"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
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
