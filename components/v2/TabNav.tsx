"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

const TABS = [
  { href: "/", key: "dashboard" as const },
  { href: "/analysis", key: "analysis" as const },
  { href: "/events", key: "events" as const },
  { href: "/data", key: "data" as const },
  { href: "/performance", key: "performance" as const },
  { href: "/about", key: "about" as const },
];

const STR = {
  en: {
    dashboard: "Dashboard",
    analysis: "Analysis",
    events: "Events",
    data: "Data",
    performance: "Performance",
    about: "About",
  },
  th: {
    dashboard: "แดชบอร์ด",
    analysis: "วิเคราะห์",
    events: "ปฏิทินข่าว",
    data: "ข้อมูล",
    performance: "ผลงาน",
    about: "เกี่ยวกับ",
  },
} as const;

// Real tab navigation (separate routes, app/(dashboard)/*) -- a
// deliberate reversal of an earlier decision recorded in
// app/classic/page.tsx's own comment ("a sidebar/tabs structure was
// tried and explicitly rejected earlier"), per the user's explicit
// confirmation when this redesign was scoped.
export default function TabNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = STR[locale];

  return (
    <nav className="flex items-center gap-1 overflow-x-auto px-4 sm:px-6">
      {TABS.map((tab, i) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
              active
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-v2-muted hover:text-v2-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-v2-muted dark:bg-slate-800"
              }`}
            >
              {i + 1}
            </span>
            {t[tab.key]}
          </Link>
        );
      })}
    </nav>
  );
}
