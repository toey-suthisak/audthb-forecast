// Small hand-rolled line icons -- same no-library convention as this
// project's charts (RangeChart, Sparkline, DonutGauge). Generic
// geometric shapes only, 20x20 viewBox, stroke-based, currentColor so
// they pick up whatever text color wraps them.

type IconProps = { className?: string };
const base = { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconExchange({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h11.5M15.5 7 12 3.5M15.5 7 12 10.5" />
      <path d="M16 13H4.5M4.5 13 8 16.5M4.5 13 8 9.5" />
    </svg>
  );
}

export function IconGauge({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 15.5a7 7 0 0 1 14 0" />
      <path d="M10 15.5 13 9" />
      <circle cx="10" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCompass({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="m12.2 7.8-1.4 3.6-3.6 1.4 1.4-3.6 3.6-1.4Z" />
    </svg>
  );
}

export function IconCandles({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.5 3v3M5.5 12v5M14.5 3v2M14.5 11v6" />
      <rect x="3.7" y="6" width="3.6" height="6" rx="0.6" />
      <rect x="12.7" y="5" width="3.6" height="6" rx="0.6" />
    </svg>
  );
}

export function IconLayers({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m10 3 7 3.6-7 3.6-7-3.6L10 3Z" />
      <path d="m3 10.4 7 3.6 7-3.6" />
      <path d="m3 13.8 7 3.6 7-3.6" />
    </svg>
  );
}

export function IconPulse({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 10.5h3.2l1.6-4 2.6 8 1.7-6.4 1.3 2.4h4.6" />
    </svg>
  );
}

export function IconTarget({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="4" />
      <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBars({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="10" width="3" height="7" rx="0.6" />
      <rect x="8.5" y="6" width="3" height="11" rx="0.6" />
      <rect x="14" y="3" width="3" height="14" rx="0.6" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4.5" width="14" height="12" rx="1.4" />
      <path d="M3 8h14M7 3v3M13 3v3" />
    </svg>
  );
}

export function IconGlobe({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2.4 2 2.4 12 0 14M10 3c-2.4 2-2.4 12 0 14" />
    </svg>
  );
}
