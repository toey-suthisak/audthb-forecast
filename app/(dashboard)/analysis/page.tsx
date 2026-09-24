import AnalysisTabs from "@/components/v2/AnalysisTabs";
import { getLocale } from "@/lib/i18n-server";
import { getDashboardData } from "@/lib/dashboard-data";
import { getTechnicalOutlook } from "@/lib/technical-outlook-data";
import { getScoreExplained } from "@/lib/score-explained-data";
import { getCorrelations } from "@/lib/correlation-data";
import { getLongTermTechnicals } from "@/lib/long-term-technicals-data";
import { computeContributions, rawFactorsFromDashboard } from "@/lib/score-factors";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    title: "Analysis",
    subtitle: "Price, technical levels, drivers, and correlation -- all from this app's own real data.",
  },
  th: {
    title: "วิเคราะห์",
    subtitle: "ราคา แนวรับ-แนวต้าน ปัจจัยขับเคลื่อน และความสัมพันธ์เชิงสถิติ -- ทั้งหมดจากข้อมูลจริงของแอปนี้",
  },
} as const;

export default async function AnalysisPage() {
  const locale = await getLocale();
  const t = STR[locale];

  const data = await getDashboardData();
  const [technicalOutlook, scoreExplained, correlations, longTermTechnicals] = await Promise.all([
    getTechnicalOutlook(locale, data),
    getScoreExplained(data),
    getCorrelations(),
    getLongTermTechnicals(locale),
  ]);

  const { factors: scoreFactors } = computeContributions(rawFactorsFromDashboard(data));

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
        scoreFactors={scoreFactors}
        correlations={correlations}
        longTermTechnicals={longTermTechnicals}
      />
    </div>
  );
}
