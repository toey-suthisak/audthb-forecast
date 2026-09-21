// Native-title tooltip -- no client JS needed, works inside async
// Server Components. Small "i" glyph next to a section heading;
// hovering (or focusing, for keyboard/touch) shows the browser's own
// tooltip with a plain-language explanation of what that section is.
export default function InfoTooltip({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      title={text}
      aria-label={text}
      className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-v2-muted/50 text-[9px] font-semibold leading-none text-v2-muted align-middle"
    >
      i
    </span>
  );
}
