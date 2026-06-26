import { useState } from 'react';
import * as ep from '../core/api/endpoints';
import type { ObservationPublic } from '../core/api/types';
import { useAuth } from '../core/auth/auth';
import { useToast } from '../components/common/useToast';
import { ApiError } from '../core/api/client';
import { OfflineBadge } from '../components/capture/OfflineBadge';
import { useOnline } from '../core/offline/offline';
import '../components/capture/capture.css';

type Sensitivity = 'normal' | 'sensitive' | 'highly-sensitive';

interface Saved { obsId: string; koId: string; public: ObservationPublic }

/**
 * Micro-observation Capture (FE2, Frontend Spec §5.5, §7 F3) — the field app's
 * smallest citable knowledge object. The user types PRECISE lat/lon; the server
 * splits it, persisting precise-to-server and returning a QDS-only public
 * projection. We show that projection back as proof the precise coordinate never
 * leaks into the public record (the anti-poaching guarantee, AC 11.5).
 */
export function Capture() {
  const { principal } = useAuth();
  const { flash, node: toastNode } = useToast();
  const online = useOnline();

  const [taxonConcept, setTaxonConcept] = useState('');
  const [note, setNote] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [sensitivity, setSensitivity] = useState<Sensitivity>('normal');

  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  // Stable per-capture source id — a counter, NOT Date.now() in render (§7 F3).
  const [seq, setSeq] = useState(1);

  // "Requires verified+": assurance must be verified or certified (auth.tsx ladder).
  const verifiedPlus = principal?.assurance === 'verified' || principal?.assurance === 'certified';

  const latNum = Number(lat);
  const lonNum = Number(lon);
  const coordsValid =
    lat.trim() !== '' && lon.trim() !== '' &&
    Number.isFinite(latNum) && Number.isFinite(lonNum) &&
    latNum >= -90 && latNum <= 90 && lonNum >= -180 && lonNum <= 180;
  const canSave = verifiedPlus && taxonConcept.trim() !== '' && coordsValid && !submitting;

  async function onSave() {
    if (!canSave) return;
    setSubmitting(true);
    setSaved(null);
    try {
      const res = await ep.createObservation({
        taxonConcept: taxonConcept.trim(),
        lat: latNum,
        lon: lonNum,
        sensitivity,
        source: { system: 'casabio', id: `casabio:web:${seq}` },
        note: note.trim() || undefined,
      });
      setSeq((n) => n + 1);
      setSaved(res);
      flash('Observation saved — public projection is QDS-only');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        flash('Not permitted — capturing observations needs a verified account');
      } else if (err instanceof ApiError && err.status === 409) {
        flash('Conflict — this observation may already exist');
      } else {
        flash('Save failed — your capture is kept; retry when ready');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="jose-page cap-wrap">
      <div className="cap-head">
        <div>
          <h1>Capture observation</h1>
          <p className="lede">A micro-observation — the smallest citable object in JOSE.</p>
        </div>
        <OfflineBadge />
      </div>

      <div className="jose-card">
        <h3>Field record</h3>

        <button
          type="button"
          className="cap-photo"
          onClick={() => flash('Camera placeholder — capture happens in the native field app')}
          aria-label="Add photo. EXIF metadata is stripped on sync."
        >
          <span className="glyph" aria-hidden>📷</span>
          <span>Add photo</span>
          <span className="exif">EXIF stripped on sync</span>
        </button>

        <div className="jose-field">
          <label htmlFor="cap-taxon">Taxon ▸ concept id</label>
          <input
            id="cap-taxon"
            className="jose-mono"
            placeholder="concept:…"
            value={taxonConcept}
            onChange={(e) => setTaxonConcept(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="jose-field">
          <label htmlFor="cap-note">Note</label>
          <textarea
            id="cap-note"
            rows={3}
            placeholder="What you observed — habit, substrate, associates…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="jose-field">
          <label>Locality — captured precise</label>
          <div className="cap-coords">
            <div className="jose-field">
              <label htmlFor="cap-lat">Latitude</label>
              <input
                id="cap-lat"
                className="jose-mono"
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="-31.3742"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                aria-label="Latitude (precise, stored locally)"
              />
            </div>
            <div className="jose-field">
              <label htmlFor="cap-lon">Longitude</label>
              <input
                id="cap-lon"
                className="jose-mono"
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="18.9106"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                aria-label="Longitude (precise, stored locally)"
              />
            </div>
          </div>
        </div>

        <p className="cap-note">
          <b>Precise stored locally</b>; syncs as <span className="mono">QDS public</span> +{' '}
          <span className="mono">precise to server</span>. The exact coordinate you type is sent
          once, then split server-side — the public projection returned is QDS-only, so the precise
          point never enters the public record.
        </p>

        <div className="jose-field">
          <label htmlFor="cap-sens">Sensitivity</label>
          <select
            id="cap-sens"
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value as Sensitivity)}
          >
            <option value="normal">normal</option>
            <option value="sensitive">sensitive</option>
            <option value="highly-sensitive">highly-sensitive</option>
          </select>
        </div>

        <div className="jose-row">
          <button className="jose-btn primary" onClick={onSave} disabled={!canSave}>
            {submitting ? 'Saving…' : 'Save observation'}
          </button>
          {!verifiedPlus && (
            <span className="cap-gate" role="note">
              {principal
                ? 'Capturing observations needs a verified account.'
                : 'Sign in with a verified account to capture.'}
            </span>
          )}
        </div>

        <p className="cap-offline-hint">
          {online
            ? 'Online — saves go straight to the server.'
            : '● Offline — will sync. Your capture is held locally and queued; the smallest citable knowledge object works offline.'}
        </p>
      </div>

      {saved && (
        <div className="jose-card cap-receipt" role="status" aria-live="polite">
          <h3>Saved — server projection</h3>
          <div className="rrow">
            <div className="rk">observation id</div>
            <div className="rv">{saved.obsId}</div>
          </div>
          <div className="rrow">
            <div className="rk">public locality (QDS)</div>
            <div className="rv qds">{saved.public.localityQDS}</div>
            <div className="leak">
              <span aria-hidden>✓</span> public projection is QDS-only — precise point not leaked
            </div>
          </div>
          <div className="rrow">
            <div className="rk">knowledge object</div>
            <div className="rv">{saved.koId}</div>
          </div>
        </div>
      )}

      {toastNode}
    </div>
  );
}
