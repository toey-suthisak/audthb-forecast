import type { ReactNode } from "react";
import Link from "next/link";
import RefreshControls from "@/components/RefreshControls";
import StickyBar from "@/components/StickyBar";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import Hero from "@/components/Hero";
import MarketRates from "@/components/MarketRates";
import CrossCheck from "@/components/CrossCheck";
import Alerts from "@/components/Alerts";
import DailyRecap from "@/components/DailyRecap";
import MarketClock from "@/components/MarketClock";
import TodayEvents from "@/components/TodayEvents";
import MarketConsensus from "@/components/MarketConsensus";
import NewsSentiment from "@/components/NewsSentiment";
import Evaluation from "@/components/Evaluation";
import BacktestPreview from "@/components/BacktestPreview";
import TrendChart from "@/components/TrendChart";
import ActionSummary from "@/components/ActionSummary";

import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";

import {
  getDashboardData,
} from "@/lib/dashboard-data";

import {
  getEventCalendar,
} from "@/lib/event-calendar-data";

import {
  getEconomicConsensus,
} from "@/lib/economic-consensus-data";

import {
  getRecentNewsSignals,
} from "@/lib/news-sentiment-data";

import {
  getAlerts,
} from "@/lib/alerts-data";

import {
  getDailyRecap,
} from "@/lib/daily-recap-data";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

// Groups the page's growing card list under a quiet label instead of
// adding real navigation (a sidebar/tabs structure was tried and
// explicitly rejected earlier) -- just enough hierarchy that the
// ledger's many rows read as a few topics, not one undifferentiated
// scroll. Only a topic that groups multiple distinct rows (Market,
// Context & News) gets one of these icon+text labels; a topic that is
// just one row skips it, since a label directly over that row's own
// heading is a duplicate kicker, not real hierarchy.
type SectionColor = "brass" | "amber";

const SECTION_COLOR_CLASSES: Record<SectionColor, string> = {
  brass: "text-brass-700 dark:text-brass-400",
  amber: "text-amber-600 dark:text-amber-400",
};

const PAGE_STRINGS = {
  en: {
    title: "AUD/THB Forecast Dashboard",
    live: "Live",
    market: "Market",
    contextNews: "Context & News",
    sources: "Sources",
    sourceFxData: "FX Market Data:",
    sourceFxDataValue: "Twelve Data",
    sourceCross: "AUD/THB Cross:",
    sourceCrossValue: "AUD/USD × USD/THB (matched-time)",
    sourceRelative: "Relative Asian FX:",
    sourceRelativeValue: "USD/CNH and USD/SGD via Twelve Data",
    sourceAuYield: "AU 2Y Yield:",
    sourceAuYieldValue: "RBA via DBnomics",
    sourceUsYield: "US 2Y Yield:",
    sourceUsYieldValue: "Federal Reserve via DBnomics",
    sourceIronOre: "Iron Ore:",
    sourceIronOreValue: "OilPriceAPI",
    sourceBrentLive: "Brent Live:",
    sourceBrentLiveValue: "OilPriceAPI",
    sourceBrentHist: "Brent Historical Reference:",
    sourceBrentHistValue: "EIA",
    sourceGold: "Gold:",
    sourceGoldValue: "Gold-API",
    sourceRisk: "Risk / Volatility:",
    sourceRiskValue: "VIXY via Twelve Data",
    sourceNews: "News Signals:",
    sourceNewsValue: "Alpha Vantage News + Google Gemini",
    sourceYahoo: "AUD/THB Reference (comparison only):",
    sourceYahooValue: "Yahoo Finance (unofficial)",
    disclaimer: "AUD/THB Forecast Dashboard -- for research and monitoring purposes only, not financial advice.",
    systemStatus: "System status",
    session: { asia: "Asian session", london: "London session", ny: "New York session" },
  },
  th: {
    title: "แดชบอร์ดพยากรณ์ AUD/THB",
    live: "ถ่ายทอดสด",
    market: "ตลาด",
    contextNews: "ข่าวและบริบท",
    sources: "แหล่งข้อมูล",
    sourceFxData: "ข้อมูลตลาด FX:",
    sourceFxDataValue: "Twelve Data",
    sourceCross: "AUD/THB แบบ Cross:",
    sourceCrossValue: "AUD/USD × USD/THB (จับคู่เวลา)",
    sourceRelative: "ค่าเงินเอเชียที่เกี่ยวข้อง:",
    sourceRelativeValue: "USD/CNH และ USD/SGD ผ่าน Twelve Data",
    sourceAuYield: "ผลตอบแทนพันธบัตรออสเตรเลีย 2 ปี:",
    sourceAuYieldValue: "RBA ผ่าน DBnomics",
    sourceUsYield: "ผลตอบแทนพันธบัตรสหรัฐ 2 ปี:",
    sourceUsYieldValue: "Federal Reserve ผ่าน DBnomics",
    sourceIronOre: "แร่เหล็ก:",
    sourceIronOreValue: "OilPriceAPI",
    sourceBrentLive: "น้ำมันเบรนท์ (เรียลไทม์):",
    sourceBrentLiveValue: "OilPriceAPI",
    sourceBrentHist: "น้ำมันเบรนท์ (ข้อมูลย้อนหลังอ้างอิง):",
    sourceBrentHistValue: "EIA",
    sourceGold: "ทองคำ:",
    sourceGoldValue: "Gold-API",
    sourceRisk: "ความเสี่ยง / ความผันผวน:",
    sourceRiskValue: "VIXY ผ่าน Twelve Data",
    sourceNews: "สัญญาณข่าว:",
    sourceNewsValue: "Alpha Vantage News + Google Gemini",
    sourceYahoo: "AUD/THB อ้างอิง (ใช้เปรียบเทียบเท่านั้น):",
    sourceYahooValue: "Yahoo Finance (ไม่เป็นทางการ)",
    disclaimer: "แดชบอร์ดพยากรณ์ AUD/THB -- ใช้เพื่อการวิจัยและติดตามเท่านั้น ไม่ใช่คำแนะนำทางการเงิน",
    systemStatus: "สถานะระบบ",
    session: { asia: "ช่วงตลาดเอเชีย", london: "ช่วงตลาดลอนดอน", ny: "ช่วงตลาดนิวยอร์ก" },
  },
} as const;

