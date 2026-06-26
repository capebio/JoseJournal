// Seed one real flagship treatment into the live backend so the frontend Reader
// renders genuine data: 3 versions (accretion), a name+concept, a QDS observation,
// a reviewer orange disposition + author reply, a snippet anchor, and a VoR + DOI.
// Writes frontend/public/seed.json with the ids the FE uses as its demo entry point.
import { writeFileSync } from 'fs';

const B = process.env.B || 'http://localhost:3000';
const j = async (r) => { const t = await r.text(); try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; } };
const post = (p, tok, body) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) }).then(j);
const login = async (b) => (await post('/auth/dev-login', null, b)).body.token;

const author = await login({ sub: 'seed-author', accountId: 'acct:botha', assurance: 'verified', roles: ['author', 'contributor'], name: 'R. Botha' });
const editor = await login({ sub: 'seed-editor', accountId: 'acct:klak', assurance: 'certified', roles: ['editor', 'steward'], name: 'A. Klak' });
const reviewer = await login({ sub: 'seed-reviewer', accountId: 'acct:smith', assurance: 'verified', roles: ['reviewer'], name: 'J. Smith' });

const desc = (extraBlocks = [], distBlocks = []) => ({
  title: 'Mesembryanthemum aureum Botha',
  sections: [
    {
      path: 'description',
      title: 'Description',
      blocks: [
        { blockId: 'blk:d1', type: 'paragraph', text: 'Compact, mat-forming leaf-succulent; leaves opposite, terete to semi-terete, 8–20 mm long, densely covered in glistening bladder cells (papillae) that lend the plant a frosted appearance.', claims: ['claim:c1'] },
        { blockId: 'blk:d2', type: 'paragraph', text: 'The bladder cells are most conspicuous on young growth and along the leaf margins, where they form a dense, water-storing epidermal layer that reduces transpiration in the open quartz fields.' },
        ...extraBlocks,
      ],
    },
    {
      path: 'nomenclature',
      title: 'Nomenclature & Type',
      blocks: [
        { blockId: 'blk:n1', type: 'paragraph', text: 'Type: SOUTH AFRICA, Western Cape, Knersvlakte [locality generalised to QDS 3118], Botha 1142 (holo-: NBG).' },
      ],
    },
    ...(distBlocks.length ? [{ path: 'distribution', title: 'Distribution', blocks: distBlocks }] : []),
  ],
  claims: {
    'claim:c1': { statement: 'Leaves bear glistening bladder cells.', evidence: ['specimen:Botha 1142 (NBG)', 'figure:Fig 1 · habit'], confidence: 'author-asserted' },
  },
});

// v1 — create (public Commons)
const v1 = (await post('/ko', author, { koType: 'treatment', tier: 'commons', visibility: 'public', content: desc() })).body;
const koId = v1.entity._id;
let tip = v1.version._id;

// taxonomy: name + concept sec. this treatment
const name = (await post('/names', author, { nameString: 'Mesembryanthemum aureum', authorship: 'Botha', rank: 'species', code: 'ICN' })).body;
await post('/concepts', author, { nameId: name.id, secVersion: tip, circumscription: { sense: 'sec. Botha 2026' } });

// v2 — amend: add a distribution section
const v2 = (await post(`/ko/${koId}/amend`, author, {
  baseVersionId: tip, amendClass: 'substantive',
  content: desc([], [{ blockId: 'blk:dist1', type: 'paragraph', text: 'Recorded from the Knersvlakte and adjacent quartz patches; 38 accepted observations span seven quarter-degree squares. Localities are shown at QDS resolution (~20×20 km).' }]),
})).body;
tip = v2._id;

// a real QDS micro-observation
const obs = (await post('/observations', author, { taxonConcept: 'concept:mesemb', lat: -31.2, lon: 18.6, sensitivity: 'sensitive', source: { system: 'casabio', id: 'casabio:obs:441' }, note: 'Visiting flower.' })).body;
const obsId = obs.obsId;

