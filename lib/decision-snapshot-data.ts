import "server-only";
import type { DashboardData } from "@/lib/dashboard-data";
import type { Locale } from "@/lib/i18n";
import { getEventRisk, type EventRiskLevel } from "@/lib/event-calendar-data";
import { getConfidence, type ConfidenceLevel } from "@/lib/confidence-data";
import { getEvaluationSummary } from "@/lib/evaluation-data";
import { FORECAST_VERSION } from "@/lib/forecast-data";

// =========================================================
// The single "what should I see first" strip an analyst deciding
// prefund/postfund needs -- everything here already exists elsewhere on
// the page (Hero's bias, Confidence, Event Risk, Track Record); this
// just pulls the four most decision-relevant numbers into one place so
// reading it doesn't require scrolling the whole page and synthesizing
// manually. No new judgment call, no new number.
// =========================================================

export type DecisionSnapshot = {
  available: boolean;
  direction: "POSTFUND" | "PREFUND" | "NEUTRAL";
  score: number | null;
  confidenceLevel: ConfidenceLevel;
  eventWarning: {
    name: string;
    currency: string;
    hoursUntil: number;
    level: EventRiskLevel;
  } | null;
  trackRecord: {
    accuracyPct: number | null;
    sampleSize: number;
    minSampleSize: number;
    insufficientData: boolean;
  } | null;
};

export async function getDecisionSnapshot(
  dashboard: DashboardData,
  locale: Locale,
): Promise<DecisionSnapshot> {
  const [eventRisk, confidence, evaluation] = await Promise.all([
    getEventRisk(),
    getConfidence(dashboard, locale),
    getEvaluationSummary(),
  ]);

  // Same >=15 / <=-15 thresholds used everywhere else for coreBias /
  // Action Bias -- not a new judgment call.
  let direction: DecisionSnapshot["direction"] = "NEUTRAL";
  if (dashboard.coreFxScore !== null) {
    if (dashboard.coreFxScore >= 15) direction = "POSTFUND";
    else if (dashboard.coreFxScore <= -15) direction = "PREFUND";
  }

  const dailyGroup = evaluation.groups.find(
    (g) => g.horizon === "DAILY" && g.forecastVersion === FORECAST_VERSION,
  );

  return {
    available: dashboard.coreFxScore !== null,
    direction,
    score: dashboard.coreFxScore,
    confidenceLevel: confidence.level,
    eventWarning:
      eventRisk.level !== "NONE" && eventRisk.event && eventRisk.hoursUntil !== null
        ? {
            name: eventRisk.event.eventName,
            currency: eventRisk.event.currency,
            hoursUntil: eventRisk.hoursUntil,
            level: eventRisk.level,
          }
        : null,
    trackRecord: dailyGroup
      ? {
          accuracyPct:
            dailyGroup.model.directionalAccuracy !== null
              ? Number((dailyGroup.model.directionalAccuracy * 100).toFixed(1))
              : null,
          sampleSize: dailyGroup.sampleSize,
          minSampleSize: dailyGroup.minSampleSize,
          insufficientData: dailyGroup.insufficientData,
        }
      : null,
  };
}
