"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n";

// Same shape and placement as ThemeToggle, right next to it -- a cookie
// (not localStorage/client state) so every Server Component on the page
// can read the chosen language on the next render, the same way
// RefreshControls' router.refresh() already re-runs this page's server
// components every 60s.
export default function LanguageToggle({
  locale,
  variant = "default",
}: {
  locale: Locale;
  variant?: "default" | "inverted";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const toggle = () => {
    const next: Locale = locale === "th" ? "en" : "th";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setPending(true);
    router.refresh();
  };

  const style =
    variant === "inverted"
      ? "border-white/30 text-white hover:border-white hover:text-white focus-visible:ring-offset-stone-900"
      : "border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-brass-400 dark:hover:border-brass-500 hover:text-brass-700 dark:hover:text-brass-400 focus-visible:ring-offset-stone-100 dark:focus-visible:ring-offset-stone-950";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded border px-2 text-[11px] font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-1 transition-[color,border-color] duration-150 ease-out active:scale-90 active:duration-75 disabled:opacity-60 ${style}`}
    >
      {locale === "th" ? "EN" : "ไทย"}
    </button>
  );
}
