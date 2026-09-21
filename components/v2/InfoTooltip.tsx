// Custom CSS-only tooltip (Tailwind `group` + opacity/scale transition)
// -- no client JS needed, still works inside async Server Components.
// Replaces an earlier version that relied on the native `title`
// attribute: that turned out unreliable in practice (browser-dependent
// hover delay of ~1s, easy to trigger-and-miss, silently does nothing
// on touch), which is exactly what got reported. This version renders
// its own always-visible-on-hover panel, appears instantly, and also
// opens on keyboard focus (`group-focus-within`) for accessibility.
export default function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-label={text}
        className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-v2-muted/50 text-[9px] font-semibold leading-none text-v2-muted align-middle outline-none"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-64 max-w-[75vw] scale-95 rounded-lg border border-v2-border bg-v2-surface px-3 py-2 text-[11px] font-normal normal-case leading-snug text-v2-foreground opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
