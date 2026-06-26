import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../core/query/queryClient';
import * as ep from '../core/api/endpoints';
import { SnippetCard } from '../components/citation/SnippetCard';
import '../components/citation/citation.css';

/**
 * Snippet Reference Viewer (FE3, drift-aware) — Frontend Spec §5.6, AC 11.4.
 *
 * Resolves a hardened snippet anchor and shows the cited block. Two views:
 *   ◉ View snippet           — just the anchored block
 *   ○ View entire treatment  — a link to the living treatment at this version
 *
 * Drift is the headline behaviour: when the anchored block was amended in a later
 * version (drift === true) we render BOTH the cited text and the current text
 * side by side, so a citation never silently rots. When drift === false we assert
 * "hash ok". The anchor (versionId / sectionPath / blockId / contentHash) is the
 * load-bearing identity — visual line numbers are never the anchor.
 */
export function SnippetViewer() {
  const { snippetId = '' } = useParams();
  const [view, setView] = useState<'snippet' | 'treatment'>('snippet');

  const snipQ = useQuery({
    queryKey: qk.snippet(snippetId),
    queryFn: () => ep.resolveSnippet(snippetId),
    enabled: !!snippetId,
  });

  if (snipQ.isLoading) return <div className="jose-loading">Resolving snippet…</div>;
  if (snipQ.isError || !snipQ.data) {
    const status = (snipQ.error as { status?: number })?.status;
    return (
      <div className="jose-stub">
        <h2>{status === 403 ? 'Not permitted' : status === 404 ? 'Snippet not found' : 'Snippet unavailable'}</h2>
        <p className="jose-mono">{snippetId || '—'}</p>
      </div>
    );
  }

  const res = snipQ.data;

  return (
    <div className="jose-page">
      <h1>Cited passage</h1>
      <p className="lede">
        A hardened reference into a living treatment. {res.drift
          ? 'This anchor has drifted — the treatment was amended after it was cited.'
          : 'The cited block is verified against its content hash.'}
      </p>
      <SnippetCard resolution={res} view={view} onView={setView} />
    </div>
  );
}
