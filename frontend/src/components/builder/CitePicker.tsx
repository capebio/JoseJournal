/**
 * FE4 Builder — Insert-citation modal (Frontend Spec §5.3). Search the existing
 * bibliography, or add a new reference four ways: By DOI (resolves a small known
 * DOI table, unknown DOIs insert an editable stub), Search (canned web results),
 * JOSE object (pins a living object at its VoR or moving tip), and Manual entry.
 */
import type { Reference } from '../../core/api/types';
import { useFocusTrap } from '../common/useFocusTrap';
import { fmtRef, JOSE_OBJECTS, WEB_RESULTS, type JoseObject, type RefInput } from './citations';

export interface PickState {
  method: 'doi' | 'web' | 'jose' | 'manual' | null;
  query: string;
  doi: string;
  manual: { type?: Reference['type']; authors?: string; title?: string; year?: string; source?: string; doi?: string };
}

export const EMPTY_PICK: PickState = { method: null, query: '', doi: '', manual: {} };

interface CitePickerProps {
  pick: PickState;
  setPick: (p: PickState | null) => void;
  refs: Reference[];
  insertExisting: (key: string) => void;
  resolveDoi: () => void;
  addJose: (obj: JoseObject, ver: string) => void;
  addManual: () => void;
  addAndInsert: (r: RefInput) => void;
}

export function CitePicker({ pick, setPick, refs, insertExisting, resolveDoi, addJose, addManual, addAndInsert }: CitePickerProps) {
  const q = (pick.query || '').toLowerCase();
  const matches = refs.filter((r) => !q || (r.title + ' ' + r.authors + ' ' + r.key + ' ' + r.year).toLowerCase().includes(q));
  const set = (patch: Partial<PickState>) => setPick({ ...pick, ...patch });
  const setM = (patch: Partial<PickState['manual']>) => setPick({ ...pick, manual: { ...(pick.manual || {}), ...patch } });
  const dialogRef = useFocusTrap<HTMLDivElement>(() => setPick(null));

  return (
    <div className="bld-pick-back" onMouseDown={() => setPick(null)}>
      <div ref={dialogRef} className="bld-pick" role="dialog" aria-modal="true" aria-label="Insert citation" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bld-pick-h">
          <h4>Insert citation</h4>
          <button className="x" aria-label="Close" onClick={() => setPick(null)}>×</button>
        </div>

        <div className="bld-pick-sec">
          <input
            className="bld-search"
            autoFocus
            aria-label="Search your bibliography"
            placeholder="Search your bibliography…"
            value={pick.query || ''}
            onChange={(e) => set({ query: e.target.value })}
          />
          <div style={{ marginTop: 8 }}>
            {matches.map((r) => (
              <button key={r.id} className="bld-pickitem" onClick={() => insertExisting(r.key)}>
                <div className="pt">{fmtRef(r)}</div>
                <div className="pm">@{r.key} · {r.type === 'jose' ? <span className="jose">JOSE living object</span> : r.type}</div>
              </button>
            ))}
            {matches.length === 0 && <div className="bld-empty">No match in your library — add it below.</div>}
          </div>
        </div>

        <div className="bld-methods">
          <span className="bld-methlab">Add a new reference</span>
          {(['doi', 'web', 'jose', 'manual'] as const).map((mth) => (
            <button
              key={mth}
              className="bld-method"
              aria-pressed={pick.method === mth}
              onClick={() => set({ method: pick.method === mth ? null : mth })}
            >
              {mth === 'doi' ? 'By DOI' : mth === 'web' ? 'Search' : mth === 'jose' ? 'JOSE object' : 'Manual'}
            </button>
          ))}
        </div>

        {pick.method === 'doi' && (
          <form className="bld-form" onSubmit={(e) => { e.preventDefault(); resolveDoi(); }}>
            <input aria-label="DOI" placeholder="10.1111/jbi.13889" value={pick.doi || ''} onChange={(e) => set({ doi: e.target.value })} />
            <button className="go" type="submit">Resolve &amp; insert</button>
            <div className="hint">
              Try <b>10.1111/jbi.13889</b> or <b>10.1554/05-528.1</b> — resolves to a formatted reference.
              (Unknown DOIs insert a stub you can edit.)
            </div>
          </form>
        )}

        {pick.method === 'web' && (
          <div className="bld-pick-sec">
            {WEB_RESULTS.map((r, i) => (
              <button key={i} className="bld-pickitem" onClick={() => addAndInsert(r)}>
                <div className="pt">{fmtRef({ ...r, id: 'web' + i, key: 'web' + i } as Reference)}</div>
                <div className="pm">{r.doi || 'no DOI'} · click to add &amp; cite</div>
              </button>
            ))}
          </div>
        )}

        {pick.method === 'jose' && (
          <div className="bld-form">
            {JOSE_OBJECTS.map((o, i) => (
              <div className="bld-josecard" key={i}>
                <div className="jt">{o.authors} ({o.year}). <i>{o.title}</i></div>
                <div className="jcoord">{o.concept} · tip {o.tip}</div>
                <div className="jv">
                  {o.vor && <button className="vor" onClick={() => addJose(o, o.vor!)}>cite VoR ({o.vor})</button>}
                  <button onClick={() => addJose(o, o.tip)}>cite tip ({o.tip})</button>
                </div>
              </div>
            ))}
            <div className="hint">
              Citing a living object pins a version. The VoR is frozen and citable; the tip moves —
              JOSE records exactly which you cited.
            </div>
          </div>
        )}

        {pick.method === 'manual' && (
          <form className="bld-form" onSubmit={(e) => { e.preventDefault(); addManual(); }}>
            <input aria-label="Authors" placeholder="Authors (e.g. Klak, C. & Bruyns, P. V.)" value={pick.manual?.authors || ''} onChange={(e) => setM({ authors: e.target.value })} />
            <input aria-label="Title" placeholder="Title" value={pick.manual?.title || ''} onChange={(e) => setM({ title: e.target.value })} />
            <div className="row2">
              <input aria-label="Year" placeholder="Year" value={pick.manual?.year || ''} onChange={(e) => setM({ year: e.target.value })} />
              <input aria-label="Source or journal" placeholder="Source / journal" value={pick.manual?.source || ''} onChange={(e) => setM({ source: e.target.value })} />
            </div>
            <input aria-label="DOI (optional)" placeholder="DOI (optional)" value={pick.manual?.doi || ''} onChange={(e) => setM({ doi: e.target.value })} />
            <button className="go" type="submit">Add &amp; insert</button>
          </form>
        )}
      </div>
    </div>
  );
}
