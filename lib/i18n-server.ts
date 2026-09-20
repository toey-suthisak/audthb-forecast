import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

// Cookie-backed, not client-state -- keeps every text-bearing component
// on this page a plain Server Component (this codebase's own preference,
// see MarketConsensus/TodayEvents split) instead of converting the whole
// tree to client components just to swap text. LanguageToggle sets this
// cookie and calls router.refresh(); every server component below reads
// it fresh on that refresh, same pattern RefreshControls already uses
// for the 60s auto-refresh.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "th";
}
