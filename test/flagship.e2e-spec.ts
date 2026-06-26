import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@src/app.module';
import type { KnowledgeObjectContent } from '@core/types';

/**
 * M10 — the v1 acceptance gate (§1 flagship). One real treatment from the
 * Mesembryanthemum complex exercised end to end over HTTP: real observations, a
 * QDS map, a competing taxon concept, evidence, a correction producing a new
 * version, a reviewer exchange with dispositions (release blocked then unblocked),
 * a co-author named-unconfirmed, a cited snippet, a DOI-bearing Version of Record,
 * and the anti-poaching precise-locality flow. This is the synthesis of §9.
 */
const PRECISE = { lat: -33.9249, lon: 18.4241 }; // Cape Peninsula — real Mesemb country

function treatment(title: string, descText: string): KnowledgeObjectContent {
  return {
    title,
    sections: [
      {
        path: 'description',
        blocks: [
          { blockId: 'blk:desc', type: 'paragraph', text: descText, claims: ['claim:pollination'] },
          { blockId: 'blk:fig', type: 'figure', captions: { surface: 'Fig 1. Habit.', verbose: 'Fig 1. Habit, succulent opposite leaves.' } },
        ],
      },
    ],
    claims: {
      'claim:pollination': { statement: 'Visited by solitary bees.', evidence: [], confidence: 'author-asserted' },
    },
  };
}

