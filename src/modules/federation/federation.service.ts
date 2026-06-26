import { Injectable } from '@nestjs/common';

/**
 * Federation — READ-ONLY, standards-based connectors OUT to external biodiversity
 * and identity authorities (§ interoperability). These are *read connectors*: JOSE
 * resolves a reference held elsewhere; it never writes back to the upstream system.
 *
 * THE SCIENTIFIC NAME IS THE INTERLINGUA. A resolved taxon's scientific name is the
 * stable join key across every connector and MUST NOT be translated, localised, or
 * normalised away — vernacular/common names are an additive layer hung off the
 * scientific name, never a replacement for it.
 *
 * v1 POSTURE — OFFLINE-SAFE STUBS. Every resolver below returns a *structured
 * federated reference* synthesised locally from its inputs. NO network I/O occurs,
 * so CI is deterministic and needs no live upstream. Real HTTP fan-out (rate-limited,
 * cached, retried) lives behind a future flag (`federation.live`, default off) and is
 * NOT wired in v1. When that flag flips, only the private `fetch*` bodies change; the
 * returned shape (`FederatedReference`) is the stable contract callers code against.
 */

/** The stable shape every resolver returns. `data` is the connector-specific payload. */
export interface FederatedReference<TData = Record<string, unknown>> {
  /** The labelled upstream authority this reference came from, e.g. 'gbif', 'orcid'. */
  source: string;
  /** The upstream identifier as resolved (system-qualified where a system was given). */
  id: string;
  /** ISO timestamp of resolution — provenance of *when* this projection was made. */
  resolvedAt: string;
  /** Whether this is a v1 offline stub (true) or a live upstream fetch (false). */
  stub: boolean;
  /** Connector-specific projection. In v1 this is an echo-shaped stub payload. */
  data: TData;
}

/** Supported observation/occurrence authorities. */
export type ObservationSystem = 'gbif' | 'inaturalist' | 'fishbase' | 'casabio';
/** Supported sequence-accession authorities (INSDC mirror set). */
export type SequenceArchive = 'genbank' | 'ena' | 'ddbj';
/** Supported taxon-name / vernacular authorities. */
export type TaxonAuthority = 'col' | 'eol' | 'wikidata';
/** Supported person/agent authorities (incl. registries that carry deceased authors). */
export type PersonAuthority = 'orcid' | 'bionomia' | 'ipni' | 'viaf';

/** Map of each observation system to its labelled source + canonical landing URL builder. */
const OBSERVATION_SOURCES: Record<ObservationSystem, { source: string; landing: (id: string) => string }> = {
  gbif: { source: 'gbif', landing: (id) => `https://www.gbif.org/occurrence/${id}` },
  inaturalist: { source: 'inaturalist', landing: (id) => `https://www.inaturalist.org/observations/${id}` },
  fishbase: { source: 'fishbase', landing: (id) => `https://www.fishbase.se/summary/${id}.html` },
  casabio: { source: 'casabio', landing: (id) => `https://casabio.org/observations/${id}` },
};

const SEQUENCE_SOURCES: Record<SequenceArchive, { source: string; landing: (acc: string) => string }> = {
  genbank: { source: 'genbank', landing: (acc) => `https://www.ncbi.nlm.nih.gov/nuccore/${acc}` },
  ena: { source: 'ena', landing: (acc) => `https://www.ebi.ac.uk/ena/browser/view/${acc}` },
  ddbj: { source: 'ddbj', landing: (acc) => `https://getentry.ddbj.nig.ac.jp/getentry/na/${acc}` },
};

const TAXON_SOURCES: Record<TaxonAuthority, { source: string }> = {
  col: { source: 'col' }, // Catalogue of Life
  eol: { source: 'eol' }, // Encyclopedia of Life
  wikidata: { source: 'wikidata' },
};

const PERSON_SOURCES: Record<PersonAuthority, { source: string }> = {
  orcid: { source: 'orcid' },
  bionomia: { source: 'bionomia' }, // attribution incl. deceased collectors/authors
  ipni: { source: 'ipni' }, // International Plant Names Index (botanist abbreviations)
  viaf: { source: 'viaf' }, // Virtual International Authority File
};

/** Normalise an arbitrary system label to a known key, defaulting unknowns to 'unknown'. */
function normaliseKey<T extends string>(value: string, known: readonly T[]): T | 'unknown' {
  const lowered = value.trim().toLowerCase();
  return (known as readonly string[]).includes(lowered) ? (lowered as T) : 'unknown';
}

