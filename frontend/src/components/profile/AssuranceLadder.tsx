import type { Assurance } from '../../core/api/types';

/**
 * AssuranceLadder — the unverified → verified → certified progression (FE8,
 * Frontend Spec §5.8). The current rung is highlighted in --verified. Each rung
 * is a *deed-led* capability statement, not a status badge to brag about.
 */
const RUNGS: Array<{ key: Assurance; title: string; blurb: string }> = [
  {
    key: 'unverified',
    title: 'Unverified',
    blurb:
      'A fresh account. You can read, capture micro-observations, and draft — your contributions are provisional until checked.',
  },
  {
    key: 'verified',
    title: 'Verified',
    blurb:
      'Your identity is confirmed (e.g. via ORCID / institution). You author and review under your own name with standing.',
  },
  {
    key: 'certified',
    title: 'Certified',
    blurb:
      'Peer-vetted expertise in a domain. Unlocks the ability to request precise localities — the policy engine still decides each specific site.',
  },
];

const ORDER: Record<Assurance, number> = { unverified: 0, verified: 1, certified: 2 };

export function AssuranceLadder({ current }: { current: Assurance }) {
  const currentIdx = ORDER[current];
  return (
    <div className="jose-card jp-ladder">
      <h2>Assurance ladder</h2>
      <p className="jp-ladder-lede">
        Standing is earned by deeds, not declared. You climb as your work is checked and vetted.
      </p>
      <ol className="jp-rungs">
        {RUNGS.map((rung, i) => {
          const state = i < currentIdx ? 'past' : i === currentIdx ? 'current' : 'future';
          return (
            <li key={rung.key} className={`jp-rung ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="jp-rung-dot" aria-hidden>{i < currentIdx ? '✓' : i + 1}</span>
              <div className="jp-rung-body">
                <div className="jp-rung-title">
                  {rung.title}
                  {state === 'current' && <span className="jp-rung-you">you are here</span>}
                </div>
                <div className="jp-rung-blurb">{rung.blurb}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