describe('FLAGSHIP — Mesembryanthemum treatment, end to end (§9 synthesis)', () => {
  let app: INestApplication;
  let http: any;
  const tok: Record<string, string> = {};

  const auth = (who: string) => ({ Authorization: `Bearer ${tok[who]}` });

  beforeAll(async () => {
    process.env.PERSISTENCE = 'memory';
    process.env.AUTH_DEV_MODE = 'true';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    http = app.getHttpServer();

    const login = async (who: string, body: Record<string, unknown>) => {
      const res = await request(http).post('/auth/dev-login').send(body).expect(201);
      tok[who] = res.body.token;
    };
    await login('author', { sub: 'author', accountId: 'acct:author', assurance: 'verified', roles: ['author', 'contributor'], name: 'A. Author' });
    await login('editor', { sub: 'editor', accountId: 'acct:editor', assurance: 'certified', roles: ['editor', 'steward'], name: 'E. Editor' });
    await login('reviewer', { sub: 'reviewer', accountId: 'acct:reviewer', assurance: 'verified', roles: ['reviewer'], name: 'R. Reviewer' });
    await login('researcher', { sub: 'researcher', accountId: 'acct:researcher', assurance: 'certified', roles: ['contributor'], name: 'F. Fieldworker' });
  });

  afterAll(async () => app?.close());

  it('runs the whole lifecycle and satisfies every acceptance dimension', async () => {
    // 1) Author creates the living treatment (public).
    const created = await request(http)
      .post('/ko')
      .set(auth('author'))
      .send({ koType: 'treatment', tier: 'commons', visibility: 'public', content: treatment('Mesembryanthemum treatment', 'Leaves opposite, succulent; flowers diurnal.') })
      .expect(201);
    const koId = created.body.entity._id;
    const v1 = created.body.version._id;
    expect(koId).toMatch(/^ko:/);
    expect(v1).toMatch(/^ver:sha256-/);

    // 2) TDWG: a name + TWO competing concepts on it (Name ≠ Taxon, §9.7).
    const name = await request(http).post('/names').set(auth('author')).send({ nameString: 'Mesembryanthemum', authorship: 'L.', rank: 'genus', code: 'ICN' }).expect(201);
    const nameId = name.body.id;
    await request(http).post('/concepts').set(auth('author')).send({ nameId, secVersion: v1, circumscription: { sense: 's.l. sec. this treatment' } }).expect(201);
    await request(http).post('/concepts').set(auth('editor')).send({ nameId, secVersion: v1, circumscription: { sense: 's.str. sec. dissenting treatment' } }).expect(201);
    const concepts = await request(http).get(`/names/${encodeURIComponent(nameId)}/concepts`).expect(200);
    expect(concepts.body.length).toBe(2); // both coexist, neither overwrites
    const conceptId = concepts.body[0].id;

    // 3) Ingest a real micro-observation (auto-splits public QDS / restricted precise).
    const obs = await request(http)
      .post('/observations')
      .set(auth('author'))
      .send({ taxonConcept: conceptId, lat: PRECISE.lat, lon: PRECISE.lon, sensitivity: 'highly-sensitive', source: { system: 'casabio', id: 'casabio:obs:42' }, note: 'On granite outcrop.' })
      .expect(201);
    const obsId = obs.body.obsId;
    const obsKoId = obs.body.koId;
    expect(obs.body.public.localityQDS).toMatch(/^\d{4}[A-D]{2}$/);

    // 4) QDS distribution map — and it leaks NO precise coordinate (§9.5).
    const map = await request(http).get(`/map/${obsKoId}`).expect(200);
    const mapJson = JSON.stringify(map.body);
    expect(mapJson).not.toContain('33.9249');
    expect(mapJson).not.toContain('18.4241');
    expect(mapJson).not.toContain('"lat"');

    // 5) Curator accepts the observation (reject would require a comment).
    const decided = await request(http).post(`/observations/${obsId}/decision`).set(auth('editor')).send({ decision: 'accept' }).expect(201);
    expect(decided.body.verification).toBe('verified');

    // 6) A correction producing a NEW version (the moving snapshot accretes).
    const amended = await request(http)
      .post(`/ko/${koId}/amend`)
      .set(auth('author'))
      .send({ baseVersionId: v1, amendClass: 'substantive', content: treatment('Mesembryanthemum treatment', `Leaves opposite, succulent; flowers diurnal. Pollination evidenced by ${obsId}.`) })
      .expect(201);
    const v2 = amended.body._id;
    expect(v2).not.toBe(v1);

    // 7) The micro-observation is cited by the treatment — a snippet anchor.
    const snip = await request(http).post('/snippets').set(auth('author')).send({ versionId: v2, sectionPath: 'description', blockId: 'blk:desc' }).expect(201);
    const resolved = await request(http).get(`/snippets/${encodeURIComponent(snip.body.id)}`).expect(200);
    expect(resolved.body.drift).toBe(false); // cited against the live tip; unchanged

    // 8) Reviewer exchange — an orange disposition BLOCKS release until the author replies (§9.6).
    const thread = await request(http).post(`/ko/${koId}/reviewers`).set(auth('author')).send({ reviewer: 'acct:reviewer' }).expect(201);
    await request(http).post(`/ko/${koId}/review`).set(auth('reviewer')).send({ threadId: thread.body.id, disposition: 'orange', comment: 'Cite more localities.' }).expect(201);
    await request(http).post(`/ko/${koId}/release`).set(auth('author')).send({ tier: 'journal' }).expect(409); // blocked
    await request(http).post(`/ko/${koId}/review/${encodeURIComponent(thread.body.id)}/reply`).set(auth('author')).send({ reply: 'Added the granite-outcrop record.' }).expect(201);

    // 9) Co-author named, unconfirmed (nobody silently signed off).
    const consent = await request(http).post(`/ko/${koId}/coauthors`).set(auth('author')).send({ candidate: 'acct:cocollector' }).expect(201);
    expect(consent.body.state).toBe('named-unconfirmed');

    // 10) Now the Version of Record + DOI (release unblocked).
    const released = await request(http).post(`/ko/${koId}/release`).set(auth('author')).send({ tier: 'journal' }).expect(201);
    const doi = released.body.doi;
    const vor = released.body.version._id;
    expect(doi).toMatch(/^10\./);
    expect(released.body.version.status).toBe('vor');

    // 11) The VoR + DOI resolve to the exact immutable state (never a redirect).
    const vorRead = await request(http).get(`/ko/${koId}/v/${encodeURIComponent(vor)}`).expect(200);
    expect(vorRead.body.version.status).toBe('vor');
    expect(vorRead.body.version.doi).toBe(doi);
    const cite = await request(http).get(`/cite/${koId}?as=doi`).expect(200);
    expect(cite.body.doi).toBe(doi);

    // 12) Entity URL graduated to Journal tier.
    const entityRead = await request(http).get(`/ko/${koId}`).expect(200);
    expect(entityRead.body.entity.tier).toBe('journal');
    expect(entityRead.body.relation.isLatest).toBe(true);

    // 13) Anti-poaching precise flow: denied without a grant, served with one (audited).
    await request(http).get(`/localities/${obsId}/precise?purpose=field-verification`).set(auth('researcher')).expect(403);
    await request(http).post(`/localities/${obsId}/access`).set(auth('editor')).send({ grantee: 'acct:researcher', purpose: 'field-verification', ttlMs: 60000 }).expect(201);
    const precise = await request(http).get(`/localities/${obsId}/precise?purpose=field-verification`).set(auth('researcher')).expect(200);
    expect(precise.body.lat).toBeCloseTo(PRECISE.lat, 3);
    expect(precise.body.lon).toBeCloseTo(PRECISE.lon, 3);

    // 14) Total provenance: public events exist; nothing released is unattributed.
    const prov = await request(http).get(`/ko/${koId}/provenance`).expect(200);
    expect(Array.isArray(prov.body)).toBe(true);
    const audit = await request(http).get(`/audit/provenance?subject=${encodeURIComponent(vor)}`).set(auth('editor')).expect(200);
    expect(audit.body.some((e: any) => e.action === 'released')).toBe(true);
  });

  it('a private draft never appears in any public projection (§9.2)', async () => {
    const draft = await request(http)
      .post('/ko')
      .set(auth('author'))
      .send({ koType: 'article', visibility: 'private', content: treatment('Secret draft', 'unpublished') })
      .expect(201);
    // An anonymous reader cannot read the private version.
    await request(http).get(`/ko/${draft.body.entity._id}`).expect(403);
  });
});
