import Link from "next/link";
import { getBacktestSummary } from "@/lib/backtest-data";
import Figure from "@/components/Figure";
import StatusLight from "@/components/StatusLight";
import type { Locale } from "@/lib/i18n";

function accuracyLabel(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function accuracyColor(beatsCoinFlip: boolean) {
  return beatsCoinFlip ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400";
}

const STR = {
  en: {
    title: "Backtest",
    intro: (sampleSize: number, dataSource: string, dataFrom: string, dataTo: string) =>
      `A separate question from Track Record above: tested on ${sampleSize} trading days of ${dataSource}'s daily closes (${dataFrom} to ${dataTo}) -- not a replay of the live Core FX Score, which needs intraday data no free historical source publishes.`,
    noChangeBaseline: "No-Change Baseline",
    footer:
      "Direction accuracy shown in red is below a 50% coin flip -- beating the no-change baseline above is a low bar on its own. See the full breakdown, both benchmarks, and caveats on the backtest page.",
    fullResults: "Full methodology & results →",
  },
  th: {
    title: "Backtest",
    intro: (sampleSize: number, dataSource: string, dataFrom: string, dataTo: string) =>
      `คนละคำถามกับ Track Record ด้านบน: ทดสอบกับราคาปิดรายวัน ${sampleSize} วันซื้อขายจาก ${dataSource} (${dataFrom} ถึง ${dataTo}) -- ไม่ใช่การเล่นซ้ำ Core FX Score แบบเรียลไทม์ ซึ่งต้องใช้ข้อมูลระหว่างวันที่ไม่มีแหล่งฟรีเผยแพร่`,
    noChangeBaseline: "Baseline ไม่เปลี่ยนแปลง",
    footer:
      "ความแม่นยำทิศทางที่แสดงเป็นสีแดงต่ำกว่าการโยนเหรียญ 50% -- การชนะ baseline ไม่เปลี่ยนแปลงด้านบนถือเป็นมาตรฐานที่ต่ำอยู่แล้ว ดูรายละเอียดเต็ม เกณฑ์เทียบทั้งสอง และข้อควรระวังได้ที่หน้า backtest",
    fullResults: "วิธีการและผลลัพธ์แบบเต็ม →",
  },
} as const;

// A short, honest preview of the /backtest page -- a different question
// from Track Record above (which grades the live model's own forecasts):
// does simple price-only momentum or mean-reversion have historical edge
// on daily AUD/THB at all? Full methodology, caveats, and the coin-flip
// vs no-change-baseline distinction live on the dedicated page; this
// card exists so the headline numbers don't require a click to see.
export default async function BacktestPreview({ locale }: { locale: Locale }) {
  const summary = await getBacktestSummary(locale);
  const t = STR[locale];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
        {t.title}
      </h2>
      <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
        {t.intro(summary.sampleSize, summary.dataSource, summary.dataFrom, summary.dataTo)}
      </p>

      {summary.error ? (
        <p className="text-sm text-red-700 dark:text-red-400 mt-3">{summary.error}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className="text-xs text-stone-600 dark:text-stone-400">{t.noChangeBaseline}</p>
            <Figure value={accuracyLabel(summary.baseline.directionalAccuracy)} className="block text-lg font-semibold" />
          </div>

          {summary.strategies.map((s) => (
            <div key={s.name}>
              <p className="text-xs text-stone-600 dark:text-stone-400">{s.name}</p>
              <Figure value={accuracyLabel(s.directionalAccuracy)} className={`block text-lg font-semibold ${accuracyColor(s.beatsCoinFlip)}`} />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-600 dark:text-stone-400 mt-3">
        {t.footer}
      </p>

      <Link
        href="/backtest"
        className="inline-block text-xs font-medium text-brass-700 dark:text-brass-400 hover:underline underline-offset-2 mt-3"
      >
        {t.fullResults}
      </Link>
    </div>
  );
}
