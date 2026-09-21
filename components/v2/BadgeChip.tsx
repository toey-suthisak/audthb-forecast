export type ChipTone = "blue" | "emerald" | "red" | "amber" | "slate" | "indigo";

const TONE_CLASSES: Record<ChipTone, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
};

// Soft-filled pill -- the v2 dashboard's equivalent of the almanac's
// outlined StatusBadge, matching the mockup's "+ LIVE" / impact / status
// chips. Kept as a separate component (not a StatusBadge reskin) since
// the visual language is genuinely different (filled vs outlined) and
// StatusBadge is still used unmodified by every /classic component.
export default function BadgeChip({
  label,
  tone,
  dot = false,
}: {
  label: string;
  tone: ChipTone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}
