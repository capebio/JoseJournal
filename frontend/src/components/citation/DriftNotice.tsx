/**
 * Drift banner for a snippet whose anchored block was amended in a later version
 * (Frontend Spec §5.6, AC 11.4). When drift is present the viewer must show BOTH
 * the cited text and the current text — this component is only the warning strip;
 * the side-by-side comparison lives in the SnippetCard.
 *
 * Drift uses the amber notice tone (not --type-red, which is reserved for the
 * provenance/evidence anchor itself).
 */
export function DriftNotice({ note }: { note?: string }) {
  return (
    <div className="jose-drift" role="status">
      <span aria-hidden>⚠ </span>
      <b>amended in a later version</b>
      {' — the cited text and the current text differ.'}
      {note ? <span className="jose-drift-note"> {note}</span> : null}
    </div>
  );
}
