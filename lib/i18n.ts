// Client-and-server-safe i18n primitives. Deliberately has no
// "server-only" import (unlike lib/i18n-server.ts) so client components
// like StickyBar/Alerts/LanguageToggle can use the label helpers below
// without pulling next/headers into the client bundle.

export type Locale = "th" | "en";

export const LOCALE_COOKIE = "lang";

// Short enum-like labels shown as-is today (raw freshness status badges,
// coreBias, forecast direction) -- English stays byte-for-byte identical
// to before this feature, Thai looks the value up here. One shared table
// so the same English value always reads the same way in Thai wherever
// it appears, instead of drifting per component.
const TH_LABELS: Record<string, string> = {
  FRESH: "สด",
  DELAYED: "ล่าช้า",
  STALE: "เก่า",
  MARKET_CLOSED: "ตลาดปิด",
  MISSING: "ไม่มีข้อมูล",
  GOOD: "ปกติ",
  "Strong Bullish": "ขาขึ้นแรง",
  Bullish: "ขาขึ้น",
  "Strong Bearish": "ขาลงแรง",
  Bearish: "ขาลง",
  Neutral: "เป็นกลาง",
  "Waiting for data": "รอข้อมูล",
  BULLISH: "ขาขึ้น",
  BEARISH: "ขาลง",
  NEUTRAL: "เป็นกลาง",
  HIGH: "สูง",
  MEDIUM: "ปานกลาง",
  LOW: "ต่ำ",
  Uncalibrated: "ยังไม่ปรับเทียบ",
  "Reference Only": "อ้างอิงเท่านั้น",
  "Monitor Only": "ติดตามเท่านั้น",
  "HIGH IMPACT": "ผลกระทบสูง",
  Yes: "ใช่",
  No: "ไม่ใช่",
  Experimental: "ทดลอง",
  Disabled: "ปิดใช้งาน",
  HOLIDAY: "วันหยุด",
};

export function tLabel(label: string, locale: Locale): string {
  if (locale === "en") return label;
  return TH_LABELS[label] ?? label;
}

// MarketRates/CrossCheck's own "friendly" freshness label (FRESH ->
// "LIVE" in English, already shipped) -- Thai translates the friendly
// label, not the raw enum, so it stays a rename in both languages.
const FRESHNESS_FRIENDLY_EN: Record<string, string> = {
  FRESH: "LIVE",
  DELAYED: "DELAYED",
  STALE: "STALE",
  MARKET_CLOSED: "MARKET CLOSED",
  MISSING: "NO DATA",
};

const FRESHNESS_FRIENDLY_TH: Record<string, string> = {
  FRESH: "สด",
  DELAYED: "ล่าช้า",
  STALE: "ข้อมูลเก่า",
  MARKET_CLOSED: "ตลาดปิด",
  MISSING: "ไม่มีข้อมูล",
};

export function freshnessLabel(status: string, locale: Locale): string {
  return (locale === "en" ? FRESHNESS_FRIENDLY_EN : FRESHNESS_FRIENDLY_TH)[status] ?? status;
}
