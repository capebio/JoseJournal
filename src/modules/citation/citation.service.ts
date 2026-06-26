import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PORTS, type CitationRepo, type ReleaseRepo } from '@core/ports';
import type { ActorRole, ContentBlock, SnippetAnchor, VersionDoc } from '@core/types';
import { mintId } from '@core/ids';
import { canonicalize } from '@core/canonical';
import { sha256Address } from '@core/hash';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';

export type CiteMode = 'entity' | 'version' | 'doi';

export interface CiteResult {
  koId: string;
  mode: CiteMode;
  /** §3.9 human-legible cite date (YYYY-MM-DD) of the chosen version. */
  asOf: string;
  authors: string[];
  title: string;
  /** Present for mode='entity' — navigation only, follows the moving tip. */
  entityUrl?: string;
  /** Present for mode='version' and as a DOI fallback — pinned, immutable. */
  versionUrl?: string;
  /** Present for mode='doi' when a VoR DOI exists. */
  doi?: string;
  /** Set when a doi was requested but the KO has no VoR (fell back to version). */
  note?: string;
}

export interface SnippetResolution {
  drift: boolean;
  snippet: SnippetAnchor;
  /** Present when drift=false — the block exactly matches the cited state. */
  block?: ContentBlock;
  /** Present when drift=true — the verbatim text as cited. */
  citedText?: string;
  /** Present when drift=true — the block as it now stands in that version. */
  currentBlock?: ContentBlock;
  note?: string;
}

/**
 * §3.9 / §7 Citation — the three-identifier model plus hardened snippet
 * anchoring.
 *
 * Three identifiers, never conflated:
 *   • entity URL  — navigation only; resolves to "whatever the tip is now".
 *   • version URL — an immutable, content-addressed ver id; the citable unit.
 *   • DOI         — the registered VoR identifier (PIDs for the journal record).
 *
 * A snippet anchor ALWAYS pins an immutable versionId + blockId and stores the
 * block's content hash at cite time. Because versions are content-addressed and
 * never mutated, the original version's block never changes — so a snippet on it
 * resolves drift=false forever. Drift only ever surfaces when a DIFFERENT version
 * carries an amended block under the same blockId: resolving the snippet against
 * that version detects the mismatch and offers BOTH states (§9.4). The response
 * is never a redirect — it returns the exact pinned identifier/state.
 */
@Injectable()
export class CitationService {
  constructor(
    @Inject(PORTS.CitationRepo) private readonly citations: CitationRepo,
    @Inject(PORTS.ReleaseRepo) private readonly releases: ReleaseRepo,
    private readonly knowledgeObjects: KnowledgeObjectService,
    private readonly provenance: ProvenanceService,
  ) {}

  /** sha256-… of the canonical (RFC 8785) serialisation of a block. */
  static blockHash(block: ContentBlock): string {
    return sha256Address(canonicalize(block));
  }

  private static findBlock(version: VersionDoc, sectionPath: string, blockId: string): ContentBlock | null {
    const section = version.content.sections.find((s) => s.path === sectionPath);
    if (!section) return null;
    return section.blocks.find((b) => b.blockId === blockId) ?? null;
  }

  /** Find a block by blockId anywhere in the version (used at resolve time). */
  private static findBlockAnywhere(version: VersionDoc, blockId: string): ContentBlock | null {
    for (const section of version.content.sections) {
      const block = section.blocks.find((b) => b.blockId === blockId);
      if (block) return block;
    }
    return null;
  }

  /**
   * §7 GET /cite/:koId?as=entity|version|doi. Returns citation metadata pinned to
   * the requested identifier. Never a redirect: the exact identifier/state is
   * returned. asOf + authors + title come from the chosen version.
   */
  async cite(koId: string, mode: CiteMode = 'version'): Promise<CiteResult> {
    const entity = await this.knowledgeObjects.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);

    if (mode === 'entity') {
      // The entity URL is navigation only and follows the moving tip; metadata
      // is read off the current tip so the caller still sees authors/title/asOf.
      const tip = await this.loadVersion(entity.refs.tip, koId);
      return {
        koId,
        mode,
        entityUrl: `/ko/${koId}`,
        asOf: this.asOf(tip),
        authors: tip.authors,
        title: tip.content.title,
      };
    }

    if (mode === 'version') {
      const tipId = entity.refs.tip;
      const tip = await this.loadVersion(tipId, koId);
      return {
        koId,
        mode,
        versionUrl: `/ko/${koId}/v/${tipId}`,
        asOf: this.asOf(tip),
        authors: tip.authors,
        title: tip.content.title,
      };
    }

