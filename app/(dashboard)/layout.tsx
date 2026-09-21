import RefreshControls from "@/components/RefreshControls";
import Header from "@/components/v2/Header";
import { getLocale } from "@/lib/i18n-server";

// Shared shell for the new 6-tab dashboard (Dashboard/Analysis/Events/
// Data/Performance/About). Route group -- adds no URL segment, so
// app/(dashboard)/analysis/page.tsx serves /analysis etc. The original
// homepage moved intact to /classic (see app/classic/page.tsx) rather
// than being deleted.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-v2-bg text-v2-foreground">
      <RefreshControls />
      <Header locale={locale} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</div>
    </div>
  );
}