// A very quiet nod to which FX session is live right now -- no longer
// named in text next to the masthead's clock (removed 2026-09-20: it
// read as misleading when shown next to a MARKET_CLOSED badge), just a
// barely-there change in the rule line beneath it. Bangkok-hour
// buckets, not a precise open/close model.
function marketSession(bangkokHour: number, locale: Locale): { label: string; ruleClassName: string } {
  const s = PAGE_STRINGS[locale].session;
  if (bangkokHour >= 6 && bangkokHour < 14) {
    return { label: s.asia, ruleClassName: "border-brass-900/25" };
  }
  if (bangkokHour >= 14 && bangkokHour < 20) {
    return { label: s.london, ruleClassName: "border-brass-900/45" };
  }
  return { label: s.ny, ruleClassName: "border-brass-900/65" };
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function SectionLabel({
  children,
  color,
  icon,
}: {
  children: string;
  color: SectionColor;
  icon: ReactNode;
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-stone-600 dark:text-stone-400 mb-3">
      <span className={SECTION_COLOR_CLASSES[color]}>{icon}</span>
      {children}
    </p>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const s = PAGE_STRINGS[locale];

  const data =
    await getDashboardData();

  const eventCalendar =
    await getEventCalendar(locale);

  const economicConsensus =
    await getEconomicConsensus();

  const alerts =
    await getAlerts(data, locale);

  const dailyRecap =
    await getDailyRecap();

  const newsSentiment =
    await getRecentNewsSignals();

  const bangkokHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const session = marketSession(bangkokHour, locale);

  const today = new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <RefreshControls />

      <StickyBar
        rate={data.latestPrice ? Number(data.latestPrice.rate) : null}
        score={data.coreFxScore}
        bias={data.coreBias}
        freshnessStatus={data.latestPriceFreshness.status}
        locale={locale}
      />

      {/* MASTHEAD -- the almanac's title band: a fixed near-black band
      independent of the light/dark page theme (a printed masthead
      doesn't relight), and a date line like a daily almanac page. */}

      <div className={`bg-masthead border-b ${session.ruleClassName}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-brass-400">{today}</p>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">
              {s.title}
            </h1>

            <div className="flex items-center gap-2 mt-1.5">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>

              <span className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                {s.live}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <MarketClock variant="inverted" locale={locale} />
            <div className="flex items-center gap-2">
              <LanguageToggle locale={locale} variant="inverted" />
              <ThemeToggle variant="inverted" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ALERTS */}

        <Alerts alerts={alerts} locale={locale} />

        {/* THE LEDGER -- the whole page's content is one continuous ruled
        sheet, not a grid of separately-bordered cards: every topic below
        is a row of this same sheet, divided by hairline rules
        (`divide-y`), and a multi-item topic (Market's rate trio,
        Context & News' pair) rules its own items apart with `divide-x`
        instead of gapping separate boxes side by side. This is the
        almanac direction's own device -- a single dated table of
        figures -- not a re-skinned SaaS dashboard. */}

        <div className="mt-10 rounded-md border border-stone-200 dark:border-stone-800 bg-surface divide-y divide-stone-200 dark:divide-stone-800">
          {/* MARKET */}
          <div>
            <div className="px-6 pt-6">
              <SectionLabel color="brass" icon={<TrendIcon />}>{s.market}</SectionLabel>
            </div>
            <Hero data={data} locale={locale} />
            <div className="px-6 pb-6 -mt-4">
              <ActionSummary data={data} locale={locale} />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-stone-800">
            <DailyRecap recap={dailyRecap} data={data} locale={locale} />
            <MarketRates data={data} locale={locale} />
            <CrossCheck data={data} locale={locale} />
          </div>

          <TrendChart locale={locale} />

          {/* TRACK RECORD */}
          <Evaluation locale={locale} />

          {/* BACKTEST -- a different question from Track Record above:
          historical price-only strategies against RBA's free daily
          series, not a replay of the live model. */}
          <BacktestPreview locale={locale} />

          {/* CONTEXT & NEWS */}
          <div className="px-6 pt-6">
            <SectionLabel color="amber" icon={<CalendarIcon />}>{s.contextNews}</SectionLabel>
          </div>

          <TodayEvents today={eventCalendar.today} coverageNote={eventCalendar.coverageNote} locale={locale} />

          <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-stone-800">
            <MarketConsensus consensus={economicConsensus.events} locale={locale} />
            <NewsSentiment signals={newsSentiment.signals} error={newsSentiment.error} locale={locale} />
          </div>

          {/* SOURCES -- reference material, not a live signal, so this row
          carries no icon-labeled section header of its own, just the
          "Sources" heading it already has. */}

          <div className="p-6">
            <h2 className="text-sm font-semibold tracking-tight text-stone-600 dark:text-stone-400">
              {s.sources}
            </h2>

            <div className="mt-4 text-sm text-stone-600 dark:text-stone-400 grid sm:grid-cols-2 gap-x-8 gap-y-2">
            <p>
              {s.sourceFxData}{" "}
              <span className="text-stone-700 dark:text-stone-300">{s.sourceFxDataValue}</span>
            </p>

            <p>
              {s.sourceCross}{" "}
              <span className="text-stone-700 dark:text-stone-300">
                {s.sourceCrossValue}
              </span>
            </p>

            <p>
              {s.sourceRelative}{" "}
              <span className="text-stone-700 dark:text-stone-300">
                {s.sourceRelativeValue}
              </span>
            </p>

            <p>
              {s.sourceAuYield}{" "}
              <span className="text-stone-700 dark:text-stone-300">{s.sourceAuYieldValue}</span>
            </p>

            <p>
              {s.sourceUsYield}{" "}
              <span className="text-stone-700 dark:text-stone-300">
                {s.sourceUsYieldValue}
              </span>
            </p>

            <p>
              {s.sourceIronOre}{" "}
              <span className="text-stone-700 dark:text-stone-300">{s.sourceIronOreValue}</span>
            </p>

            <p>
              {s.sourceBrentLive}{" "}
              <span className="text-stone-700 dark:text-stone-300">{s.sourceBrentLiveValue}</span>
            </p>

            <p>
              {s.sourceBrentHist}{" "}
              <span className="text-stone-700 dark:text-stone-300">{s.sourceBrentHistValue}</span>
            </p>

            <p>
              {s.sourceGold} <span className="text-stone-700 dark:text-stone-300">{s.sourceGoldValue}</span>
            </p>

            <p>
              {s.sourceRisk}{" "}
              <span className="text-stone-700 dark:text-stone-300">{s.sourceRiskValue}</span>
            </p>

            <p>
              {s.sourceNews}{" "}
              <span className="text-stone-700 dark:text-stone-300">
                {s.sourceNewsValue}
              </span>
            </p>

            <p>
              {s.sourceYahoo}{" "}
              <span className="text-stone-700 dark:text-stone-300">
                {s.sourceYahooValue}
              </span>
            </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-stone-600 dark:text-stone-400 mb-2">
          {s.disclaimer}
        </p>

        <p className="text-center text-xs text-stone-600 dark:text-stone-400 mb-6">
          <Link href="/status" className="hover:underline underline-offset-2">
            {s.systemStatus}
          </Link>
        </p>
      </div>
    </main>
  );
}
