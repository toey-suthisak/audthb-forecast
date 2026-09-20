import type { DashboardData, FreshnessInfo } from "@/lib/dashboard-data";
import { getYahooReference } from "@/lib/yahoo-reference-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import InfoTip from "@/components/InfoTip";
import StatusLight from "@/components/StatusLight";
import Figure from "@/components/Figure";
import { freshnessLabel, type Locale } from "@/lib/i18n";

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const FRESHNESS_TONE: Record<FreshnessInfo["status"], BadgeTone> = {
  FRESH: "emerald",
  DELAYED: "amber",
  STALE: "red",
  MARKET_CLOSED: "slate",
  MISSING: "red",
};

const STR = {
  en: {
    title: "Cross-Check & Reference",
    titleTooltip:
      "Two independent checks on the AUD/THB Direct feed: a matched-time cross rate computed from AUD/USD x USD/THB, and a second provider (Yahoo) entirely outside Twelve Data.",
    matchedGap: "Matched-Time Cross Gap",
    directReference: (rate: string, time: string) => `Direct reference: ${rate} @ ${time}`,
    staleWarning: "Cross Currency Score only uses matched-time data when source data is fresh.",
    yahooLabel: "AUD/THB -- Yahoo Finance",
    yahooTooltip:
      "A second, independent AUD/THB quote for comparison only. Yahoo has no official public API for this -- it's fetched via the same unofficial endpoint the yfinance community library uses, so outages here are expected and never affect the Core FX Score.",
    referenceOnly: "Reference Only",
    vsTwelveData: "vs Twelve Data:",
    minAgo: "min ago",
  },
  th: {
    title: "ตรวจสอบไขว้และค่าอ้างอิง",
    titleTooltip:
      "การตรวจสอบอิสระสองทางกับฟีด AUD/THB Direct: อัตรา cross ที่คำนวณแบบจับคู่เวลาจาก AUD/USD x USD/THB และผู้ให้บริการอีกราย (Yahoo) ที่แยกจาก Twelve Data โดยสิ้นเชิง",
    matchedGap: "ส่วนต่าง Cross แบบจับคู่เวลา",
    directReference: (rate: string, time: string) => `อ้างอิงราคาตรง: ${rate} @ ${time}`,
    staleWarning: "Cross Currency Score จะใช้ข้อมูลแบบจับคู่เวลาก็ต่อเมื่อข้อมูลต้นทางยังสดอยู่เท่านั้น",
    yahooLabel: "AUD/THB -- Yahoo Finance",
    yahooTooltip:
      "ราคา AUD/THB จากแหล่งอิสระอีกทางหนึ่งไว้เปรียบเทียบเท่านั้น Yahoo ไม่มี API สาธารณะอย่างเป็นทางการสำหรับข้อมูลนี้ -- ดึงผ่าน endpoint ไม่เป็นทางการแบบเดียวกับที่ไลบรารี yfinance ของคอมมูนิตี้ใช้ ดังนั้นการล่มของแหล่งนี้เป็นเรื่องคาดการณ์ได้และไม่กระทบ Core FX Score",
    referenceOnly: "อ้างอิงเท่านั้น",
    vsTwelveData: "เทียบกับ Twelve Data:",
    minAgo: "นาทีที่แล้ว",
  },
} as const;

function FreshnessBadge({ freshness, locale }: { freshness: FreshnessInfo; locale: Locale }) {
  const t = STR[locale];
  return (
    <div className="mt-2 space-y-1">
      <StatusBadge label={freshnessLabel(freshness.status, locale)} tone={FRESHNESS_TONE[freshness.status]} />
      {freshness.ageMinutes !== null && freshness.status !== "MARKET_CLOSED" && (
        <p className="text-xs text-stone-600 dark:text-stone-400">{freshness.ageMinutes.toFixed(0)} {t.minAgo}</p>
      )}
    </div>
  );
}

// Everything on this card asks the same question a different way: "does
// the AUD/THB Direct feed agree with an independent check?" -- once
// against its own Twelve Data cross rate (matched-time), once against a
// second provider entirely (Yahoo). Split out of Market Rates so that
// card stays a plain "here are the current feeds" table, and this one
// carries the actual cross-checking -- previously all three pieces were
// stacked at the bottom of Market Rates, making it far longer than the
// Daily Recap card beside it for no real reason.
export default async function CrossCheck({ data, locale }: { data: DashboardData; locale: Locale }) {
  const yahoo = await getYahooReference();
  const yahooDiff = yahoo.rate !== null && data.directRate !== null ? yahoo.rate - data.directRate : null;
  const t = STR[locale];

  const crossDataStale =
    (data.audUsdFreshness.status !== "FRESH" || data.usdThbFreshness.status !== "FRESH") &&
    data.audUsdFreshness.status !== "MARKET_CLOSED";

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
        {t.title}
        <InfoTip text={t.titleTooltip} />
      </h2>

      {/* MATCHED-TIME CROSS GAP */}
      <div className="mt-4">
        <p className="text-sm text-stone-600 dark:text-stone-400">{t.matchedGap}</p>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1">
          <Figure value={data.crossGap !== null ? data.crossGap.toFixed(4) : null} className="text-2xl font-semibold" />
          <Figure
            value={
              data.crossGap !== null && data.crossGapPercent !== null
                ? `THB (${data.crossGapPercent >= 0 ? "+" : ""}${data.crossGapPercent.toFixed(3)}%)`
                : null
            }
            className="text-sm text-stone-600 dark:text-stone-400"
          />
        </div>

        {data.crossDirectReferenceRate !== null && data.crossTimestamp && (
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-2">
            {t.directReference(data.crossDirectReferenceRate.toFixed(4), formatTime(data.crossTimestamp))}
          </p>
        )}

        {crossDataStale && (
          <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {t.staleWarning}
            </p>
          </div>
        )}
      </div>

      {/* YAHOO FINANCE REFERENCE -- unofficial, comparison only, never
      scored. */}
      <div className="border-t border-stone-200 dark:border-stone-800 mt-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-sm text-stone-600 dark:text-stone-400 inline-flex items-center">
            {t.yahooLabel}
            <InfoTip text={t.yahooTooltip} />
          </p>
          <StatusBadge label={t.referenceOnly} tone="slate" />
        </div>

        <Figure value={yahoo.rate !== null ? yahoo.rate.toFixed(4) : null} className="text-2xl font-semibold" />

        {yahoo.marketTimestamp && (
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-2">{formatTime(yahoo.marketTimestamp)}</p>
        )}

        <FreshnessBadge freshness={{ status: yahoo.status, ageMinutes: yahoo.ageMinutes }} locale={locale} />

        {yahooDiff !== null && (
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            {t.vsTwelveData} {yahooDiff >= 0 ? "+" : ""}
            {yahooDiff.toFixed(4)} THB
          </p>
        )}

        {yahoo.error && <p className="text-xs text-red-700 dark:text-red-400 mt-1">{yahoo.error}</p>}
      </div>
    </div>
  );
}
