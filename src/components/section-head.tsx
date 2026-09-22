/** A hairline rule tops a section, with the name on it and a figure opposite. */
export function SectionHead({
  children,
  aside,
  bleed = false,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  /**
   * Page-top heads under the compact header: the rule runs edge to edge
   * of the viewport, as the header's own bar does, and disappears on
   * desktop where the header has no bar to continue.
   */
  bleed?: boolean;
}) {
  return (
    <div
      className={`${bleed ? "relative" : "rule-top"} flex items-baseline justify-between pt-2 pb-3`}
    >
      {bleed ? (
        <span
          aria-hidden
          className="border-rule absolute top-0 left-1/2 w-screen -translate-x-1/2 border-t lg:hidden"
        />
      ) : null}
      <h2 className="label">{children}</h2>
      {aside ? <span className="data text-fg2">{aside}</span> : null}
    </div>
  );
}
