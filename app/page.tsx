import type { ReactNode } from "react";
import RefreshControls from "@/components/RefreshControls";
import StickyBar from "@/components/StickyBar";
import ThemeToggle from "@/components/ThemeToggle";
import Hero from "@/components/Hero";
import MarketRates from "@/components/MarketRates";
import CrossCheck from "@/components/CrossCheck";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import Alerts from "@/components/Alerts";
import DailyRecap from "@/components/DailyRecap";
import MarketClock from "@/components/MarketClock";
import EventCalendar from "@/components/EventCalendar";
import NewsSentiment from "@/components/NewsSentiment";
import Evaluation from "@/components/Evaluation";
import BacktestPreview from "@/components/BacktestPreview";
import TrendChart from "@/components/TrendChart";
import ActionSummary from "@/components/ActionSummary";

import {
  getDashboardData,
} from "@/lib/dashboard-data";

import {
  getEventCalendar,
} from "@/lib/event-calendar-data";

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

// A very quiet nod to which FX session is live right now -- named in
// text (never color alone) next to the masthead's clock, and echoed as a
// barely-there change in the rule line beneath it, per the almanac
// direction's session-time raise. Bangkok-hour buckets, not a precise
// open/close model.
function marketSession(bangkokHour: number): { label: string; ruleClassName: string } {
  if (bangkokHour >= 6 && bangkokHour < 14) {
    return { label: "Asian session", ruleClassName: "border-brass-900/25" };
  }
  if (bangkokHour >= 14 && bangkokHour < 20) {
    return { label: "London session", ruleClassName: "border-brass-900/45" };
  }
  return { label: "New York session", ruleClassName: "border-brass-900/65" };
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
  const data =
    await getDashboardData();

  const eventCalendar =
    await getEventCalendar();

  const alerts =
    await getAlerts(data);

  const dailyRecap =
    await getDailyRecap();

  const newsSentiment =
    await getRecentNewsSignals();

  const bangkokHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const session = marketSession(bangkokHour);

  const today = new Date().toLocaleDateString("en-GB", {
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
      />

      {/* MASTHEAD -- the almanac's title band: a fixed near-black band
      independent of the light/dark page theme (a printed masthead
      doesn't relight), a date line like a daily almanac page, and the
      current FX session named in text beside the clock. */}

      <div className={`bg-masthead border-b ${session.ruleClassName}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-brass-400">{today}</p>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">
              AUD/THB Forecast Dashboard
            </h1>

            <div className="flex items-center gap-2 mt-1.5">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>

              <span className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                Live -- {session.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <MarketClock variant="inverted" />
            <ThemeToggle variant="inverted" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ALERTS */}

        <Alerts alerts={alerts} />

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
              <SectionLabel color="brass" icon={<TrendIcon />}>Market</SectionLabel>
            </div>
            <Hero data={data} />
            <div className="px-6 pb-6 -mt-4">
              <ActionSummary data={data} />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-stone-800">
            <DailyRecap recap={dailyRecap} data={data} />
            <MarketRates data={data} />
            <CrossCheck data={data} />
          </div>

          <TrendChart />

          {/* SIGNAL MODEL */}
          <ScoreBreakdown data={data} />

          {/* TRACK RECORD */}
          <Evaluation />

          {/* BACKTEST -- a different question from Track Record above:
          historical price-only strategies against RBA's free daily
          series, not a replay of the live model. */}
          <BacktestPreview />

          {/* CONTEXT & NEWS */}
          <div className="px-6 pt-6">
            <SectionLabel color="amber" icon={<CalendarIcon />}>Context &amp; News</SectionLabel>
          </div>

          <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-stone-800">
            <EventCalendar
              today={eventCalendar.today}
              thisWeek={eventCalendar.thisWeek}
              coverageNote={eventCalendar.coverageNote}
            />
            <NewsSentiment signals={newsSentiment.signals} error={newsSentiment.error} />
          </div>

          {/* SOURCES -- reference material, not a live signal, so this row
          carries no icon-labeled section header of its own, just the
          "Sources" heading it already has. */}

          <div className="p-6">
            <h2 className="text-sm font-semibold tracking-tight text-stone-600 dark:text-stone-400">
              Sources
            </h2>

            <div className="mt-4 text-sm text-stone-600 dark:text-stone-400 grid sm:grid-cols-2 gap-x-8 gap-y-2">
            <p>
              FX Market Data:{" "}
              <span className="text-stone-700 dark:text-stone-300">Twelve Data</span>
            </p>

            <p>
              AUD/THB Cross:{" "}
              <span className="text-stone-700 dark:text-stone-300">
                AUD/USD × USD/THB (matched-time)
              </span>
            </p>

            <p>
              Relative Asian FX:{" "}
              <span className="text-stone-700 dark:text-stone-300">
                USD/CNH and USD/SGD via Twelve Data
              </span>
            </p>

            <p>
              AU 2Y Yield:{" "}
              <span className="text-stone-700 dark:text-stone-300">RBA via DBnomics</span>
            </p>

            <p>
              US 2Y Yield:{" "}
              <span className="text-stone-700 dark:text-stone-300">
                Federal Reserve via DBnomics
              </span>
            </p>

            <p>
              Iron Ore:{" "}
              <span className="text-stone-700 dark:text-stone-300">OilPriceAPI</span>
            </p>

            <p>
              Brent Live:{" "}
              <span className="text-stone-700 dark:text-stone-300">OilPriceAPI</span>
            </p>

            <p>
              Brent Historical Reference:{" "}
              <span className="text-stone-700 dark:text-stone-300">EIA</span>
            </p>

            <p>
              Gold: <span className="text-stone-700 dark:text-stone-300">Gold-API</span>
            </p>

            <p>
              Risk / Volatility:{" "}
              <span className="text-stone-700 dark:text-stone-300">VIXY via Twelve Data</span>
            </p>

            <p>
              News Signals:{" "}
              <span className="text-stone-700 dark:text-stone-300">
                Alpha Vantage News + Google Gemini
              </span>
            </p>

            <p>
              AUD/THB Reference (comparison only):{" "}
              <span className="text-stone-700 dark:text-stone-300">
                Yahoo Finance (unofficial)
              </span>
            </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-stone-600 dark:text-stone-400 mb-6">
          AUD/THB Forecast Dashboard -- for research and monitoring purposes only, not financial advice.
        </p>
      </div>
    </main>
  );
}