// a real distribution attached to the treatment (Knersvlakte) — some accepted, some pending.
const DIST = [
  { lat: -31.32, lon: 18.61, sys: 'casabio', id: 'obs:441', accept: true },
  { lat: -31.45, lon: 18.40, sys: 'inaturalist', id: 'obs:512', accept: true },
  { lat: -31.28, lon: 18.72, sys: 'gbif', id: 'obs:233', accept: true },
  { lat: -31.61, lon: 18.55, sys: 'casabio', id: 'obs:618', accept: true },
  { lat: -31.34, lon: 18.59, sys: 'casabio', id: 'obs:701', accept: true },
  { lat: -31.50, lon: 18.66, sys: 'inaturalist', id: 'obs:744', accept: false },
  { lat: -31.38, lon: 18.49, sys: 'gbif', id: 'obs:777', accept: false },
  { lat: -31.71, lon: 18.83, sys: 'inaturalist', id: 'obs:802', accept: false },
];
const distObs = [];
for (const d of DIST) {
  const o = (await post('/observations', author, { taxonConcept: 'concept:mesemb', lat: d.lat, lon: d.lon, sensitivity: 'sensitive', source: { system: d.sys, id: 'casabio:' + d.id }, attachKo: koId })).body;
  if (d.accept) await post(`/observations/${encodeURIComponent(o.obsId)}/decision`, editor, { decision: 'accept' });
  distObs.push({ obsId: o.obsId, qds: o.public.localityQDS, accepted: d.accept });
}

// v3 — amend: accrete a pollination claim sourced from the micro-observation
const v3content = desc(
  [{ blockId: 'blk:d4', type: 'paragraph', text: 'Visited by solitary bees (Anthophora sp.); a single timed visit was recorded at the type locality.', claims: ['claim:c2'] }],
  [{ blockId: 'blk:dist1', type: 'paragraph', text: 'Recorded from the Knersvlakte and adjacent quartz patches; 38 accepted observations span seven quarter-degree squares. Localities are shown at QDS resolution (~20×20 km).' }],
);
v3content.claims['claim:c2'] = { statement: 'Visited by solitary bees.', evidence: [`${obsId}`, 'figure:Fig 2 · visitor'], confidence: 'author-asserted' };
const v3 = (await post(`/ko/${koId}/amend`, author, { baseVersionId: tip, amendClass: 'substantive', content: v3content })).body;
tip = v3._id;

// review: author nominates, reviewer sets orange, author replies (so release can pass)
const thread = (await post(`/ko/${koId}/reviewers`, author, { reviewer: 'acct:smith' })).body;
await post(`/ko/${koId}/review`, reviewer, { threadId: thread.id, disposition: 'orange', comment: 'Holotype barcode not cited.' });
await post(`/ko/${koId}/review/${encodeURIComponent(thread.id)}/reply`, author, { reply: 'Barcode NBG0123456 will be added in the next version.' });
// also a green thread for contrast
const t2 = (await post(`/ko/${koId}/reviewers`, author, { reviewer: 'acct:klak' })).body;
await post(`/ko/${koId}/review`, editor, { threadId: t2.id, disposition: 'green', comment: 'Diagnosis is clear and well supported by the bladder-cell character.' });

// a co-author, named-unconfirmed
await post(`/ko/${koId}/coauthors`, author, { candidate: 'acct:dlamini' });

// a snippet anchor on the first description block
const snip = (await post('/snippets', author, { versionId: tip, sectionPath: 'description', blockId: 'blk:d1' })).body;

// AI provenance declaration
await post(`/ko/${koId}/ai-declaration`, author, { coverage: 'recorded', role: 'drafting,editing', model: 'claude-sonnet-4-6 (generic)' });

// release as Journal Version of Record (gate passes: orange has a reply)
const rel = (await post(`/ko/${koId}/release`, author, { tier: 'journal' })).body;

const seed = { koId, vorVersionId: rel.version?._id ?? null, doi: rel.doi ?? null, obsId, snippetId: snip.id, name: name.id, distObs };
writeFileSync(new URL('../frontend/public/seed.json', import.meta.url), JSON.stringify(seed, null, 2));
console.log('SEEDED', JSON.stringify(seed, null, 2));
