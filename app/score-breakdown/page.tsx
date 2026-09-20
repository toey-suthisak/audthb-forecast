import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-data";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import MarketClock from "@/components/MarketClock";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScoreBreakdownPage() {
  const data = await getDashboardData();
  const locale = await getLocale();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-masthead border-b border-brass-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
              &larr; AUD/THB Forecast Dashboard
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1.5 text-white">
              {locale === "th" ? "รายละเอียดคะแนน" : "Score Breakdown"}
            </h1>
            <p className="text-stone-400 mt-1 text-xs sm:text-sm">
              {locale === "th"
                ? "แต่ละ 7 ปัจจัยที่อยู่เบื้องหลัง Core FX Score ของวันนี้คำนวณอย่างไร"
                : "How each of the 7 factors behind today's Core FX Score is calculated."}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <MarketClock variant="inverted" locale={locale} />
            <div className="flex items-center gap-2">
              <LanguageToggle locale={locale} variant="inverted" />
              <ThemeToggle variant="inverted" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface">
          <ScoreBreakdown data={data} locale={locale} />
        </div>
      </div>
    </main>
  );
}
