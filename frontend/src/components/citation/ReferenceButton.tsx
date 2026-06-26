import { Link } from 'react-router-dom';

/**
 * Inline citation reference — renders an unobtrusive button styled like an
 * academic in-text citation, e.g. "(Botha 2026, §description)", linking to the
 * hardened-anchor Snippet Reference Viewer at /s/:snippetId. Reusable by any
 * screen that wants to surface a citable passage (Frontend Spec §5.6, AC 11.4).
 *
 * The --type-red marker dot is the provenance/evidence signal (§3); the citation
 * itself is set in body serif so it reads as scholarly apparatus, not chrome.
 */
export function ReferenceButton({ snippetId, label }: { snippetId: string; label: string }) {
  return (
    <Link
      to={`/s/${encodeURIComponent(snippetId)}`}
      className="jose-refbtn"
      aria-label={`Open cited snippet ${label}`}
      title="View the hardened snippet anchor"
    >
      <span className="m" aria-hidden />
      <span className="t">({label})</span>
    </Link>
  );
}
