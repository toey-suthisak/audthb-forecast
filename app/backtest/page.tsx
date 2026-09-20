import Link from "next/link";
import { getBacktestSummary, NEUTRAL_BAND_PCT, type BacktestYearResult, type BacktestSegmentResult } from "@/lib/backtest-data";
import Figure from "@/components/Figure";
import StatusBadge from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";
import MarketClock from "@/components/MarketClock";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function accuracyLabel(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function maeLabel(value: number) {
  return `${value.toFixed(3)}%`;
}

const STR = {
  en: {
    title: "Backtest",
    subtitle: "Does simple momentum or mean-reversion have historical edge on daily AUD/THB at all?",
    calloutTitle: "This is a different question from Track Record, and it is not a replay of the live Core FX Score.",
    calloutBody: (n: number) =>
      `Track Record (on the main dashboard) grades the live model's actual forecasts as they resolve, so it only ever has a few weeks of history. The live model's heaviest factor, Price/Momentum, is built from 1H/4H intraday change -- and no free historical source publishes that granularity going back years. This page instead asks a narrower, answerable question on ${n} trading days of official daily closes: if you did nothing but watch the trailing 5 days and bet on the direction continuing (momentum) or reversing (mean reversion), would you have called tomorrow correctly more often than chance, or than just assuming nothing changes?`,
    dailyDirectionBacktest: "Daily Direction Backtest",
    tradingDays: "trading days",
    noChangeBaseline: "No-Change Baseline",
    noChangeDesc: (band: string) =>
      `Always predicts tomorrow is flat. Correct only when the actual move was under ${band} -- which is rare, so this baseline is a low bar on purpose: it exists to catch a strategy that is actually worse than doing nothing, not to represent a realistic alternative.`,
    directionAccuracy: "Direction Accuracy",
    avgError: "Avg Error (MAE)",
    beatsNoChange: "Beats No-Change",
    belowNoChange: "Below No-Change",
    beatsCoinFlip: "Beats Coin Flip",
    belowCoinFlip: "Below Coin Flip",
    yearBreakdown: "Year-by-year breakdown",
    weekendBreakdown: "Weekday vs. weekend-gap breakdown",
    whatThisMeans: "What this actually means",
    twoBenchmarksIntro: "Two benchmarks are shown for direction accuracy because they answer different questions, and reading only one can be misleading:",
    vsNoChange: "vs the no-change baseline",
    vsNoChangeDesc: "AUD/THB is almost never perfectly flat day to day, so this baseline's own accuracy is usually only a few percent. Beating it is a very low bar and does not by itself mean a strategy works.",
    vsCoinFlip: "vs a coin flip (50%)",
    vsCoinFlipDesc: "the honest bar. A strategy that calls direction right less than half the time is worse than guessing, even if it comfortably beats the no-change baseline above.",
    verdictYes: "At least one strategy above clears both bars over this window -- still not proof of a tradeable edge (see caveats below), but worth watching alongside Track Record.",
    verdictNo: "Neither strategy above clears the coin-flip bar over this window: both called direction right less than half the time, despite comfortably beating the no-change baseline. This is a common, well-documented result in daily FX data -- short-horizon moves are close to a random walk, so a purely price-based signal on 5 days of history alone often has no real edge. Take the green \"Beats No-Change\" badges as a floor, not a verdict.",
    caveats: "Caveats",
    caveat1: "Trading costs, spreads, and slippage are not modelled -- these numbers are gross, not net of any cost to actually act on a signal.",
    caveat2: "One data source, one currency pair, one window. A different window or a different momentum length (not just 5 days) could read differently.",
    caveat3: "This tests only the price series. It cannot test the live model's macro, commodity, or risk factors, which have no comparable free daily history.",
    caveat4: "Past daily behavior is not a guarantee of future daily behavior.",
    methodology: (band: string, dataSource: string) =>
      `Methodology: same statistical definitions as the live Track Record (Evaluation) -- a move under ${band} counts as "no real move," the no-change baseline always predicts no move, and MAE is the average absolute error against the actual next-day move. Momentum bets tomorrow continues the trailing 5-day direction; Mean Reversion bets it reverses. Data is ${dataSource}'s official daily fixing, seeded by a one-time historical backfill and topped up daily by a cron job that fetches the same published series (see`,
    disclaimer: "AUD/THB Forecast Dashboard -- for research and monitoring purposes only, not financial advice.",
    days: "d",
  },
  th: {
    title: "Backtest",
    subtitle: "โมเมนตัมหรือ mean-reversion แบบง่าย ๆ มีความได้เปรียบทางสถิติกับ AUD/THB รายวันในอดีตจริงไหม?",
    calloutTitle: "นี่คือคนละคำถามกับ Track Record และไม่ใช่การเล่นซ้ำ Core FX Score แบบเรียลไทม์",
    calloutBody: (n: number) =>
      `Track Record (ในหน้าแดชบอร์ดหลัก) ให้คะแนนพยากรณ์จริงของโมเดลตามที่ผลลัพธ์ทยอยออกมา จึงมีประวัติแค่ไม่กี่สัปดาห์ ปัจจัยที่หนักที่สุดของโมเดล คือ Price/Momentum สร้างจากการเปลี่ยนแปลงระหว่างวันแบบ 1H/4H -- ซึ่งไม่มีแหล่งข้อมูลฟรีที่เผยแพร่ความละเอียดระดับนั้นย้อนหลังหลายปี หน้านี้จึงถามคำถามที่แคบลงและตอบได้จริงจาก ${n} วันซื้อขายของราคาปิดทางการ: ถ้าคุณดูแค่ 5 วันที่ผ่านมาแล้วทายว่าทิศทางจะต่อเนื่อง (momentum) หรือกลับทิศ (mean reversion) คุณจะทายพรุ่งนี้ถูกบ่อยกว่าสุ่ม หรือบ่อยกว่าการสมมุติว่าไม่มีอะไรเปลี่ยนไหม?`,
    dailyDirectionBacktest: "Backtest ทิศทางรายวัน",
    tradingDays: "วันซื้อขาย",
    noChangeBaseline: "Baseline ไม่เปลี่ยนแปลง",
    noChangeDesc: (band: string) =>
      `ทายว่าพรุ่งนี้ราคาเท่าเดิมเสมอ ถูกก็ต่อเมื่อการเคลื่อนไหวจริงต่ำกว่า ${band} เท่านั้น -- ซึ่งเกิดขึ้นน้อยมาก จึงตั้งใจให้ baseline นี้เป็นมาตรฐานที่ต่ำ: มีไว้จับกลยุทธ์ที่แย่กว่าการไม่ทำอะไรเลย ไม่ได้ตั้งใจให้เป็นทางเลือกที่สมจริง`,
    directionAccuracy: "ความแม่นยำทิศทาง",
    avgError: "ค่าคลาดเคลื่อนเฉลี่ย (MAE)",
    beatsNoChange: "ชนะ No-Change",
    belowNoChange: "แพ้ No-Change",
    beatsCoinFlip: "ชนะโยนเหรียญ",
    belowCoinFlip: "แพ้โยนเหรียญ",
    yearBreakdown: "รายละเอียดแยกตามปี",
    weekendBreakdown: "รายละเอียดวันทำการ vs ข้ามสุดสัปดาห์",
    whatThisMeans: "ความหมายที่แท้จริง",
    twoBenchmarksIntro: "แสดงเกณฑ์เทียบความแม่นยำทิศทางสองแบบ เพราะตอบคำถามคนละแบบ อ่านแค่อันเดียวอาจทำให้เข้าใจผิดได้:",
    vsNoChange: "เทียบกับ baseline ไม่เปลี่ยนแปลง",
    vsNoChangeDesc: "AUD/THB แทบไม่เคยเท่าเดิมทุกวัน ดังนั้นความแม่นยำของ baseline นี้เองมักมีแค่ไม่กี่เปอร์เซ็นต์ การชนะมันถือเป็นมาตรฐานที่ต่ำมาก และไม่ได้แปลว่ากลยุทธ์นั้นใช้ได้จริง",
    vsCoinFlip: "เทียบกับการโยนเหรียญ (50%)",
    vsCoinFlipDesc: "มาตรฐานที่ซื่อสัตย์กว่า กลยุทธ์ที่ทายทิศทางถูกน้อยกว่าครึ่งหนึ่งแย่กว่าการเดาสุ่ม แม้จะชนะ baseline ไม่เปลี่ยนแปลงด้านบนอย่างสบาย ๆ ก็ตาม",
    verdictYes: "มีอย่างน้อยหนึ่งกลยุทธ์ด้านบนที่ผ่านทั้งสองเกณฑ์ในช่วงนี้ -- ยังไม่ใช่หลักฐานว่ามีความได้เปรียบที่เทรดได้จริง (ดูข้อควรระวังด้านล่าง) แต่ควรจับตาดูควบคู่กับ Track Record",
    verdictNo: "ไม่มีกลยุทธ์ใดด้านบนผ่านเกณฑ์โยนเหรียญในช่วงนี้: ทั้งคู่ทายทิศทางถูกน้อยกว่าครึ่งหนึ่ง แม้จะชนะ baseline ไม่เปลี่ยนแปลงอย่างสบาย ๆ นี่เป็นผลลัพธ์ที่พบได้ทั่วไปในข้อมูล FX รายวัน -- การเคลื่อนไหวระยะสั้นใกล้เคียงกับการเดินสุ่ม ทำให้สัญญาณที่อิงราคาล้วน ๆ จาก 5 วันมักไม่มีความได้เปรียบจริง ให้ถือว่าป้ายสีเขียว \"ชนะ No-Change\" เป็นพื้นฐาน ไม่ใช่บทสรุป",
    caveats: "ข้อควรระวัง",
    caveat1: "ไม่ได้รวมต้นทุนการเทรด สเปรด และ slippage -- ตัวเลขเหล่านี้เป็นตัวเลขรวม ไม่ใช่หลังหักต้นทุนที่จะเทรดตามสัญญาณจริง",
    caveat2: "แหล่งข้อมูลเดียว คู่เงินเดียว ช่วงเวลาเดียว ถ้าใช้ช่วงเวลาอื่นหรือความยาวโมเมนตัมอื่น (ไม่ใช่แค่ 5 วัน) ผลอาจต่างออกไป",
    caveat3: "ทดสอบแค่ชุดข้อมูลราคาเท่านั้น ไม่สามารถทดสอบปัจจัย macro สินค้าโภคภัณฑ์ หรือความเสี่ยงของโมเดลจริง เพราะไม่มีข้อมูลย้อนหลังฟรีรายวันที่เทียบเคียงได้",
    caveat4: "พฤติกรรมรายวันในอดีตไม่ได้การันตีพฤติกรรมในอนาคต",
    methodology: (band: string, dataSource: string) =>
      `วิธีการ: ใช้นิยามทางสถิติเดียวกับ Track Record แบบเรียลไทม์ (Evaluation) -- การเคลื่อนไหวต่ำกว่า ${band} นับเป็น "ไม่มีการเคลื่อนไหวจริง" baseline ไม่เปลี่ยนแปลงทายว่าไม่ขยับเสมอ และ MAE คือค่าคลาดเคลื่อนสัมบูรณ์เฉลี่ยเทียบกับการเคลื่อนไหวจริงของวันถัดไป Momentum ทายว่าพรุ่งนี้จะไปทิศทางเดิมจาก 5 วันที่ผ่านมา ส่วน Mean Reversion ทายว่าจะกลับทิศ ข้อมูลมาจากราคาปิดทางการของ ${dataSource} เริ่มต้นจากการโหลดข้อมูลย้อนหลังครั้งเดียว แล้วเติมทุกวันด้วย cron job ที่ดึงชุดข้อมูลเดียวกัน (ดู`,
    disclaimer: "แดชบอร์ดพยากรณ์ AUD/THB -- ใช้เพื่อการวิจัยและติดตามเท่านั้น ไม่ใช่คำแนะนำทางการเงิน",
    days: "วัน",
  },
} as const;

// Collapsible per-year rows for one strategy, same disclosure pattern as
// the main dashboard's Score Breakdown factors -- an aggregate accuracy
// number can hide a strategy that only worked in one unusual year.
function YearBreakdown({ years, locale }: { years: BacktestYearResult[]; locale: Locale }) {
  const t = STR[locale];
  return (
    <details className="group mt-3">
      <summary className="flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-400 cursor-pointer list-none marker:content-none">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90"
        >
          <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t.yearBreakdown}
      </summary>

      <div className="mt-2 pl-5 divide-y divide-stone-200 dark:divide-stone-800">
        {years.map((y) => (
          <div key={y.year} className="flex items-center justify-between gap-3 py-1.5">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {y.year} <span className="text-stone-500">({y.sampleSize}{t.days})</span>
            </p>
            <div className="flex items-center gap-4">
              <Figure
                value={accuracyLabel(y.directionalAccuracy)}
                className={`text-xs font-semibold ${
                  y.beatsCoinFlip ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}
              />
              <Figure value={maeLabel(y.mae)} className="text-xs text-stone-600 dark:text-stone-400" />
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

// Same disclosure pattern again, split by whether the step spans a
// weekend (Friday's close to Monday's close) instead of by calendar
// year -- a separate question from Track Record's own weekend pattern,
// which is an artifact of hourly snapshots taken while markets sit
// closed rather than a real close-to-close comparison.
function WeekendGapBreakdown({ segments, locale }: { segments: BacktestSegmentResult[]; locale: Locale }) {
  const t = STR[locale];
  return (
    <details className="group mt-3">
      <summary className="flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-400 cursor-pointer list-none marker:content-none">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90"
        >
          <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t.weekendBreakdown}
      </summary>

      <div className="mt-2 pl-5 divide-y divide-stone-200 dark:divide-stone-800">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 py-1.5">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {s.label} <span className="text-stone-500">({s.sampleSize}{t.days})</span>
            </p>
            <div className="flex items-center gap-4">
              <Figure
                value={accuracyLabel(s.directionalAccuracy)}
                className={`text-xs font-semibold ${
                  s.beatsCoinFlip ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}
              />
              <Figure value={maeLabel(s.mae)} className="text-xs text-stone-600 dark:text-stone-400" />
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export default async function BacktestPage() {
  const locale = await getLocale();
  const summary = await getBacktestSummary(locale);
  const t = STR[locale];
  const neutralLabel = `${NEUTRAL_BAND_PCT}%`;
  const anyBeatsCoinFlip = summary.strategies.some((s) => s.beatsCoinFlip);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-masthead border-b border-brass-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
              &larr; AUD/THB Forecast Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">{t.title}</h1>
            <p className="text-stone-400 mt-1 text-sm sm:text-base">
              {t.subtitle}
            </p>
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-md bg-brass-50/60 dark:bg-brass-950/20 border border-brass-200/70 dark:border-brass-900/40 px-4 py-3 mb-8">
          <p className="text-sm font-semibold text-brass-900 dark:text-brass-200">
            {t.calloutTitle}
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
            {t.calloutBody(summary.sampleSize)}
          </p>
        </div>

        {summary.error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{summary.error}</p>
        ) : (
          <>
            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface divide-y divide-stone-200 dark:divide-stone-800">
              <div className="p-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
                  <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
                  {t.dailyDirectionBacktest}
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  {summary.dataFrom} -- {summary.dataTo} ({summary.sampleSize} {t.tradingDays}) -- {summary.dataSource}
                </p>
              </div>

              <div className="p-6">
                <p className="text-sm font-semibold">{t.noChangeBaseline}</p>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  {t.noChangeDesc(neutralLabel)}
                </p>

                <div className="grid grid-cols-2 gap-4 mt-3 pb-4 border-b border-stone-200 dark:border-stone-800">
                  <div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{t.directionAccuracy}</p>
                    <Figure value={accuracyLabel(summary.baseline.directionalAccuracy)} className="block text-lg font-semibold" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{t.avgError}</p>
                    <Figure value={maeLabel(summary.baseline.mae)} className="block text-lg font-semibold" />
                  </div>
                </div>

                {summary.strategies.map((s) => (
                  <div key={s.name} className="pt-4 pb-2 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{s.name}</p>
                        <p className="text-xs text-stone-600 dark:text-stone-400">{s.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge
                          label={s.beatsBaselineDirectionally ? t.beatsNoChange : t.belowNoChange}
                          tone={s.beatsBaselineDirectionally ? "emerald" : "slate"}
                        />
                        <StatusBadge
                          label={s.beatsCoinFlip ? t.beatsCoinFlip : t.belowCoinFlip}
                          tone={s.beatsCoinFlip ? "emerald" : "red"}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-stone-600 dark:text-stone-400">{t.directionAccuracy}</p>
                        <Figure
                          value={accuracyLabel(s.directionalAccuracy)}
                          className={`block text-lg font-semibold ${
                            s.beatsCoinFlip
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-red-700 dark:text-red-400"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-stone-600 dark:text-stone-400">{t.avgError}</p>
                        <Figure
                          value={maeLabel(s.mae)}
                          className={`block text-lg font-semibold ${
                            s.beatsBaselineOnMae
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-stone-700 dark:text-stone-300"
                          }`}
                        />
                      </div>
                    </div>

                    <YearBreakdown years={s.byYear} locale={locale} />
                    <WeekendGapBreakdown segments={s.byWeekendGap} locale={locale} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface p-6 mt-6">
              <h2 className="text-sm font-semibold tracking-tight text-stone-600 dark:text-stone-400 uppercase tracking-widest">
                {t.whatThisMeans}
              </h2>
              <p className="text-sm mt-3 leading-relaxed">
                {t.twoBenchmarksIntro}
              </p>
              <ul className="text-sm mt-2 space-y-2 list-disc pl-5 leading-relaxed">
                <li>
                  <span className="font-semibold">{t.vsNoChange}</span> -- {t.vsNoChangeDesc}
                </li>
                <li>
                  <span className="font-semibold">{t.vsCoinFlip}</span> -- {t.vsCoinFlipDesc}
                </li>
              </ul>
              <p className="text-sm mt-3 leading-relaxed">
                {anyBeatsCoinFlip ? t.verdictYes : t.verdictNo}
              </p>
              <h3 className="text-sm font-semibold mt-4">{t.caveats}</h3>
              <ul className="text-sm mt-2 space-y-1.5 list-disc pl-5 leading-relaxed text-stone-600 dark:text-stone-400">
                <li>{t.caveat1}</li>
                <li>{t.caveat2}</li>
                <li>{t.caveat3}</li>
                <li>{t.caveat4}</li>
              </ul>
            </div>
          </>
        )}

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-6 leading-relaxed">
          {t.methodology(neutralLabel, summary.dataSource)}{" "}
          <code className="text-[11px]">supabase/migrations/20260920_create_backtest_daily_rates.sql</code>).
        </p>

        <p className="text-center text-xs text-stone-600 dark:text-stone-400 mt-6 mb-6">
          {t.disclaimer}
        </p>
      </div>
    </main>
  );
}
