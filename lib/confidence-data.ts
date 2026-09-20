import "server-only";
import { getEventRisk } from "@/lib/event-calendar-data";
import type { DashboardData } from "@/lib/dashboard-data";
import type { Locale } from "@/lib/i18n";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type Confidence = {
  level: ConfidenceLevel;
  reasons: string[];
};

const STR = {
  en: {
    coverage: (n: string) => `Model coverage is only ${n}/100`,
    coreFeedStale: "Not every core price feed is fresh right now",
    watchEvent: "A high-impact event is on the calendar this week",
    highEvent: "A high-impact event is due within 24 hours -- expect the score to move",
    allGood: "All core feeds are fresh and no high-impact event is imminent",
  },
  th: {
    coverage: (n: string) => `ความครบถ้วนของข้อมูลมีแค่ ${n}/100`,
    coreFeedStale: "ยังไม่ใช่ทุกฟีดราคาหลักที่เป็นข้อมูลสด",
    watchEvent: "มีข่าวผลกระทบสูงในปฏิทินสัปดาห์นี้",
    highEvent: "มีข่าวผลกระทบสูงภายใน 24 ชั่วโมงข้างหน้า -- คาดว่าคะแนนจะเปลี่ยนแปลง",
    allGood: "ฟีดข้อมูลหลักทั้งหมดเป็นข้อมูลสด และไม่มีข่าวผลกระทบสูงใกล้เข้ามา",
  },
} as const;

// Workflow F: a single plain-language read on how much to trust the
// Core FX Score right now. Not a new score -- just a summary of signals
// that already exist elsewhere on the page (Model Coverage, core feed
// freshness, Event Risk) so a user doesn't have to cross-reference three
// separate cards themselves to answer "should I trust this number today?".
export async function getConfidence(data: DashboardData, locale: Locale = "th"): Promise<Confidence> {
  const eventRisk = await getEventRisk();
  const t = STR[locale];
  const reasons: string[] = [];
  let tier: 0 | 1 | 2 = 2;

  if (data.availableCoreWeight < 70) {
    tier = Math.min(tier, 1) as 0 | 1;
    reasons.push(t.coverage(data.availableCoreWeight.toFixed(0)));
  }
  if (data.availableCoreWeight < 40) {
    tier = 0;
  }

  const coreFeeds = [
    data.directFreshness.status,
    data.audUsdFreshness.status,
    data.usdThbFreshness.status,
  ];
  if (coreFeeds.some((status) => status !== "FRESH")) {
    tier = Math.min(tier, 1) as 0 | 1;
    reasons.push(t.coreFeedStale);
  }

  if (eventRisk.level === "WATCH") {
    tier = Math.min(tier, 1) as 0 | 1;
    reasons.push(t.watchEvent);
  }
  if (eventRisk.level === "HIGH") {
    tier = 0;
    reasons.push(t.highEvent);
  }

  if (reasons.length === 0) {
    reasons.push(t.allGood);
  }

  return {
    level: tier === 2 ? "HIGH" : tier === 1 ? "MEDIUM" : "LOW",
    reasons,
  };
}
