import Sparkline from "@/components/v2/Sparkline";

export type WatchlistItem = {
  label: string;
  value: string | null;
  changePct: number | null;
  series: number[];
  href?: string;
};

function changeColor(pct: number | null) {
  if (pct === null) return "text-v2-muted";
  if (pct > 0) return "text-emerald-600 dark:text-emerald-400";
  if (pct < 0) return "text-red-600 dark:text-red-400";
  return "text-v2-muted";
}

// One row of the mockup's "Related Markets" watchlist -- label, latest
// value, a real % change, and a tiny sparkline built from whatever real
// history exists for that symbol (see get_daily_price_bars for FX pairs
// already stored in market_prices).
export default function WatchlistRow({ item }: { item: WatchlistItem }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-v2-border last:border-b-0">
      <span className="text-sm font-medium text-v2-foreground">{item.label}</span>
      <div className="flex items-center gap-3">
        <Sparkline points={item.series} positive={item.changePct === null ? null : item.changePct >= 0} />
        <div className="text-right min-w-[70px]">
          <p className="font-mono text-sm text-v2-foreground">{item.value ?? "--"}</p>
          <p className={`text-xs font-mono ${changeColor(item.changePct)}`}>
            {item.changePct !== null ? `${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(2)}%` : "--"}
          </p>
        </div>
      </div>
    </div>
  );
}
