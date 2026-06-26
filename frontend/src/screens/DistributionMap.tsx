import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../core/query/queryClient';
import * as ep from '../core/api/endpoints';
import { useAuth } from '../core/auth/auth';
import { useSeed } from '../core/seed';
import type { ObservationPublic } from '../core/api/types';
import { useToast } from '../components/common/useToast';
import '../components/map/map.css';

/**
 * Distribution Map (Frontend Spec §5.2, §5.6; prototype 3.jsx). Obfuscation-aware:
 * the public projection carries only QDS cells (geometryGeneralised polygons) and
 * NO lat/lon — there is no client path that renders a finer-than-QDS coordinate
 * from it (AC 11.5). Precise points appear ONLY through an authenticated,
 * server-mediated, expiring grant, held in memory and never persisted offline.
 */
type Bounds = { lonLo: number; lonHi: number; latLo: number; latHi: number };

function ringBounds(ring: number[][]): Bounds {
  let lonLo = Infinity, lonHi = -Infinity, latLo = Infinity, latHi = -Infinity;
  for (const [lon, lat] of ring) {
    lonLo = Math.min(lonLo, lon); lonHi = Math.max(lonHi, lon);
    latLo = Math.min(latLo, lat); latHi = Math.max(latHi, lat);
  }
  return { lonLo, lonHi, latLo, latHi };
}
const centre = (b: Bounds) => ({ lon: (b.lonLo + b.lonHi) / 2, lat: (b.latLo + b.latHi) / 2 });
const fl = (x: number, step: number) => Math.floor(x / step) * step;

const W = 440, H = 440, PURPOSES = ['Range assessment for Red List', 'Field re-collection (permitted)', 'Taxonomic revision'];

