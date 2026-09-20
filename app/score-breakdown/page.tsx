import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-data";
import ScoreBreakdown from "@/components/ScoreBreakdown";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScoreBreakdownPage() {
  const data = await getDashboardData();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="bg-masthead border-b border-brass-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brass-400 hover:text-brass-300">
            &larr; AUD/THB Forecast Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">Score Breakdown</h1>
          <p className="text-stone-400 mt-1 text-sm sm:text-base">
            How each of the 7 factors behind today&apos;s Core FX Score is calculated.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-surface">
          <ScoreBreakdown data={data} />
        </div>
      </div>
    </main>
  );
}
