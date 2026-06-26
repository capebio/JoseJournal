import type { Principal } from '../../core/api/types';

/**
 * IdentityHeader — the signed-in principal (FE8, Frontend Spec §5.8). Renders
 * accountId, assurance, roles, ORCID. An *account* (a logged-in actor) is distinct
 * from an *identity record* (a curated, non-login entity); this header is the account.
 */
export function IdentityHeader({ principal }: { principal: Principal | null }) {
  if (!principal) {
    return (
      <div className="jose-card jp-identity">
        <h3>Your account</h3>
        <p className="jp-prompt">
          Not signed in. Use the dev sign-in in the left nav (or app bar) to assume a
          seeded actor — author, editor, reviewer, or guest reader — then return here.
        </p>
      </div>
    );
  }

  const initials = (principal.accountId.replace(/^acct:/, '') || '?')
    .split(/[.\-_\s]/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="jose-card jp-identity">
      <h3>Your account</h3>
      <div className="jp-id-row">
        <div className={`jp-avatar a-${principal.assurance}`} aria-hidden>{initials}</div>
        <div className="jp-id-body">
          <div className="jp-id-name jose-mono">{principal.accountId}</div>
          <div className="jp-id-sub">
            account <span className="jose-mono">{principal.sub}</span> · a person who signs in
          </div>
          <div className="jp-id-meta">
            <span className={`jose-badge ${principal.assurance === 'certified' || principal.assurance === 'verified' ? 'journal' : ''}`}>
              {principal.assurance}
            </span>
            {principal.orcid ? (
              <span className="jp-orcid jose-mono" title="ORCID identifier">ORCID {principal.orcid}</span>
            ) : (
              <span className="jp-orcid-missing">no ORCID linked</span>
            )}
          </div>
          <div className="jp-roles">
            {principal.roles.length === 0 ? (
              <span className="jp-role muted">reader · no granted roles</span>
            ) : (
              principal.roles.map((r) => <span key={r} className="jp-role">{r}</span>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
