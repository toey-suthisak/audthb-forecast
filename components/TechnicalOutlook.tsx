import type { TechnicalOutlook as TechnicalOutlookData } from "@/lib/technical-outlook-data";
import Figure from "@/components/Figure";
import StatusLight from "@/components/StatusLight";
import type { Locale } from "@/lib/i18n";

const STR = {
  en: {
    title: "Technical Outlook",
    pivot: "Pivot",
    resistance: "Resistance",
    support: "Support",
    swingRange: (days: number) => `${days}-day range`,
    actionBias: "Action bias",
    basedOn: (date: string) => `Pivot based on ${date}'s close`,
  },
  th: {
    title: "มุมมองทางเทคนิค",
    pivot: "จุดหมุน",
    resistance: "แนวต้าน",
    support: "แนวรับ",
    swingRange: (days: number) => `กรอบ ${days} วัน`,
    actionBias: "แนวทาง Action",
    basedOn: (date: string) => `คำนวณ Pivot จากราคาปิดวันที่ ${date}`,
  },
} as const;

function biasColor(direction: TechnicalOutlookData["actionBias"]["direction"]) {
  if (direction === "POSTFUND") return "text-emerald-700 dark:text-emerald-400";
  if (direction === "PREFUND") return "text-red-700 dark:text-red-400";
  return "text-stone-500 dark:text-stone-400";
}

export default function TechnicalOutlook({
  outlook,
  locale,
}: {
  outlook: TechnicalOutlookData;
  locale: Locale;
}) {
  const t = STR[locale];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
        <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
        {t.title}
      </h2>

      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
        {outlook.disclaimer}
      </p>

      {!outlook.available || !outlook.pivots ? (
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-3">
          {outlook.error}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.resistance} 2</p>
              <Figure value={outlook.pivots.r2.toFixed(4)} className="block text-base font-semibold" />
            </div>
            <div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.resistance} 1</p>
              <Figure value={outlook.pivots.r1.toFixed(4)} className="block text-base font-semibold" />
            </div>
            <div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.support} 1</p>
              <Figure value={outlook.pivots.s1.toFixed(4)} className="block text-base font-semibold" />
            </div>
            <div>
              <p className="text-xs text-stone-600 dark:text-stone-400">{t.support} 2</p>
              <Figure value={outlook.pivots.s2.toFixed(4)} className="block text-base font-semibold" />
            </div>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-500 mt-2">
            {t.pivot}: <Figure value={outlook.pivots.pivot.toFixed(4)} className="font-semibold" /> ({t.basedOn(outlook.pivots.basedOnDate)})
            {outlook.swingHigh !== null && outlook.swingLow !== null ? (
              <> · {t.swingRange(outlook.swingLookbackDays)}: {outlook.swingLow.toFixed(4)} - {outlook.swingHigh.toFixed(4)}</>
            ) : null}
          </p>

          <ul className="mt-4 space-y-1.5 text-sm text-stone-700 dark:text-stone-300 list-disc list-inside">
            {outlook.narrative.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>

          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
            <p className="text-xs text-stone-600 dark:text-stone-400">{t.actionBias}</p>
            <p className={`text-base font-semibold ${biasColor(outlook.actionBias.direction)}`}>
              {outlook.actionBias.label}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-500 mt-1 leading-relaxed">
              {outlook.actionBias.note}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
