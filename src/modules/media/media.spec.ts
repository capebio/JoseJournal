import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PORTS, type MediaRepo } from '@core/ports';
import type { ActorRole } from '@core/types';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { MediaService } from './media.service';
import { MediaModule } from './media.module';

const ACTOR = { ref: 'acct:author1', role: 'author' as ActorRole };

// A tiny "diagnostic" blob (stands in for a verification-resolution image).
const SAMPLE_BYTES = Buffer.from('JOSE diagnostic character — leaf venation, x40', 'utf8');
const SAMPLE_B64 = SAMPLE_BYTES.toString('base64');

/**
 * MediaModule is not part of the shared makeContext() harness, so we build an
 * equivalent in-memory DI context here: global Persistence (in-memory adapters),
 * global Provenance, and the module under test.
 */
async function makeMediaContext(): Promise<TestingModule> {
  process.env.PERSISTENCE = 'memory';
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
      PersistenceModule.forRoot(),
      ProvenanceModule,
      MediaModule,
    ],
  }).compile();
}

describe('§9.9 Media / verification-resolution-always-free', () => {
  let mod: TestingModule;
  let media: MediaService;
  let repo: MediaRepo;

  beforeEach(async () => {
    mod = await makeMediaContext();
    await mod.init();
    media = mod.get(MediaService);
    repo = mod.get(PORTS.MediaRepo);
  });
  afterEach(async () => mod.close());

  it('a master is content-addressed (sha256-…), EXIF-marked, and carries jxl + iiif derivatives', async () => {
    const meta = await media.uploadMaster({
      mime: 'image/jpeg',
      bytes: SAMPLE_BYTES,
      verificationMaxEdge: 4096,
      actorRef: ACTOR.ref,
      actorRole: ACTOR.role,
    });

    expect(meta.id).toMatch(/^media:/);
    expect(meta.contentAddress).toMatch(/^sha256-/);
    expect(meta.bytes).toBe(SAMPLE_BYTES.length);
    expect(meta.exifStripped).toBe(true); // §6 anti-leakage flag

    // Derivatives exist and are themselves content-addressed.
    expect(meta.derivatives['jxl']).toBeDefined();
    expect(meta.derivatives['jxl'].mime).toBe('image/jxl');
    expect(meta.derivatives['jxl'].contentAddress).toMatch(/^sha256-/);
    expect(meta.derivatives['jxl'].maxEdge).toBe(4096);
    expect(meta.derivatives['iiif']).toBeDefined();
    expect(meta.derivatives['iiif'].mime).toBe('application/json');

    // The stored meta matches what we returned (persisted, not just in-memory).
    const stored = await repo.getMeta(meta.id);
    expect(stored).not.toBeNull();
    expect(stored!.contentAddress).toBe(meta.contentAddress);
  });

  it('content addressing is deterministic — identical bytes hash to the same address', async () => {
    const a = await media.uploadMaster({ mime: 'image/png', bytes: SAMPLE_BYTES, actorRef: ACTOR.ref, actorRole: ACTOR.role });
    const b = await media.uploadMaster({ mime: 'image/png', bytes: SAMPLE_BYTES, actorRef: ACTOR.ref, actorRole: ACTOR.role });
    expect(a.contentAddress).toBe(b.contentAddress);
    expect(a.id).not.toBe(b.id); // distinct media records, shared blob address
  });

  it('GET at verification resolution is free and NOT watermarked (no paywall)', async () => {
    const meta = await media.uploadMaster({ mime: 'image/jpeg', bytes: SAMPLE_BYTES, verificationMaxEdge: 4096, actorRef: ACTOR.ref, actorRole: ACTOR.role });

    const served = await media.serve(meta.id, 'verification');
    expect(served.free).toBe(true);
    expect(served.watermark).toBe(false);
    expect(served.tierNote).toBeUndefined();
    expect(served.address).toMatch(/^sha256-/);
    expect(served.maxEdge).toBe(4096);
  });

  it('absent res defaults to verification resolution — free, no watermark', async () => {
    const meta = await media.uploadMaster({ mime: 'image/jpeg', bytes: SAMPLE_BYTES, verificationMaxEdge: 4096, actorRef: ACTOR.ref, actorRole: ACTOR.role });
    const served = await media.serve(meta.id);
    expect(served.free).toBe(true);
    expect(served.watermark).toBe(false);
  });

  it('a res at or below verificationMaxEdge is the free verification path', async () => {
    const meta = await media.uploadMaster({ mime: 'image/jpeg', bytes: SAMPLE_BYTES, verificationMaxEdge: 4096, actorRef: ACTOR.ref, actorRole: ACTOR.role });
    const served = await media.serve(meta.id, '2048');
    expect(served.free).toBe(true);
    expect(served.watermark).toBe(false);
    expect(served.maxEdge).toBe(4096);
  });

  it('a higher-than-verification res is still served free in v1 (convenience tier deferred, never watermarked-as-paywall)', async () => {
    const meta = await media.uploadMaster({ mime: 'image/jpeg', bytes: SAMPLE_BYTES, verificationMaxEdge: 1024, actorRef: ACTOR.ref, actorRole: ACTOR.role });
    const served = await media.serve(meta.id, '8192');
    expect(served.free).toBe(true);
    expect(served.tierNote).toMatch(/convenience tier deferred/);
    expect(served.maxEdge).toBe(8192);
  });

  it('falls back to the configured freeVerificationMaxEdge when the media set none', async () => {
    const meta = await media.uploadMaster({ mime: 'image/jpeg', bytes: SAMPLE_BYTES, actorRef: ACTOR.ref, actorRole: ACTOR.role });
    const served = await media.serve(meta.id, 'verification');
    expect(served.free).toBe(true);
    expect(served.watermark).toBe(false);
    expect(served.maxEdge).toBe(8192); // config default (§ media.freeVerificationMaxEdge)
  });

  it('serving an unknown media id is a 404', async () => {
    await expect(media.serve('media:does-not-exist')).rejects.toThrow(/not found/);
  });
});