    // mode === 'doi': resolve the KO's VoR DOI; fall back to a version URL when
    // there is no VoR yet (with an explicit note, never a silent redirect).
    if (entity.refs.vor) {
      const vor = await this.loadVersion(entity.refs.vor, koId);
      const doiEntry = await this.releases.getDoiForVersion(entity.refs.vor);
      const doi = doiEntry?.doi ?? vor.doi;
      if (doi) {
        return {
          koId,
          mode,
          doi,
          versionUrl: `/ko/${koId}/v/${entity.refs.vor}`,
          asOf: this.asOf(vor),
          authors: vor.authors,
          title: vor.content.title,
        };
      }
    }
    // No VoR (or no DOI registered) — fall back to the immutable tip version.
    const tip = await this.loadVersion(entity.refs.tip, koId);
    return {
      koId,
      mode,
      versionUrl: `/ko/${koId}/v/${entity.refs.tip}`,
      asOf: this.asOf(tip),
      authors: tip.authors,
      title: tip.content.title,
      note: 'no Version of Record exists yet — citing the current immutable version instead of a DOI',
    };
  }

  /**
   * §7 POST /snippets. Locate the block in the IMMUTABLE version, store a
   * SnippetAnchor with the block's content hash and verbatim quoted text. The
   * anchor pins a versionId, never an entity (§3.9). Restricted blocks are never
   * quotable (§6 leakage checklist).
   */
  async createSnippet(input: {
    versionId: string;
    sectionPath: string;
    blockId: string;
    quotedText?: string;
    actorRef: string;
    actorRole: ActorRole;
  }): Promise<SnippetAnchor> {
    const version = await this.knowledgeObjects.getVersion(input.versionId);
    if (!version) throw new NotFoundException(`unknown version ${input.versionId}`);
    const block = CitationService.findBlock(version, input.sectionPath, input.blockId);
    if (!block) {
      throw new NotFoundException(`block ${input.blockId} not found at ${input.sectionPath} in ${input.versionId}`);
    }
    if (block.restricted) {
      throw new BadRequestException('restricted blocks (precise locality) are not quotable (§6)');
    }
    const snippet: SnippetAnchor = {
      id: mintId('snippet'),
      versionId: input.versionId,
      sectionPath: input.sectionPath,
      blockId: input.blockId,
      quotedText: input.quotedText ?? block.text ?? '',
      contentHash: CitationService.blockHash(block),
    };
    const stored = await this.citations.createSnippet(snippet);
    await this.provenance.record({
      subjectRef: input.versionId,
      actorRef: input.actorRef,
      actorRole: input.actorRole,
      action: 'cited',
      detail: { snippet: stored.id, blockId: input.blockId, sectionPath: input.sectionPath },
    });
    return stored;
  }

  /**
   * §7 GET /snippets/:id. The snippet always pins an immutable version, so the
   * cited state is intact forever (never a redirect). Drift is measured against
   * the KO's CURRENT LIVE TIP (§3.9/§9.4: "amended in a later version"): we find
   * the same blockId in the tip and recompute its hash.
   *  - tip block hash == cited hash -> drift:false (the text still stands).
   *  - tip block differs            -> drift:true, offering BOTH the cited text
   *    and the current block.
   *  - tip block gone               -> drift:true, cited block removed downstream.
   */
  async resolveSnippet(id: string): Promise<SnippetResolution> {
    const snippet = await this.citations.getSnippet(id);
    if (!snippet) throw new NotFoundException(`unknown snippet ${id}`);
    const pinned = await this.knowledgeObjects.getVersion(snippet.versionId);
    if (!pinned) throw new NotFoundException(`unknown version ${snippet.versionId}`);

    const citedBlock =
      CitationService.findBlock(pinned, snippet.sectionPath, snippet.blockId) ??
      CitationService.findBlockAnywhere(pinned, snippet.blockId) ??
      undefined;

    // The live tip of the same KO is where a later amendment would appear.
    const entity = await this.knowledgeObjects.getEntity(pinned.ko);
    const tip = entity?.refs.tip ? await this.knowledgeObjects.getVersion(entity.refs.tip) : null;
    const liveBlock = tip
      ? CitationService.findBlock(tip, snippet.sectionPath, snippet.blockId) ?? CitationService.findBlockAnywhere(tip, snippet.blockId)
      : citedBlock ?? null;

    if (!liveBlock) {
      return {
        drift: true,
        snippet,
        citedText: snippet.quotedText,
        block: citedBlock,
        note: 'the cited block is no longer present in the current version',
      };
    }

    if (CitationService.blockHash(liveBlock) === snippet.contentHash) {
      return { drift: false, snippet, block: liveBlock };
    }
    return {
      drift: true,
      snippet,
      citedText: snippet.quotedText,
      currentBlock: liveBlock,
      note: 'the cited text was amended in a later version',
    };
  }

  private async loadVersion(versionId: string, koId: string): Promise<VersionDoc> {
    const version = versionId ? await this.knowledgeObjects.getVersion(versionId) : null;
    if (!version) throw new NotFoundException(`no citable version for KO ${koId}`);
    return version;
  }

  /** YYYY-MM-DD as-of date for the chosen version (versions store this directly). */
  private asOf(version: VersionDoc): string {
    return version.createdAt.slice(0, 10);
  }
}
