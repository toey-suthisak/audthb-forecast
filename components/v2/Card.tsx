import type { ReactNode } from "react";

// Shared card shell for the new v2 dashboard (light theme, blue/purple
// accents) -- white/surface panel with a hairline border and a soft
// shadow, replacing the almanac's borderless ruled-sheet rows. Kept
// deliberately plain (no gradient, no colored border) so the accent
// colors used inside each card (badges, KPI figures, chart lines) stay
// the thing that reads as "designed", not the card chrome itself.
export default function Card({
  title,
  icon,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-v2-border bg-v2-surface shadow-sm shadow-slate-900/5 dark:shadow-black/20 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-v2-border">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-v2-foreground">
            {icon && <span className="text-blue-600 dark:text-blue-400">{icon}</span>}
            {title}
          </h3>
          {action}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </div>
  );
}
