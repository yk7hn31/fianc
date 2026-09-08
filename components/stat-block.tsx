/**
 * One digit per span, so a changed figure re-enters character by character
 * with the last two staggered behind the rest (transitions.dev "number
 * pop-in").
 *
 * Split text can be read out character by character — inline-block spans are
 * where screen readers start inserting pauses — so the group is labelled as a
 * single image. `role="img"` with an `aria-label` is what stops assistive tech
 * descending into the digits at all: it announces the figure as one string.
 *
 * Not a visually-hidden second copy of the value, which is the other usual
 * spelling of this: that leaves the figure in the paragraph's text content
 * twice, so selecting it copies "$25.00$25.00" and any assertion reading the
 * element's text sees the doubled string. The label lives outside the text
 * content, so what is rendered, copied and read stay the same one value.
 */
function StatValue({ value }: { value: string }) {
  const chars = [...value];

  return (
    <span role="img" aria-label={value} className="t-digit-group is-animating">
      {chars.map((ch, i) => (
        <span
          key={i}
          className="t-digit"
          data-stagger={
            i === chars.length - 2
              ? "1"
              : i === chars.length - 1
                ? "2"
                : undefined
          }
        >
          {/* A flex item holding a single collapsible space measures zero
              wide, which would close up the gap Intl puts between symbol and
              amount in most non-en locales. */}
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

export function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-caption uppercase text-muted-foreground">{label}</p>
      <p className="text-heading-lg font-semibold tabular-nums">
        {/*
          `key={value}` remounts the spans when the figure changes. Nothing
          here is stateful, so React would otherwise reuse them across a month
          switch and the CSS animation — which only runs on mount — would
          never replay.
        */}
        <StatValue key={value} value={value} />
      </p>
      {hint && <p className="text-muted-foreground">{hint}</p>}
    </div>
  );
}
