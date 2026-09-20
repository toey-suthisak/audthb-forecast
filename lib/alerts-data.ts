import "server-only";
import type { DashboardData, FreshnessStatus } from "@/lib/dashboard-data";
import { getMacroCompositeData } from "@/lib/macro-composite-data";
import { getEventRisk } from "@/lib/event-calendar-data";
import { getRecentNewsSignals } from "@/lib/news-sentiment-data";
import { tLabel, type Locale } from "@/lib/i18n";

// Surfaces "is a feed/job actually working right now" alerts, distinct
// from DataHealth (which only covers the 3 core FX rates). There is no
// dedicated cron-execution-log table in the schema, so staleness/missing
// data is used as the practical proxy for a failed ingest job -- if a
// feed hasn't updated in longer than its normal cadence, either the
// provider or the Supabase Cron job behind it is not working.

export type AlertSeverity = "critical" | "warning";

export type Alert = {
  severity: AlertSeverity;
  label: string;
  detail: string;
};

const STR = {
  en: {
    missing: "No data returned at all -- the feed or its ingest job is not producing rows.",
    stale: (age: string) => `Data is stale (${age}) -- ingest cron may have failed, or the provider stopped responding.`,
    ageOld: (v: number, unit: string) => `${v} ${unit} old`,
    ageUnknown: "age unknown",
    yieldStale: (status: string, gap: string) =>
      `Yield spread data is ${status} (gap: ${gap} days) -- DBnomics sync may have failed.`,
    macroNoData: "No usable data this run -- excluded from Macro Score, other Macro components unaffected.",
    eventLabel: (name: string) => `Event Risk: ${name}`,
    eventDetail: (currency: string, hours: string, level: string) =>
      `${currency} -- in ${hours} (${level}) -- expect volatility, treat the Core FX Score with extra caution.`,
    newsLabel: (title: string) => `News Signal: ${title}`,
    min: "min",
    hr: "hr",
    labels: {
      direct: "AUD/THB direct",
      audUsd: "AUD/USD",
      usdThb: "USD/THB",
      usdCnh: "USD/CNH",
      usdSgd: "USD/SGD",
      gold: "Gold",
      brent: "Brent (live)",
      ironOre: "Iron Ore",
      risk: "Risk / VIXY",
      yield: "AU-US 2Y Yield",
      macroPolicy: "Macro: Policy (RBA/Fed/BOT)",
      macroInflation: "Macro: Inflation",
      macroLabour: "Macro: Labour",
      macroGrowth: "Macro: Growth (GDP, experimental)",
    },
  },
  th: {
    missing: "ไม่มีข้อมูลส่งกลับมาเลย -- ฟีดหรือ ingest job ไม่ได้สร้างข้อมูล",
    stale: (age: string) => `ข้อมูลเก่า (${age}) -- ingest cron อาจล้มเหลว หรือผู้ให้บริการหยุดตอบสนอง`,
    ageOld: (v: number, unit: string) => `${v} ${unit}ที่แล้ว`,
    ageUnknown: "ไม่ทราบอายุข้อมูล",
    yieldStale: (status: string, gap: string) =>
      `ข้อมูลส่วนต่างผลตอบแทนพันธบัตร${status} (ห่างไป: ${gap} วัน) -- การซิงค์ DBnomics อาจล้มเหลว`,
    macroNoData: "ไม่มีข้อมูลที่ใช้ได้ในรอบนี้ -- ถูกตัดออกจาก Macro Score ส่วนอื่นของ Macro ไม่กระทบ",
    eventLabel: (name: string) => `ความเสี่ยงจากข่าว: ${name}`,
    eventDetail: (currency: string, hours: string, level: string) =>
      `${currency} -- ในอีก ${hours} (${level}) -- คาดว่าจะผันผวน ควรใช้ Core FX Score ด้วยความระมัดระวังเป็นพิเศษ`,
    newsLabel: (title: string) => `สัญญาณข่าว: ${title}`,
    min: "นาที",
    hr: "ชม.",
    labels: {
      direct: "AUD/THB โดยตรง",
      audUsd: "AUD/USD",
      usdThb: "USD/THB",
      usdCnh: "USD/CNH",
      usdSgd: "USD/SGD",
      gold: "ทองคำ",
      brent: "น้ำมันเบรนท์ (เรียลไทม์)",
      ironOre: "แร่เหล็ก",
      risk: "ความเสี่ยง / VIXY",
      yield: "ส่วนต่างผลตอบแทนพันธบัตร AU-US 2 ปี",
      macroPolicy: "Macro: นโยบาย (RBA/Fed/BOT)",
      macroInflation: "Macro: เงินเฟ้อ",
      macroLabour: "Macro: แรงงาน",
      macroGrowth: "Macro: การเติบโต (GDP, ทดลอง)",
    },
  },
} as const;

