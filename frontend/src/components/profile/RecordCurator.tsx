import { useState } from 'react';
import * as ep from '../../core/api/endpoints';
import { ApiError } from '../../core/api/client';

/**
 * RecordCurator — curate an *identity record* (FE8, Frontend Spec §5.8). A record
 * stands in for a person who cannot hold an account — e.g. a deceased author such
 * as 'L.' (Linnaeus). Nobody logs into a record; it is a curated entity linked to
 * external authority files (IPNI, Wikidata) so authorship strings resolve cleanly.
 */
function readRecordId(body: unknown): string | null {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const id = o.id ?? o._id ?? (o.record as Record<string, unknown> | undefined)?.id;
    if (typeof id === 'string') return id;
  }
  return null;
}

export function RecordCurator({ flash }: { flash: (m: string) => void }) {
  const [displayName, setDisplayName] = useState('');
  const [ipni, setIpni] = useState('');
  const [wikidata, setWikidata] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string | null; displayName: string } | null>(null);

  const onCreate = async () => {
    const name = displayName.trim();
    if (!name) return;
    const externalIds: Record<string, string> = {};
    if (ipni.trim()) externalIds.ipni = ipni.trim();
    if (wikidata.trim()) externalIds.wikidata = wikidata.trim();
    setSaving(true);
    try {
      const res = await ep.createIdentityRecord({
        displayName: name,
        ...(Object.keys(externalIds).length ? { externalIds } : {}),
      });
      setCreated({ id: readRecordId(res), displayName: name });
      flash(`Identity record curated — ${name}`);
      setDisplayName('');
      setIpni('');
      setWikidata('');
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 403) flash('Not permitted to curate records (steward/editor role required)');
        else if (e.status === 409) flash('A record for this person already exists');
        else flash(e.message || 'Could not create record');
      } else {
        flash('Could not create record — backend unreachable');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="jose-card jp-curator">
      <h2>Curate an identity record</h2>
      <p className="jp-curator-lede">
        For a person who cannot hold an account — a deceased author like <b>'L.'</b> (Linnaeus).
        A record is a curated entity, not a login. Linking authority files lets authorship strings resolve.
      </p>

      <div className="jose-field">
        <label htmlFor="jp-rec-name">Display name</label>
        <input
          id="jp-rec-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Carl Linnaeus ('L.')"
          aria-label="Identity record display name"
        />
      </div>

      <div className="jose-row jp-curator-ids">
        <div className="jose-field">
          <label htmlFor="jp-rec-ipni">IPNI author id</label>
          <input
            id="jp-rec-ipni"
            className="jose-mono"
            value={ipni}
            onChange={(e) => setIpni(e.target.value)}
            placeholder="12653-1"
            aria-label="IPNI author identifier"
          />
        </div>
        <div className="jose-field">
          <label htmlFor="jp-rec-wd">Wikidata id</label>
          <input
            id="jp-rec-wd"
            className="jose-mono"
            value={wikidata}
            onChange={(e) => setWikidata(e.target.value)}
            placeholder="Q1043"
            aria-label="Wikidata identifier"
          />
        </div>
      </div>

      <button className="jose-btn primary" onClick={onCreate} disabled={saving || !displayName.trim()}>
        {saving ? 'Curating…' : 'Curate record'}
      </button>

      {created && (
        <div className="jp-record-out">
          <span className="jose-badge">identity record</span>
          <b>{created.displayName}</b>
          {created.id && <code className="jose-mono jp-record-id">{created.id}</code>}
          <span className="jp-record-note">no login — a curated, citable person entity</span>
        </div>
      )}
    </div>
  );
}