@Injectable()
export class FederationService {
  /**
   * Resolve an external occurrence/observation reference (GBIF / iNaturalist /
   * FishBase / Casabio). v1 returns an offline stub tagged with the source.
   */
  resolveObservation(system: string, id: string): FederatedReference {
    const key = normaliseKey<ObservationSystem>(system, ['gbif', 'inaturalist', 'fishbase', 'casabio']);
    const meta = key === 'unknown' ? undefined : OBSERVATION_SOURCES[key];
    const source = meta?.source ?? `unknown:${system.trim().toLowerCase()}`;
    return {
      source,
      id: `${source}:${id}`,
      resolvedAt: new Date().toISOString(),
      stub: true,
      data: {
        kind: 'observation',
        system: source,
        externalId: id,
        landingPage: meta?.landing(id) ?? null,
        note: 'offline stub — live occurrence fetch is behind federation.live (off in v1)',
      },
    };
  }

  /**
   * Resolve a nucleotide/protein sequence accession (GenBank / ENA / DDBJ — the
   * INSDC mirror set). The archive is inferred from the accession's authority
   * prefix where present, else defaults to GenBank. v1 returns an offline stub.
   */
  resolveSequence(accession: string): FederatedReference {
    const acc = accession.trim();
    const archive = this.inferArchive(acc);
    const meta = SEQUENCE_SOURCES[archive];
    return {
      source: meta.source,
      id: `${meta.source}:${acc}`,
      resolvedAt: new Date().toISOString(),
      stub: true,
      data: {
        kind: 'sequence',
        archive: meta.source,
        accession: acc,
        landingPage: meta.landing(acc),
        note: 'offline stub — live INSDC fetch is behind federation.live (off in v1)',
      },
    };
  }

  /**
   * Resolve a taxon by scientific name (Catalogue of Life / EOL / Wikidata),
   * surfacing the *vernacular names* layer. The scientific name is the interlingua
   * and is echoed back VERBATIM — never translated — with any common names attached
   * as an additive layer. v1 returns an offline stub with an empty vernacular layer.
   */
  resolveTaxon(name: string): FederatedReference {
    const scientificName = name.trim(); // interlingua: passed through untranslated
    const authority: TaxonAuthority = 'col'; // CoL is the v1 default name backbone
    return {
      source: TAXON_SOURCES[authority].source,
      id: `${TAXON_SOURCES[authority].source}:${encodeURIComponent(scientificName)}`,
      resolvedAt: new Date().toISOString(),
      stub: true,
      data: {
        kind: 'taxon',
        backbone: TAXON_SOURCES[authority].source,
        // The scientific name is the join key across all connectors — DO NOT translate it.
        scientificName,
        // Vernacular/common names hang off the scientific name as an additive layer.
        vernacularNames: [] as { language: string; name: string; source: string }[],
        crossRefs: { eol: null, wikidata: null },
        note: 'offline stub — live name-backbone fetch is behind federation.live (off in v1)',
      },
    };
  }

  /**
   * Resolve a person/agent reference (ORCID / Bionomia / IPNI / VIAF). Authorities
   * that carry *deceased* authors and historical collectors (Bionomia, IPNI, VIAF)
   * are first-class here — federation is not limited to the living, ORCID-holding
   * cohort. v1 returns an offline stub tagged with the inferred authority.
   */
  resolvePerson(ref: string): FederatedReference {
    const value = ref.trim();
    const authority = this.inferPersonAuthority(value);
    return {
      source: PERSON_SOURCES[authority].source,
      id: `${PERSON_SOURCES[authority].source}:${value}`,
      resolvedAt: new Date().toISOString(),
      stub: true,
      data: {
        kind: 'person',
        authority: PERSON_SOURCES[authority].source,
        externalId: value,
        // Bionomia/IPNI/VIAF intentionally include deceased authors & historical collectors.
        includesDeceased: authority !== 'orcid',
        note: 'offline stub — live agent-registry fetch is behind federation.live (off in v1)',
      },
    };
  }

  /** Infer the sequence archive from an accession's authority prefix (best-effort). */
  private inferArchive(accession: string): SequenceArchive {
    const lower = accession.toLowerCase();
    if (lower.startsWith('ena:')) return 'ena';
    if (lower.startsWith('ddbj:')) return 'ddbj';
    if (lower.startsWith('genbank:') || lower.startsWith('ncbi:')) return 'genbank';
    // DDBJ accessions commonly begin with 'AB'/'LC'; ENA with 'ERR'/'ERS'; default GenBank.
    if (/^(err|ers|erp|era)/i.test(accession)) return 'ena';
    if (/^(ab|lc|dr)/i.test(accession)) return 'ddbj';
    return 'genbank';
  }

  /** Infer the person authority from a reference's shape/prefix (best-effort). */
  private inferPersonAuthority(ref: string): PersonAuthority {
    const lower = ref.toLowerCase();
    if (lower.startsWith('orcid:') || /^\d{4}-\d{4}-\d{4}-\d{3}[\dx]$/i.test(ref)) return 'orcid';
    if (lower.startsWith('bionomia:')) return 'bionomia';
    if (lower.startsWith('ipni:')) return 'ipni';
    if (lower.startsWith('viaf:')) return 'viaf';
    return 'orcid';
  }
}
