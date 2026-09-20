import Link from "next/link";
import type { ConsensusEvent, ConsensusLean } from "@/lib/economic-consensus-data";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import StatusLight from "@/components/StatusLight";
import InfoTip from "@/components/InfoTip";
import type { Locale } from "@/lib/i18n";

function importanceColor(impact: string) {
  if (impact === "HIGH") return "text-red-700 dark:text-red-400";
  if (impact === "MEDIUM") return "text-amber-700 dark:text-amber-400";
  return "text-stone-600 dark:text-stone-400";
}

function formatEventDate(eventDate: string, locale: Locale) {
  return new Date(eventDate).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

const STR = {
  en: {
    title: "Market Consensus",
    titleTooltip:
      "Forecast/previous/actual values for this week's High/Medium-impact AUD/USD/THB releases, from ForexFactory's public calendar. The up/down badge (where shown) is our own hand-coded textbook polarity for a handful of common indicator types, not ForexFactory's own guidance -- a reading aid, not a tested signal. No badge means the indicator type isn't in that list; read the raw numbers yourself. For a USD event, this is USD's own direction, not a translated AUD/THB call.",
    noEvents: "No High/Medium-impact events with consensus data this week.",
    viewFull: "View full economic calendar (all currencies) →",
    actual: "Actual",
    forecast: "forecast",
    previous: "previous",
    previousOnly: (v: string) => `Previous ${v}`,
    noPublished: "No forecast/previous published",
    neutral: "NEUTRAL",
    basisActual: "actual vs. forecast (the real surprise)",
    basisForecast: "forecast vs. previous (the expected direction of change)",
    leanTooltip: (basis: string) =>
      `Derived from ${basis} using a hand-coded textbook polarity for this indicator type (e.g. higher employment is bullish, higher unemployment is bearish) -- our own convention, not ForexFactory's own guidance.`,
    pairNote: (currency: string) =>
      ` This is ${currency}'s own direction, not a translated AUD/THB call -- a stronger ${currency} ` +
      `doesn't necessarily mean a weaker AUD/THB (e.g. a stronger USD tends to pressure both AUD and THB together, ` +
      `so that pair's net effect is muted, not simply 'AUD down'). Judge relevance to AUD/THB yourself.`,
  },
  th: {
    title: "มติตลาด",
    titleTooltip:
      "ค่า forecast/previous/actual ของข่าวผลกระทบ High/Medium ของ AUD/USD/THB ในสัปดาห์นี้ จากปฏิทินสาธารณะของ ForexFactory ป้ายขึ้น/ลง (ถ้ามี) เป็น polarity แบบตำราที่เราเขียนขึ้นเองสำหรับตัวชี้วัดบางประเภท ไม่ใช่คำแนะนำของ ForexFactory เอง -- เป็นแค่ตัวช่วยอ่าน ไม่ใช่สัญญาณที่ผ่านการทดสอบ ถ้าไม่มีป้ายแสดงว่าตัวชี้วัดนั้นไม่อยู่ในรายการ ให้อ่านตัวเลขดิบเอง สำหรับข่าว USD นี่คือทิศทางของ USD เอง ไม่ใช่การแปลงเป็นทิศทาง AUD/THB",
    noEvents: "ไม่มีข่าวผลกระทบ High/Medium ที่มีข้อมูลมติตลาดในสัปดาห์นี้",
    viewFull: "ดูปฏิทินเศรษฐกิจแบบเต็ม (ทุกสกุลเงิน) →",
    actual: "จริง",
    forecast: "คาดการณ์",
    previous: "ครั้งก่อน",
    previousOnly: (v: string) => `ครั้งก่อน ${v}`,
    noPublished: "ไม่มีข้อมูล forecast/previous เผยแพร่",
    neutral: "เป็นกลาง",
    basisActual: "จริงเทียบกับคาดการณ์ (surprise จริง)",
    basisForecast: "คาดการณ์เทียบกับครั้งก่อน (ทิศทางที่คาดว่าจะเปลี่ยน)",
    leanTooltip: (basis: string) =>
      `คำนวณจาก${basis} โดยใช้ polarity แบบตำราที่เขียนขึ้นเองสำหรับตัวชี้วัดประเภทนี้ (เช่น การจ้างงานสูงขึ้น = ขาขึ้น, คนตกงานมากขึ้น = ขาลง) -- เป็นข้อกำหนดของเราเอง ไม่ใช่คำแนะนำของ ForexFactory`,
    pairNote: (currency: string) =>
      ` นี่คือทิศทางของ ${currency} เอง ไม่ใช่การแปลงเป็นทิศทาง AUD/THB -- ${currency} ที่แข็งค่าขึ้น ` +
      `ไม่ได้แปลว่า AUD/THB จะอ่อนค่าเสมอไป (เช่น USD ที่แข็งค่ามักกดทั้ง AUD และ THB ไปในทางเดียวกัน ` +
      `ทำให้ผลกระทบต่อคู่นี้จืดลง ไม่ใช่ "AUD ลง" ตรงๆ) ควรพิจารณาความเกี่ยวข้องกับ AUD/THB ด้วยตัวเอง`,
  },
} as const;

function leanLabel(currency: string, lean: ConsensusLean, locale: Locale) {
  if (lean === "BULLISH") return `${currency} ↑`;
  if (lean === "BEARISH") return `${currency} ↓`;
  return STR[locale].neutral;
}

function leanTone(lean: ConsensusLean): BadgeTone {
  if (lean === "BULLISH") return "emerald";
  if (lean === "BEARISH") return "red";
  return "slate";
}

function leanTooltip(event: ConsensusEvent, locale: Locale) {
  const t = STR[locale];
  const basis = event.leanBasis === "actual_vs_forecast" ? t.basisActual : t.basisForecast;
  const pairNote = event.currency === "AUD" ? "" : t.pairNote(event.currency);
  return t.leanTooltip(basis) + pairNote;
}

function ConsensusRow({ event, locale }: { event: ConsensusEvent; locale: Locale }) {
  const t = STR[locale];
  const hasNumbers = event.forecastValue !== null || event.previousValue !== null || event.actualValue !== null;

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-stone-200 dark:border-stone-800 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm">
          <span className={`font-semibold ${importanceColor(event.impact)}`}>{event.currency}</span>{" "}
          {event.eventName}
        </p>

        {hasNumbers ? (
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
            {event.actualValue !== null ? (
              <>
                {t.actual} <span className="text-stone-700 dark:text-stone-300">{event.actualValue}</span>
                {event.forecastValue !== null && <> ({t.forecast} {event.forecastValue})</>}
                {event.previousValue !== null && <>, {t.previous} {event.previousValue}</>}
              </>
            ) : event.forecastValue !== null ? (
              <>
                {t.forecast[0].toUpperCase() + t.forecast.slice(1)}{" "}
                <span className="text-stone-700 dark:text-stone-300">{event.forecastValue}</span>
                {event.previousValue !== null && <>, {t.previous} {event.previousValue}</>}
              </>
            ) : (
              <>{t.previousOnly(event.previousValue!)}</>
            )}
          </p>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-500 mt-0.5 italic">{t.noPublished}</p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {event.lean && (
          <div className="inline-flex items-center">
            <StatusBadge label={leanLabel(event.currency, event.lean, locale)} tone={leanTone(event.lean)} />
            <InfoTip text={leanTooltip(event, locale)} />
          </div>
        )}
        <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{formatEventDate(event.eventDate, locale)}</p>
      </div>
    </div>
  );
}

export default function MarketConsensus({ consensus, locale }: { consensus: ConsensusEvent[]; locale: Locale }) {
  const t = STR[locale];
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-amber-500 dark:text-amber-400" />
        {t.title}
        <InfoTip text={t.titleTooltip} />
      </h2>

      <div className="mt-3">
        {consensus.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t.noEvents}
          </p>
        ) : (
          <div>
            {consensus.map((event) => (
              <ConsensusRow key={`${event.eventDate}-${event.currency}-${event.eventName}`} event={event} locale={locale} />
            ))}
          </div>
        )}
      </div>

      <Link
        href="/economic-calendar"
        className="mt-4 inline-block text-xs font-medium text-brass-700 dark:text-brass-400 hover:underline underline-offset-2"
      >
        {t.viewFull}
      </Link>
    </div>
  );
}
