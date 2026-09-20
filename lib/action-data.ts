import "server-only";
import type { DashboardData } from "@/lib/dashboard-data";
import { getConfidence } from "@/lib/confidence-data";
import { getEventRisk } from "@/lib/event-calendar-data";
import { tLabel, type Locale } from "@/lib/i18n";

export type ActionSummary = {
  headline: string;
  detail: string;
};

const STR = {
  en: {
    noScore: "No score available right now -- nothing to summarize.",
    strongBullish: "Signals lean strongly toward AUD strengthening against THB today.",
    bullish: "Signals lean toward AUD strengthening against THB today.",
    strongBearish: "Signals lean strongly toward AUD weakening against THB today.",
    bearish: "Signals lean toward AUD weakening against THB today.",
    mixed: "Signals are mixed or close to flat -- no clear lean either way today.",
    confidenceIs: (level: string) => `Confidence in this read is ${level}.`,
    highEvent: (name: string) => `A high-impact event is imminent (${name}) and can override these signals.`,
    watchEvent: (name: string) => `A high-impact event is coming up this week (${name}), worth watching.`,
    notAdvice: "This describes the model's current signals -- it is not financial advice.",
  },
  th: {
    noScore: "ไม่มีคะแนนในขณะนี้ -- ไม่มีอะไรให้สรุป",
    strongBullish: "สัญญาณเอียงไปทาง AUD แข็งค่าเทียบ THB อย่างชัดเจนวันนี้",
    bullish: "สัญญาณเอียงไปทาง AUD แข็งค่าเทียบ THB วันนี้",
    strongBearish: "สัญญาณเอียงไปทาง AUD อ่อนค่าเทียบ THB อย่างชัดเจนวันนี้",
    bearish: "สัญญาณเอียงไปทาง AUD อ่อนค่าเทียบ THB วันนี้",
    mixed: "สัญญาณผสมกันหรือใกล้เคียงเป็นกลาง -- วันนี้ยังไม่มีทิศทางชัดเจน",
    confidenceIs: (level: string) => `ความมั่นใจของการอ่านครั้งนี้อยู่ในระดับ${level}`,
    highEvent: (name: string) => `มีข่าวผลกระทบสูงใกล้เข้ามา (${name}) ซึ่งอาจเปลี่ยนสัญญาณเหล่านี้ได้`,
    watchEvent: (name: string) => `มีข่าวผลกระทบสูงในสัปดาห์นี้ (${name}) ควรจับตาดู`,
    notAdvice: "ข้อความนี้อธิบายสัญญาณปัจจุบันของโมเดล -- ไม่ใช่คำแนะนำทางการเงิน",
  },
} as const;

// Workflow H: turns the Core FX Score + Confidence (F) + Event Risk (G)
// -- three signals that already exist elsewhere on the page -- into one
// plain-language sentence, instead of leaving a user to cross-reference
// three cards themselves. Deliberately descriptive ("the model leans...")
// and never prescriptive ("you should...") -- this restates what the
// model's own signals say today, it is not trading advice, and says so.
export async function getActionSummary(data: DashboardData, locale: Locale = "th"): Promise<ActionSummary> {
  const confidence = await getConfidence(data, locale);
  const eventRisk = await getEventRisk();
  const t = STR[locale];

  const bias = data.coreBias;
  const score = data.coreFxScore;

  let headline: string;
  if (score === null) {
    headline = t.noScore;
  } else if (bias.includes("Bullish")) {
    headline = bias.startsWith("Strong") ? t.strongBullish : t.bullish;
  } else if (bias.includes("Bearish")) {
    headline = bias.startsWith("Strong") ? t.strongBearish : t.bearish;
  } else {
    headline = t.mixed;
  }

  const detailParts: string[] = [t.confidenceIs(tLabel(confidence.level, locale).toLowerCase())];

  if (eventRisk.level !== "NONE" && eventRisk.event) {
    detailParts.push(
      eventRisk.level === "HIGH" ? t.highEvent(eventRisk.event.eventName) : t.watchEvent(eventRisk.event.eventName),
    );
  }

  detailParts.push(t.notAdvice);

  return { headline, detail: detailParts.join(" ") };
}
