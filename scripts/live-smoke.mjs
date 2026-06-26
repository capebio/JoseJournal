// Live smoke against the running monolith (PERSISTENCE=live) + real Couch.
// Proves data actually lands in the live stores. Node 24 global fetch.
const B = process.env.B || 'http://localhost:3222';
const COUCH = 'http://localhost:5984';
const COUCH_AUTH = { Authorization: 'Basic ' + Buffer.from('admin:josepw').toString('base64') };
const couchGet = (path) => fetch(`${COUCH}/${path}`, { headers: COUCH_AUTH });
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, tok, body) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) }).then(j);
const get = (p, tok) => fetch(B + p, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} }).then((r) => r.status === 200 ? j(r) : ({ status: r.status, body: null }));
const login = async (b) => (await post('/auth/dev-login', null, b)).body.token;

const out = {};
const author = await login({ sub: 'la', accountId: 'acct:la', assurance: 'verified', roles: ['author', 'contributor'] });
const editor = await login({ sub: 'le', accountId: 'acct:le', assurance: 'certified', roles: ['editor', 'steward'] });
const researcher = await login({ sub: 'lr', accountId: 'acct:lr', assurance: 'certified', roles: ['contributor'] });

// 1) create treatment KO -> real Couch
const ko = (await post('/ko', author, {
  koType: 'treatment', tier: 'commons', visibility: 'public',
  content: { title: 'Mesembryanthemum (live)', sections: [{ path: 'description', blocks: [{ blockId: 'blk:d', type: 'paragraph', text: 'Succulent, opposite leaves.' }] }], claims: {} },
})).body;
out.koId = ko.entity._id; out.v1 = ko.version._id;

// confirm the entity + version really exist in Couch content DB
const couchEntity = await (await couchGet(`jose_content/${out.koId}`)).json();
const couchVersion = await (await couchGet(`jose_content/${encodeURIComponent(out.v1)}`)).json();
out.couch_entity_ok = couchEntity._id === out.koId;
out.couch_version_ok = couchVersion._id === out.v1 && couchVersion.contentHash === out.v1.replace('ver:', '');

// 2) sensitive observation -> public QDS projection + restricted precise
const obs = (await post('/observations', author, {
  taxonConcept: 'concept:live', lat: -33.9249, lon: 18.4241, sensitivity: 'highly-sensitive',
  source: { system: 'casabio', id: 'casabio:obs:live1' },
})).body;
out.obsId = obs.obsId; out.qds = obs.public.localityQDS;

// confirm public projection in Couch has NO precise coordinate
const pubRaw = await (await couchGet(`jose_public/${encodeURIComponent(out.obsId)}:public`)).text();
out.public_has_precise = pubRaw.includes('33.9249') || pubRaw.includes('18.4241') || pubRaw.includes('"lat"');
out.public_qds = JSON.parse(pubRaw).localityQDS;

// 3) release Journal VoR + DOI
const rel = (await post(`/ko/${out.koId}/release`, author, { tier: 'journal' })).body;
out.doi = rel.doi; out.vorStatus = rel.version.status; out.vor = rel.version._id;

// 4) cite as DOI
out.cite = (await get(`/cite/${out.koId}?as=doi`)).body;

// 5) anti-poaching precise flow
out.precise_nogrant_status = (await get(`/localities/${out.obsId}/precise?purpose=field-verification`, researcher)).status;
out.grant_status = (await post(`/localities/${out.obsId}/access`, editor, { grantee: 'acct:lr', purpose: 'field-verification', ttlMs: 60000 })).status;
const served = await get(`/localities/${out.obsId}/precise?purpose=field-verification`, researcher);
out.precise_grant_status = served.status; out.precise_served = served.body;

// machine-readable markers for the follow-up psql checks
console.log('OBSID=' + out.obsId);
console.log('DOI=' + out.doi);
console.log('VOR=' + out.vor);
console.log(JSON.stringify(out, null, 2));
