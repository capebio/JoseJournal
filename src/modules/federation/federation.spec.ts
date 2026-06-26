import { Test, TestingModule } from '@nestjs/testing';
import { FederationModule } from './federation.module';
import { FederationService } from './federation.service';

/**
 * Federation is self-contained (no persistence ports, no cross-module deps), so the
 * spec wires a minimal standalone DI context rather than the shared makeContext —
 * which intentionally only registers the persistence-backed modules. Deterministic:
 * resolvers are offline stubs, so there is no network and the only time dependency
 * is `new Date()` (asserted only as a parseable ISO string, never a fixed value).
 */
describe('§ Federation / read-only connectors OUT', () => {
  let mod: TestingModule;
  let federation: FederationService;

  beforeEach(async () => {
    mod = await Test.createTestingModule({ imports: [FederationModule] }).compile();
    await mod.init();
    federation = mod.get(FederationService);
  });
  afterEach(async () => mod.close());

  /** Helper: every resolver must return a source-tagged, ISO-stamped stub reference. */
  function expectStubShape(ref: { source: string; id: string; resolvedAt: string; stub: boolean; data: unknown }) {
    expect(typeof ref.source).toBe('string');
    expect(ref.source.length).toBeGreaterThan(0);
    expect(ref.stub).toBe(true);
    expect(ref.data).toBeDefined();
    // resolvedAt is a real, parseable ISO timestamp (provenance of when).
    expect(Number.isNaN(Date.parse(ref.resolvedAt))).toBe(false);
    expect(ref.resolvedAt).toBe(new Date(ref.resolvedAt).toISOString());
  }

  describe('resolveObservation (GBIF/iNaturalist/FishBase/Casabio)', () => {
    it('tags the reference with the requested source and qualifies the id', () => {
      const ref = federation.resolveObservation('gbif', '12345');
      expectStubShape(ref);
      expect(ref.source).toBe('gbif');
      expect(ref.id).toBe('gbif:12345');
      expect(ref.data).toMatchObject({ kind: 'observation', system: 'gbif', externalId: '12345' });
    });

    it('resolves each supported observation system with its own label', () => {
      for (const system of ['gbif', 'inaturalist', 'fishbase', 'casabio']) {
        const ref = federation.resolveObservation(system, 'x1');
        expectStubShape(ref);
        expect(ref.source).toBe(system);
      }
    });

    it('labels an unknown system explicitly rather than mislabelling it', () => {
      const ref = federation.resolveObservation('mystery', 'x1');
      expect(ref.source).toBe('unknown:mystery');
      expectStubShape(ref);
    });
  });

  describe('resolveSequence (GenBank/ENA/DDBJ)', () => {
    it('defaults to GenBank and source-tags the accession', () => {
      const ref = federation.resolveSequence('MN908947');
      expectStubShape(ref);
      expect(ref.source).toBe('genbank');
      expect(ref.id).toBe('genbank:MN908947');
      expect(ref.data).toMatchObject({ kind: 'sequence', archive: 'genbank', accession: 'MN908947' });
    });

    it('infers the archive from an authority prefix', () => {
      expect(federation.resolveSequence('ena:ERR000001').source).toBe('ena');
      expect(federation.resolveSequence('ddbj:AB000001').source).toBe('ddbj');
    });
  });

  describe('resolveTaxon (Catalogue of Life/EOL/Wikidata)', () => {
    it('source-tags the reference and carries a vernacular-names layer', () => {
      const ref = federation.resolveTaxon('Mesembryanthemum crystallinum');
      expectStubShape(ref);
      expect(ref.source).toBe('col');
      expect(ref.data).toMatchObject({ kind: 'taxon', backbone: 'col', vernacularNames: [] });
    });

    it('passes the scientific name through VERBATIM — the interlingua is never translated', () => {
      const name = 'Mesembryanthemum crystallinum';
      const ref = federation.resolveTaxon(name);
      // The scientific name is echoed back unchanged (untranslated, unnormalised).
      expect((ref.data as { scientificName: string }).scientificName).toBe(name);
    });
  });

  describe('resolvePerson (ORCID/Bionomia/IPNI/VIAF)', () => {
    it('source-tags an ORCID reference', () => {
      const ref = federation.resolvePerson('0000-0002-1825-0097');
      expectStubShape(ref);
      expect(ref.source).toBe('orcid');
      expect(ref.data).toMatchObject({ kind: 'person', authority: 'orcid', includesDeceased: false });
    });

    it('supports registries carrying deceased authors (Bionomia/IPNI/VIAF)', () => {
      for (const authority of ['bionomia', 'ipni', 'viaf']) {
        const ref = federation.resolvePerson(`${authority}:abc`);
        expectStubShape(ref);
        expect(ref.source).toBe(authority);
        expect((ref.data as { includesDeceased: boolean }).includesDeceased).toBe(true);
      }
    });
  });

  it('all four resolvers return source-tagged references (acceptance)', () => {
    const refs = [
      federation.resolveObservation('inaturalist', 'o1'),
      federation.resolveSequence('MN908947'),
      federation.resolveTaxon('Aloe ferox'),
      federation.resolvePerson('ipni:12345-1'),
    ];
    const sources = refs.map((r) => r.source);
    expect(sources).toEqual(['inaturalist', 'genbank', 'col', 'ipni']);
    for (const r of refs) expectStubShape(r);
  });
});