function freshnessAlert(
  label: string,
  status: FreshnessStatus | "FRESH" | "DELAYED" | "STALE" | "MISSING",
  ageValue: number | null,
  unit: "min" | "hr",
  t: (typeof STR)[Locale],
): Alert | null {
  if (status === "MISSING") {
    return {
      severity: "critical",
      label,
      detail: t.missing,
    };
  }

  if (status === "STALE") {
    const unitLabel = unit === "min" ? t.min : t.hr;
    const age = ageValue !== null ? t.ageOld(ageValue, unitLabel) : t.ageUnknown;
    return {
      severity: "warning",
      label,
      detail: t.stale(age),
    };
  }

  return null;
}

export async function getAlerts(data: DashboardData, locale: Locale = "th"): Promise<Alert[]> {
  const t = STR[locale];
  const l = t.labels;

  const candidates: Array<Alert | null> = [
    freshnessAlert(l.direct, data.directFreshness.status, data.directFreshness.ageMinutes, "min", t),
    freshnessAlert(l.audUsd, data.audUsdFreshness.status, data.audUsdFreshness.ageMinutes, "min", t),
    freshnessAlert(l.usdThb, data.usdThbFreshness.status, data.usdThbFreshness.ageMinutes, "min", t),
    freshnessAlert(l.usdCnh, data.usdCnhFreshness.status, data.usdCnhFreshness.ageMinutes, "min", t),
    freshnessAlert(l.usdSgd, data.usdSgdFreshness.status, data.usdSgdFreshness.ageMinutes, "min", t),

    freshnessAlert(l.gold, data.goldFreshness, data.goldAgeMinutes, "min", t),
    freshnessAlert(l.brent, data.brentLiveFreshness, data.brentLiveAgeMinutes, "min", t),
    freshnessAlert(l.ironOre, data.ironOreFreshness, data.ironOreAgeHours, "hr", t),
  ];

  // MARKET_CLOSED is an expected state for Risk/VIXY outside market hours -- not an alert.
  if (data.riskFreshness !== "MARKET_CLOSED") {
    candidates.push(freshnessAlert(l.risk, data.riskFreshness, data.riskAgeMinutes, "min", t));
  }

  if (data.yieldConfidence === "STALE" || data.yieldConfidence === "MISSING") {
    candidates.push({
      severity: data.yieldConfidence === "MISSING" ? "critical" : "warning",
      label: l.yield,
      detail: t.yieldStale(tLabel(data.yieldConfidence, locale).toLowerCase(), String(data.yieldDataGapDays ?? "?")),
    });
  }

  // Each Macro sub-component fails independently by design (see fix
  // 24b5362) -- a component at 0 coverage means it silently dropped out
  // of this run's Macro Score rather than the whole category failing.
  const macro = await getMacroCompositeData();
  const macroChecks: Array<{ label: string; coverage: number }> = [
    { label: l.macroPolicy, coverage: macro.policy.coverage },
    { label: l.macroInflation, coverage: macro.inflation.coverage },
    { label: l.macroLabour, coverage: macro.labour.coverage },
    { label: l.macroGrowth, coverage: macro.growth.coverage },
  ];

  for (const check of macroChecks) {
    if (check.coverage === 0) {
      candidates.push({
        severity: "warning",
        label: check.label,
        detail: t.macroNoData,
      });
    }
  }

  // Workflow G: a HIGH-importance event close by isn't a data/job
  // problem like the rest of this list, but it's exactly the kind of
  // thing that should interrupt a glance at the dashboard, so it rides
  // along here rather than only living in Hero's smaller caveat banner.
  const eventRisk = await getEventRisk();
  if (eventRisk.level !== "NONE" && eventRisk.event && eventRisk.hoursUntil !== null) {
    const hoursLabel =
      eventRisk.hoursUntil < 1
        ? `${Math.round(eventRisk.hoursUntil * 60)} ${t.min}`
        : `${eventRisk.hoursUntil.toFixed(1)} ${locale === "th" ? "ชม." : "h"}`;
    candidates.push({
      severity: eventRisk.level === "HIGH" ? "critical" : "warning",
      label: t.eventLabel(eventRisk.event.eventName),
      detail: t.eventDetail(eventRisk.event.currency, hoursLabel, tLabel(eventRisk.level, locale)),
    });
  }

  // News Signals: an unscheduled AUD/USD/THB headline the model rated
  // HIGH-magnitude and reasonably confident in is exactly the kind of
  // thing Event Risk above can't see, since it never appears on any
  // calendar. The news-sentiment cron runs twice/day (09:00 and 18:00
  // Bangkok, 15h apart at the widest gap), so "recent" here is 13h --
  // just under that gap, not a couple hours -- otherwise a signal from
  // one run would stop counting as an alert well before the next run
  // replaces it.
  const news = await getRecentNewsSignals(5);
  const recentHighImpact = news.signals.find((signal) => {
    const ageHours = (Date.now() - new Date(signal.publishedAt).getTime()) / (60 * 60 * 1000);
    return signal.aiMagnitude === "HIGH" && signal.aiConfidence >= 0.6 && ageHours <= 13;
  });

  if (recentHighImpact) {
    candidates.push({
      severity: "warning",
      label: t.newsLabel(recentHighImpact.title),
      detail: `${recentHighImpact.aiDirection.replace("_", " ")} -- ${recentHighImpact.aiRationale}`,
    });
  }

  return candidates.filter((alert): alert is Alert => alert !== null);
}