export function DistributionMap() {
  const { koId: param } = useParams();
  const seed = useSeed();
  const koId = param ?? seed?.koId ?? '';
  const { principal } = useAuth();
  const { flash, node: toast } = useToast();

  const mapQ = useQuery({ queryKey: qk.map(koId), queryFn: () => ep.getMap(koId), enabled: !!koId });

  const [precision, setPrecision] = useState<'half' | 'qds' | 'precise'>('qds');
  const [requesting, setRequesting] = useState(false);
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [granted, setGranted] = useState(false);
  const [grantLeft, setGrantLeft] = useState(0);
  const [precise, setPrecise] = useState<Record<string, { lat: number; lon: number }>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectText, setRejectText] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const [selCode, setSelCode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // countdown on the active grant; auto-revert to QDS on expiry (precise never lingers)
  useEffect(() => {
    if (!granted) return;
    const t = setInterval(() => setGrantLeft((s) => {
      if (s <= 1) { clearInterval(t); setGranted(false); setPrecision('qds'); setPrecise({}); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [granted]);

  const obs = mapQ.data ?? [];
  const accepted = obs.filter((o) => o.verification === 'verified');
  const pending = obs.filter((o) => o.verification === 'raw');
  const rejected = obs.filter((o) => o.verification === 'rejected');
  const exact = precision === 'precise' && granted;
  const canDecide = !!principal && principal.roles.some((r) => r === 'author' || r === 'editor' || r === 'steward');
  const canGrant = !!principal && principal.roles.some((r) => r === 'editor' || r === 'steward');

  // viewport from the union of accepted+pending cell bounds, padded to whole degrees
  const view: Bounds = useMemo(() => {
    const cells = [...accepted, ...pending].map((o) => ringBounds(o.geometryGeneralised.coordinates[0]));
    if (cells.length === 0) return { lonLo: 18, lonHi: 19, latLo: -32, latHi: -31 };
    const u = cells.reduce((a, b) => ({ lonLo: Math.min(a.lonLo, b.lonLo), lonHi: Math.max(a.lonHi, b.lonHi), latLo: Math.min(a.latLo, b.latLo), latHi: Math.max(a.latHi, b.latHi) }));
    return { lonLo: Math.floor(u.lonLo), lonHi: Math.ceil(u.lonHi), latLo: Math.floor(u.latLo), latHi: Math.ceil(u.latHi) };
  }, [accepted, pending]);

  const projX = (lon: number) => ((lon - view.lonLo) / (view.lonHi - view.lonLo)) * W;
  const projY = (lat: number) => ((view.latHi - lat) / (view.latHi - view.latLo)) * H;

  // aggregate accepted into display cells: QDS (the polygon) or Half° (coarsened)
  const step = precision === 'half' ? 0.5 : 0.25;
  const cells = useMemo(() => {
    const map: Record<string, { b: Bounds; n: number; codes: string[] }> = {};
    for (const o of accepted) {
      const c = centre(ringBounds(o.geometryGeneralised.coordinates[0]));
      const lonLo = fl(c.lon, step), latLo = fl(c.lat, step);
      const key = precision === 'half' ? `${lonLo},${latLo}` : o.localityQDS;
      const b: Bounds = precision === 'half'
        ? { lonLo, lonHi: lonLo + step, latLo, latHi: latLo + step }
        : ringBounds(o.geometryGeneralised.coordinates[0]);
      (map[key] ||= { b, n: 0, codes: [] }); map[key].n++; map[key].codes.push(o.localityQDS);
    }
    return Object.entries(map).map(([key, v]) => ({ key, ...v }));
  }, [accepted, precision, step]);

  const onMove = (e: React.MouseEvent) => {
    const el = svgRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    if (px < 0 || px > 1 || py < 0 || py > 1) { setHover(null); return; }
    const lon = view.lonLo + px * (view.lonHi - view.lonLo), lat = view.latHi - py * (view.latHi - view.latLo);
    if (exact) { setHover(`${lat.toFixed(4)}, ${lon.toFixed(4)}`); return; }
    const cell = cells.find((c) => lon >= c.b.lonLo && lon < c.b.lonHi && lat >= c.b.latLo && lat < c.b.latHi);
    setHover(cell ? cell.codes[0] : '—');
  };

  const decide = async (obsId: string, decision: 'accept' | 'reject', comment?: string) => {
    try {
      await ep.decideObservation(obsId, decision, comment);
      flash(decision === 'accept' ? 'Observation accepted' : 'Observation rejected');
      setRejectId(null); setRejectText('');
      mapQ.refetch();
    } catch (e) {
      flash((e as { status?: number })?.status === 403 ? 'Not permitted — needs curator role' : 'Decision failed');
    }
  };

  // precise flow: certified user requests; an editor/steward grant unlocks in-session points.
  const doGrant = async () => {
    setRequesting(false);
    try {
      if (canGrant) {
        const got: Record<string, { lat: number; lon: number }> = {};
        for (const o of accepted) {
          await ep.issueGrant(o._id.replace(':public', ''), { grantee: principal!.accountId, purpose, ttlMs: 600_000 });
          const res = await ep.getPrecise(o._id.replace(':public', ''), purpose);
          if (res.status === 200 && 'lat' in res.body) got[o._id] = { lat: res.body.lat, lon: res.body.lon };
        }
        setPrecise(got); setGranted(true); setGrantLeft(600); setPrecision('precise');
        flash('Precise access granted · 10 min · in-session only');
      } else {
        // certified but not a granting authority: hit the policy engine; expect "access required"
        const any = accepted[0];
        const res = any ? await ep.getPrecise(any._id.replace(':public', ''), purpose) : { status: 403 };
        flash(res.status === 200 ? 'Access served' : 'Access required — no active grant; ask an editor');
      }
    } catch { flash('Precise request failed'); }
  };
  const revoke = () => { setGranted(false); setPrecision('qds'); setPrecise({}); };

  const tryPrecise = () => {
    if (!principal || principal.assurance !== 'certified') { flash('Precise access needs a certified account'); return; }
    if (granted) setPrecision('precise'); else setRequesting(true);
  };
  const mmss = `${Math.floor(grantLeft / 60)}:${String(grantLeft % 60).padStart(2, '0')}`;

  if (!koId) return <div className="jose-stub"><h2>No object selected</h2><p>Open a treatment first.</p></div>;
  if (mapQ.isLoading) return <div className="jose-loading">Loading distribution…</div>;

  const gridStep = precision === 'half' ? 0.5 : 0.25;
  const gridLines: React.ReactNode[] = [];
  for (let lon = view.lonLo; lon <= view.lonHi + 1e-9; lon += gridStep) gridLines.push(<line key={'v' + lon} x1={projX(lon)} y1={0} x2={projX(lon)} y2={H} stroke="#D9DED6" strokeWidth={Math.abs(lon % 1) < 1e-9 ? 1 : 0.5} />);
  for (let lat = view.latLo; lat <= view.latHi + 1e-9; lat += gridStep) gridLines.push(<line key={'h' + lat} x1={0} y1={projY(lat)} x2={W} y2={projY(lat)} stroke="#D9DED6" strokeWidth={Math.abs(lat % 1) < 1e-9 ? 1 : 0.5} />);

  return (
    <div>
      <div className="mp-head">
        <div className="mp-h-title">Distribution · <i>Mesembryanthemum aureum</i></div>
        <span className="mp-prec">precision
          <span className="mp-seg" role="group" aria-label="Precision">
            <button aria-pressed={precision === 'half'} onClick={() => setPrecision('half')}>Half°</button>
            <button aria-pressed={precision === 'qds'} onClick={() => setPrecision('qds')}>QDS</button>
            <button className={!granted ? 'locked' : ''} aria-pressed={precision === 'precise'} onClick={tryPrecise}>{granted ? 'Precise' : '🔒 Precise'}</button>
          </span>
        </span>
        {granted && <span className="mp-grant">precise · in-session · expires {mmss} · not saved to device <button onClick={revoke}>revoke</button></span>}
      </div>

      <div className="mp-body">
        <div className="mp-stage">
          <div className="mp-svgwrap">
            <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', maxWidth: '100%' }} role="img" aria-label="QDS distribution map">
              <rect x={0} y={0} width={W} height={H} fill="#fbfcfa" />
              {gridLines}
              {!exact && cells.map((c) => {
                const x = projX(c.b.lonLo), y = projY(c.b.latHi), w = projX(c.b.lonHi) - projX(c.b.lonLo), h = projY(c.b.latLo) - projY(c.b.latHi);
                const on = selCode === c.key;
                return (
                  <g key={c.key} className="mp-cell" onClick={() => setSelCode(c.key)}>
                    <rect x={x} y={y} width={w} height={h} fill="#2E6E5E" fillOpacity={on ? 0.34 : 0.2} stroke="#2E6E5E" strokeOpacity={on ? 0.9 : 0.5} />
                    <text x={x + w / 2} y={y + h / 2} fontFamily="IBM Plex Mono, monospace" fontSize={12} fill="#2E6E5E" textAnchor="middle" dominantBaseline="middle">{c.n}</text>
                  </g>
                );
              })}
              {exact && Object.values(precise).map((p, i) => (
                <g key={i}><circle cx={projX(p.lon)} cy={projY(p.lat)} r={4.5} fill="#A83A2C" /><circle cx={projX(p.lon)} cy={projY(p.lat)} r={9} fill="none" stroke="#A83A2C" strokeOpacity={0.4} /></g>
              ))}
              {pending.map((o) => { const c = centre(ringBounds(o.geometryGeneralised.coordinates[0])); const cx = projX(c.lon), cy = projY(c.lat);
                return <rect key={o._id} x={cx - 5} y={cy - 5} width={10} height={10} fill="none" stroke="#C9A23A" strokeWidth={2} transform={`rotate(45 ${cx} ${cy})`} />; })}
            </svg>
          </div>

          <div className="mp-readout">
            <span><span className="lbl">cursor</span> {hover || '—'}</span>
            {selCode && !exact && <span><span className="lbl">cell</span> {cells.find((c) => c.key === selCode)?.codes[0]} · {cells.find((c) => c.key === selCode)?.n} obs · ≈25 km</span>}
            {exact && <span className="red">⚠ exact coordinates — served in-session, never written to the offline store (AC 11.5)</span>}
          </div>

          <div className="mp-legend">
            <span><i style={{ background: '#2E6E5E', opacity: 0.4 }} />accepted (obfuscated cell)</span>
            <span><i style={{ background: 'transparent', border: '2px solid #C9A23A' }} />pending</span>
            <span><i style={{ background: '#A83A2C' }} />exact point (granted)</span>
          </div>

          <div className="mp-about">
            <b>Casabio QDS</b> — localities are generalised to quarter-degree squares (≈25&nbsp;km), aggregated by cell so an individual record's site is never disclosed. <b>Half°</b> coarsens further; <b>QDS</b> is the public floor; <b>🔒 Precise</b> requires a certified account and a per-object, purpose-bound, expiring grant served only in-session — the precise coordinate is never in the replicated projection.
          </div>
        </div>

        <div className="mp-rail">
          <h3 className="mp-rh">Pending · {pending.length}</h3>
          <div className="mp-rsub">Accept to add to the distribution. Rejection requires a reason.</div>
          {pending.map((o) => {
            const obsId = o._id.replace(':public', '');
            return (
              <div key={o._id} className="po-card">
                <div className="po-top"><span className="po-id">{obsId}</span><span className="po-src">{o.source.system}</span></div>
                <div className="po-meta"><span className="coord">{o.localityQDS}</span></div>
                {rejectId === obsId ? (
                  <div className="po-reject">
                    <textarea value={rejectText} onChange={(e) => setRejectText(e.target.value)} placeholder="Why is this being rejected? (required)" aria-label="Rejection reason" />
                    <div className="need">A reason is required and is kept on the record.</div>
                    <div className="row"><button onClick={() => { setRejectId(null); setRejectText(''); }}>Cancel</button><button className="confirm" disabled={!rejectText.trim()} onClick={() => decide(obsId, 'reject', rejectText.trim())}>Confirm reject</button></div>
                  </div>
                ) : (
                  <div className="po-acts">
                    <button className="acc" disabled={!canDecide} onClick={() => decide(obsId, 'accept')}>Accept</button>
                    <button className="rej" disabled={!canDecide} onClick={() => { setRejectId(obsId); setRejectText(''); }}>Reject</button>
                  </div>
                )}
              </div>
            );
          })}
          {pending.length === 0 && <div className="mp-rsub">No pending observations.</div>}
          {!canDecide && pending.length > 0 && <div className="mp-rsub">Sign in as a curator (author/editor) to decide.</div>}

          {rejected.length > 0 && (<>
            <h3 className="mp-rh" style={{ marginTop: 24 }}>Resolved</h3>
            {rejected.map((o) => <div key={o._id} className="po-done"><span className="mk x">✕</span>{o._id.replace(':public', '')} rejected</div>)}
          </>)}

          <h3 className="mp-rh" style={{ marginTop: 24 }}>Precise access</h3>
          {!granted && !requesting && <div className="mp-rsub">Localities are shown at QDS. Precise coordinates need a per-object, purpose-bound, expiring grant.</div>}
          {requesting && (
            <div className="mp-reqcard">
              <h4>Request precise access</h4>
              <p>Object-specific, time-limited (10 min), logged, and revocable. Served in-session only — never written to your device.</p>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label="Purpose">{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select>
              <div className="row"><button onClick={() => setRequesting(false)}>Cancel</button><button className="grant" onClick={doGrant}>{canGrant ? 'Grant' : 'Request'}</button></div>
            </div>
          )}
          {granted && <div className="mp-rsub" style={{ color: 'var(--type-red)' }}>Active grant · {purpose} · expires {mmss}. {Object.keys(precise).length} point(s) in session.</div>}
        </div>
      </div>
      {toast}
    </div>
  );
}
