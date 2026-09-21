import MarketClock from "@/components/MarketClock";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import TabNav from "@/components/v2/TabNav";
import type { Locale } from "@/lib/i18n";

const STR = {
  en: { title: "AUD/THB Forecast", live: "LIVE" },
  th: { title: "AUD/THB Forecast", live: "LIVE" },
} as const;

function LogoMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
        <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
      </svg>
    </span>
  );
}

// Shared shell for every app/(dashboard)/* page: a blue/indigo gradient
// header (logo, title, clock, theme/language toggles -- reusing the
// same ThemeToggle/LanguageToggle/MarketClock components /classic uses,
// just with variant="inverted") plus the tab bar underneath it.
export default function Header({ locale }: { locale: Locale }) {
  const t = STR[locale];

  const today = new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="sticky top-0 z-40">
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-base font-bold text-white tracking-tight">{t.title}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-white/70">{today}</span>
            <MarketClock variant="inverted" locale={locale} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
              {t.live}
            </span>
            <div className="flex items-center gap-2">
              <LanguageToggle locale={locale} variant="inverted" />
              <ThemeToggle variant="inverted" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-v2-surface border-b border-v2-border">
        <div className="max-w-7xl mx-auto">
          <TabNav locale={locale} />
        </div>
      </div>
    </div>
  );
}
