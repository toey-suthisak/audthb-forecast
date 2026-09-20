import { getScoreHistory } from "@/lib/history-data";
import StatusLight from "@/components/StatusLight";
import type { Locale } from "@/lib/i18n";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 72;

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
  });
}

function buildPath(values: number[], min: number, max: number) {
  const span = max - min || 1;
  const stepX = values.length > 1 ? CHART_WIDTH / (values.length - 1) : 0;

  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = CHART_HEIGHT - ((v - min) / span) * CHART_HEIGHT;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const STR = {
  en: {
    title: "7-Day Trend",
    notEnough: "Not enough history yet.",
    coreFxScore: "Core FX Score",
    rate: "AUD/THB Rate",
    scoreAria: (from: number, to: number) => `Core FX Score trend over the last 7 days, from ${from} to ${to}`,
    scoreAriaShort: "Core FX Score trend over the last 7 days",
    rateAria: (from: string, to: string) => `AUD/THB Rate trend over the last 7 days, from ${from} to ${to}`,
    rateAriaShort: "AUD/THB Rate trend over the last 7 days",
  },
  th: {
    title: "แนวโน้ม 7 วัน",
    notEnough: "ยังมีข้อมูลย้อนหลังไม่พอ",
    coreFxScore: "Core FX Score",
    rate: "อัตรา AUD/THB",
    scoreAria: (from: number, to: number) => `แนวโน้ม Core FX Score ช่วง 7 วันที่ผ่านมา จาก ${from} ถึง ${to}`,
    scoreAriaShort: "แนวโน้ม Core FX Score ช่วง 7 วันที่ผ่านมา",
    rateAria: (from: string, to: string) => `แนวโน้มอัตรา AUD/THB ช่วง 7 วันที่ผ่านมา จาก ${from} ถึง ${to}`,
    rateAriaShort: "แนวโน้มอัตรา AUD/THB ช่วง 7 วันที่ผ่านมา",
  },
} as const;

// A plain SVG sparkline -- one series per chart (score and rate live on
// different scales, so this is two single-axis charts, never one chart
// with two y-axes). The zero line only makes sense for the score, which
// can be negative; the rate chart never gets one.
function Sparkline({
  values,
  colorClassName,
  zeroLine = false,
  ariaLabel,
  notEnoughLabel,
}: {
  values: number[];
  colorClassName: string;
  zeroLine?: boolean;
  ariaLabel: string;
  notEnoughLabel: string;
}) {
  if (values.length < 2) {
    return (
      <div className="h-[72px] flex items-center">
        <p className="text-xs text-stone-600 dark:text-stone-400">{notEnoughLabel}</p>
      </div>
    );
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = zeroLine ? Math.min(rawMin, 0) : rawMin;
  const max = zeroLine ? Math.max(rawMax, 0) : rawMax;
  const span = max - min || 1;

  const path = buildPath(values, min, max);
  const lastY = CHART_HEIGHT - ((values.at(-1)! - min) / span) * CHART_HEIGHT;
  const zeroY = zeroLine ? CHART_HEIGHT - ((0 - min) / span) * CHART_HEIGHT : null;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="w-full h-[72px]"
      role="img"
      aria-label={ariaLabel}
    >
      {zeroY !== null && (
        <line
          x1={0}
          x2={CHART_WIDTH}
          y1={zeroY}
          y2={zeroY}
          strokeWidth={1}
          strokeDasharray="4 3"
          className="stroke-stone-300 dark:stroke-stone-700"
        />
      )}

      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={colorClassName}
      />
      <circle cx={CHART_WIDTH} cy={lastY} r={3.5} fill="currentColor" className={colorClassName} />
    </svg>
  );
}

// Workflow I: the page's only history view -- everything else on the
// dashboard is a point-in-time number, so there was previously no way
// to see whether the score or rate is trending, only where it stands
// right now.
export default async function TrendChart({ locale }: { locale: Locale }) {
  const history = await getScoreHistory();
  const t = STR[locale];

  const scored = history.points.filter(
    (p): p is { issuedAt: string; coreFxScore: number; rate: number | null } => p.coreFxScore !== null,
  );
  const rated = history.points.filter(
    (p): p is { issuedAt: string; coreFxScore: number | null; rate: number } => p.rate !== null,
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight inline-flex items-center">
          <StatusLight colorClassName="text-brass-500 dark:text-brass-400" />
          {t.title}
        </h2>
        {scored.length >= 2 && (
          <p className="text-xs text-stone-600 dark:text-stone-400">
            {formatDay(scored[0].issuedAt)} -- {formatDay(scored.at(-1)!.issuedAt)}
          </p>
        )}
      </div>

      {history.error ? (
        <p className="text-sm text-red-700 dark:text-red-400 mt-2">{history.error}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6 mt-4">
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-stone-600 dark:text-stone-400 uppercase tracking-wide">{t.coreFxScore}</p>
              {scored.length > 0 && (
                <p className="text-sm font-mono font-semibold">
                  {scored.at(-1)!.coreFxScore > 0 ? "+" : ""}
                  {scored.at(-1)!.coreFxScore}
                </p>
              )}
            </div>
            <Sparkline
              values={scored.map((p) => p.coreFxScore)}
              colorClassName="text-brass-600 dark:text-brass-400"
              zeroLine
              notEnoughLabel={t.notEnough}
              ariaLabel={
                scored.length >= 2
                  ? t.scoreAria(scored[0].coreFxScore, scored.at(-1)!.coreFxScore)
                  : t.scoreAriaShort
              }
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-stone-600 dark:text-stone-400 uppercase tracking-wide">{t.rate}</p>
              {rated.length > 0 && (
                <p className="text-sm font-mono font-semibold">{rated.at(-1)!.rate.toFixed(4)}</p>
              )}
            </div>
            <Sparkline
              values={rated.map((p) => p.rate)}
              colorClassName="text-stone-500 dark:text-stone-400"
              notEnoughLabel={t.notEnough}
              ariaLabel={
                rated.length >= 2
                  ? t.rateAria(rated[0].rate.toFixed(4), rated.at(-1)!.rate.toFixed(4))
                  : t.rateAriaShort
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
