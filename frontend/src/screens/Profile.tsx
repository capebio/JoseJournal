import { useAuth } from '../core/auth/auth';
import { useToast } from '../components/common/useToast';
import { IdentityHeader } from '../components/profile/IdentityHeader';
import { AssuranceLadder } from '../components/profile/AssuranceLadder';
import { CertificationFlow } from '../components/profile/CertificationFlow';
import { RecordCurator } from '../components/profile/RecordCurator';
import '../components/profile/profile.css';

/**
 * Profile / Identity / Certification (FE8, Frontend Spec §5.8).
 *
 * The signed-in *account* (useAuth principal), the unverified→verified→certified
 * assurance ladder, the peer-vetted certification flow (apply + 2 distinct vouches),
 * and identity-record curation (a non-login entity for a deceased author).
 *
 * Trust is shown PRIVATELY and framed by deeds — there is no public leaderboard in v1.
 */
export function Profile() {
  const { principal } = useAuth();
  const { flash, node: toastNode } = useToast();

  return (
    <div className="jose-page jp-grid">
      <h1>Profile</h1>
      <p className="lede">
        Your account, standing, and the records you curate. Standing is earned by deeds; it is shown
        to you privately — JOSE has no public leaderboard.
      </p>

      <IdentityHeader principal={principal} />

      {principal ? (
        <>
          <AssuranceLadder current={principal.assurance} />
          <CertificationFlow assurance={principal.assurance} flash={flash} />
          <RecordCurator flash={flash} />

          <div className="jose-card jp-trust">
            <span className="jp-trust-icon" aria-hidden>◆</span>
            <div className="jp-trust-body">
              <b>Trust signal<span className="jp-private-tag">private</span></b>
              <br />
              Visible only to you. JOSE reads standing from <b>what you have done</b> — observations
              verified, treatments authored, reviews dispositioned, records curated — not from a score
              you can game or a ranking against peers. Climbing the assurance ladder follows from the work.
            </div>
          </div>
        </>
      ) : (
        <div className="jose-card">
          <p className="jose-mono" style={{ color: 'var(--structure)' }}>
            Sign in to view the assurance ladder, apply for certification, and curate identity records.
          </p>
        </div>
      )}

      {toastNode}
    </div>
  );
}
