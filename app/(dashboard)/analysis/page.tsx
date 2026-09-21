import AnalysisTabs from "@/components/v2/AnalysisTabs";
import { getLocale } from "@/lib/i18n-server";
import { getDashboardData } from "@/lib/dashboard-data";
import { getTechnicalOutlook } from "@/lib/technical-outlook-data";
import { getScoreExplained } from "@/lib/score-explained-data";
import { getEconomicConsensus, getRecentEconomicOutcomes } from "@/lib/economic-consensus-data";
import { getCorrelations } from "@/lib/correlation-data";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    title: "Analysis",
    subtitle: "Price, drivers, technical levels, event impact, and correlation -- all from this app's own real data.",
  },
  th: {
    title: "วิเคราะห์",
    subtitle: "ราคา ปัจจัยขับเคลื่อน แนวรับ-แนวต้าน ผลกระทบข่าว และความสัมพันธ์เชิงสถิติ -- ทั้งหมดจากข้อมูลจริงของแอปนี้",
  },
} as const;

export default async function AnalysisPage() {
  const locale = await getLocale();
  const t = STR[locale];

  const data = await getDashboardData();
  const [technicalOutlook, scoreExplained, consensus, outcomes, correlations] = await Promise.all([
    getTechnicalOutlook(locale, data),
    getScoreExplained(data),
    getEconomicConsensus(),
    getRecentEconomicOutcomes(),
    getCorrelations(),
  ]);

  const upcoming = consensus.events.filter((e) => e.impact === "HIGH" && e.forecastValue !== null && e.actualValue === null);
  const released = outcomes.events.filter((e) => e.impact === "HIGH");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-v2-foreground">{t.title}</h1>
        <p className="text-sm text-v2-muted mt-1">{t.subtitle}</p>
      </div>

      <AnalysisTabs
        locale={locale}
        technicalOutlook={technicalOutlook}
        scoreExplained={scoreExplained}
        releasedEvents={released}
        upcomingEvents={upcoming}
        correlations={correlations}
      />
    </div>
  );
}
