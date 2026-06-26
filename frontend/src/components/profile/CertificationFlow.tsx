import { useState } from 'react';
import * as ep from '../../core/api/endpoints';
import { ApiError } from '../../core/api/client';
import type { Assurance } from '../../core/api/types';

/**
 * CertificationFlow — apply for certification and (demo) vouch for an applicant
 * (FE8, Frontend Spec §5.8). Certification is *peer-vetted*: it needs 2 distinct
 * vouches. It unlocks the ABILITY to request precise localities — it never
 * auto-grants any specific site (the policy engine still rules on each request).
 */
function readId(body: unknown): string | null {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const id = o.id ?? o._id ?? o.certificationId ?? (o.certification as Record<string, unknown> | undefined)?.id;
    if (typeof id === 'string') return id;
  }
  return null;
}

function readVouchCount(body: unknown): number | null {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const v = o.vouches ?? o.vouchCount;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'number') return v;
  }
  return null;
}

export function CertificationFlow({
  assurance,
  flash,
}: {
  assurance: Assurance;
  flash: (m: string) => void;
}) {
  const [applyId, setApplyId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [vouchInput, setVouchInput] = useState('');
  const [vouching, setVouching] = useState(false);
  const [vouchResult, setVouchResult] = useState<{ count: number | null; id: string } | null>(null);

  const alreadyCertified = assurance === 'certified';

  const onApply = async () => {
    setApplying(true);
    try {
      const res = await ep.applyCertification();
      const id = readId(res);
      setApplyId(id ?? 'submitted');
      flash(id ? 'Certification application opened' : 'Certification application submitted');
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 403) flash('Not permitted to apply — verify your identity first');
        else if (e.status === 409) flash('You already have an open application');
        else flash(e.message || 'Could not apply');
      } else {
        flash('Could not apply — backend unreachable');
      }
    } finally {
      setApplying(false);
    }
  };

  const onVouch = async () => {
    const id = vouchInput.trim();
    if (!id) return;
    setVouching(true);
    try {
      const res = await ep.vouchCertification(id);
      const count = readVouchCount(res);
      setVouchResult({ count, id });
      flash(count !== null ? `Vouch recorded — ${count}/2 distinct vouches` : 'Vouch recorded');
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 403) flash('Not permitted to vouch (need standing in this domain)');
        else if (e.status === 409) flash('You have already vouched for this application');
        else if (e.status === 404) flash('No such certification application');
        else flash(e.message || 'Could not vouch');
      } else {
        flash('Could not vouch — backend unreachable');
      }
    } finally {
      setVouching(false);
    }
  };

  return (
    <div className="jose-card jp-cert">
      <h3>Certification</h3>
      <p className="jp-cert-lede">
        Certification is <b>peer-vetted</b>: an application is endorsed by <b>2 distinct vouches</b>
        {' '}from peers with standing. It unlocks the <i>ability</i> to request precise localities —
        it never auto-grants a specific site. Every precise request still passes through the policy engine.
      </p>

      <div className="jp-cert-grid">
        <div className="jp-cert-col">
          <div className="jp-cert-step">Apply</div>
          {alreadyCertified ? (
            <p className="jp-cert-note ok">You are already certified — no application needed.</p>
          ) : (
            <>
              <button className="jose-btn primary" onClick={onApply} disabled={applying}>
                {applying ? 'Applying…' : 'Apply for certification'}
              </button>
              {applyId && (
                <div className="jp-cert-applied">
                  <span className="jose-badge journal">application open</span>
                  {applyId !== 'submitted' && (
                    <>
                      <div className="jp-cert-idlabel">share this id with two peers to vouch:</div>
                      <code className="jose-mono jp-cert-id">{applyId}</code>
                    </>
                  )}
                  <div className="jp-vouch-progress" aria-label="vouches needed">
                    <span className="dot off" /><span className="dot off" />
                    <span className="jp-vouch-text">0 / 2 vouches</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="jp-cert-col">
          <div className="jp-cert-step">Vouch (demo)</div>
          <p className="jp-cert-sub">Endorse a peer's application by its certification id.</p>
          <div className="jose-field">
            <label htmlFor="jp-vouch-id">Certification id</label>
            <input
              id="jp-vouch-id"
              className="jose-mono"
              value={vouchInput}
              onChange={(e) => setVouchInput(e.target.value)}
              placeholder="cert:…"
              aria-label="Certification id to vouch for"
            />
          </div>
          <button className="jose-btn" onClick={onVouch} disabled={vouching || !vouchInput.trim()}>
            {vouching ? 'Vouching…' : 'Record vouch'}
          </button>
          {vouchResult && (
            <div className="jp-vouch-progress" aria-label="vouches recorded">
              <span className={`dot ${vouchResult.count && vouchResult.count >= 1 ? 'on' : 'off'}`} />
              <span className={`dot ${vouchResult.count && vouchResult.count >= 2 ? 'on' : 'off'}`} />
              <span className="jp-vouch-text">
                {vouchResult.count !== null ? `${Math.min(vouchResult.count, 2)} / 2 vouches` : 'vouch recorded'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
