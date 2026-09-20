import type {
  DashboardData,
  FreshnessInfo,
} from "@/lib/dashboard-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";
import Figure from "@/components/Figure";
import { freshnessLabel, tLabel, type Locale } from "@/lib/i18n";

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString(
    "en-GB",
    {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );
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
    title: "Market Rates",
    direct: "AUD/THB Direct",
    cross: "AUD/THB Cross",
    matched: "Matched:",
    sourceGap: "Source gap:",
    min: "min ago",
    minSuffix: "min",
  },
  th: {
    title: "อัตราแลกเปลี่ยนตลาด",
    direct: "AUD/THB โดยตรง",
    cross: "AUD/THB แบบ Cross",
    matched: "จับคู่เวลา:",
    sourceGap: "ช่องว่างแหล่งข้อมูล:",
    min: "นาทีที่แล้ว",
    minSuffix: "นาที",
  },
} as const;

function FreshnessBadge({
  freshness,
  locale,
}: {
  freshness: FreshnessInfo;
  locale: Locale;
}) {
  const t = STR[locale];
  return (
    <div className="mt-2 space-y-1">
      <StatusBadge
        label={freshnessLabel(freshness.status, locale)}
        tone={FRESHNESS_TONE[freshness.status]}
      />

      {freshness.ageMinutes !== null &&
        freshness.status !== "MARKET_CLOSED" && (
          <p className="text-xs text-stone-600 dark:text-stone-400">
            {freshness.ageMinutes.toFixed(0)} {t.min}
          </p>
        )}
    </div>
  );
}

export default function MarketRates({
  data,
  locale,
}: {
  data: DashboardData;
  locale: Locale;
}) {
  const t = STR[locale];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
        {t.title}
      </h2>

      <div className="grid grid-cols-2 gap-6 mt-5">

        {/* AUD/THB DIRECT */}
        <div>
          <p className="text-stone-600 dark:text-stone-400 text-sm">
            {t.direct}
          </p>

          <Figure
            value={data.directRate !== null ? data.directRate.toFixed(4) : null}
            className="text-2xl font-semibold"
          />

          {data.latestDirect && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-2">
              {formatTime(
                data.latestDirect.market_timestamp
              )}
            </p>
          )}

          <FreshnessBadge
            freshness={data.directFreshness}
            locale={locale}
          />
        </div>

        {/* AUD/THB CROSS */}
        <div>
          <p className="text-stone-600 dark:text-stone-400 text-sm">
            {t.cross}
          </p>

          <Figure
            value={data.crossRate !== null ? data.crossRate.toFixed(4) : null}
            className="text-2xl font-semibold"
          />

          {data.crossTimestamp && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-2">
              {t.matched}{" "}
              {formatTime(data.crossTimestamp)}
            </p>
          )}

          <div className="mt-2">
            <StatusBadge
              label={tLabel(data.crossStatus, locale)}
              tone={
                data.crossStatus === "GOOD"
                  ? "emerald"
                  : data.crossStatus === "STALE"
                    ? "amber"
                    : "red"
              }
            />
          </div>

          {data.crossTimeGapMinutes !== null && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              {t.sourceGap}{" "}
              {data.crossTimeGapMinutes.toFixed(1)} {t.minSuffix}
            </p>
          )}
        </div>

        {/* AUD/USD */}
        <div>
          <p className="text-stone-600 dark:text-stone-400 text-sm">
            AUD/USD
          </p>

          <Figure
            value={data.latestAudUsd ? Number(data.latestAudUsd.rate).toFixed(5) : null}
            className="text-2xl font-semibold"
          />

          {data.latestAudUsd && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-2">
              {formatTime(
                data.latestAudUsd.market_timestamp
              )}
            </p>
          )}

          <FreshnessBadge
            freshness={data.audUsdFreshness}
            locale={locale}
          />
        </div>

        {/* USD/THB */}
        <div>
          <p className="text-stone-600 dark:text-stone-400 text-sm">
            USD/THB
          </p>

          <Figure
            value={data.latestUsdThb ? Number(data.latestUsdThb.rate).toFixed(5) : null}
            className="text-2xl font-semibold"
          />

          {data.latestUsdThb && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-2">
              {formatTime(
                data.latestUsdThb.market_timestamp
              )}
            </p>
          )}

          <FreshnessBadge
            freshness={data.usdThbFreshness}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
