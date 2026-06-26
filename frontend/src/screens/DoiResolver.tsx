import { Navigate, useParams } from 'react-router-dom';
import { useSeed } from '../core/seed';

/**
 * /doi/:doi → the VoR version URL (Frontend Spec §2 routing). v1 resolves the
 * seeded DOI locally (no reverse-lookup endpoint yet); any other DOI shows a
 * clear not-found rather than a redirect.
 */
export function DoiResolver() {
  const { doi } = useParams();
  const seed = useSeed();
  if (seed === undefined) return <div className="jose-loading">Resolving DOI…</div>;
  if (seed && doi && decodeURIComponent(doi) === seed.doi && seed.vorVersionId) {
    return <Navigate to={`/ko/${encodeURIComponent(seed.koId)}/v/${encodeURIComponent(seed.vorVersionId)}`} replace />;
  }
  return <div className="jose-stub"><h2>DOI not found</h2><p className="jose-mono">{doi}</p></div>;
}
