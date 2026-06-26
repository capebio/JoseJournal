import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PORTS, type KnowledgeObjectRepo } from '@core/ports';
import type { KnowledgeObjectContent, ObservationPublic } from '@core/types';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { LocalityService } from '@modules/locality/locality.service';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import type { Actor } from '@modules/versioning/versioning.service';

export interface CreateObservationInput {
  taxonConcept: string; // concept:…
  lat: number;
  lon: number;
  sensitivity: 'normal' | 'sensitive' | 'highly-sensitive';
  source: { system: string; id: string };
  media?: string[];
  note?: string;
  /** ko:… — attach the public projection to a treatment so its distribution map shows this obs. */
  attachKo?: string;
  actor: Actor;
}

export interface DecisionInput {
  obsId: string; // obs:…
  decision: 'accept' | 'reject';
  comment?: string;
  actor: Actor;
}

/**
 * §3.7 / §7 micro-observations. A Casabio observation is elevated to a citable
 * knowledge object (koType 'micro-observation') that inherits its source id, then
 * split through the §6 locality engine so only a QDS-generalised public projection
 * is replicated and the precise coordinate stays server-mediated. Curators accept
 * (verify) or reject the public projection; precise lat/lon never touches it.
 */
@Injectable()
export class ObservationService {
  constructor(
    private readonly knowledgeObjects: KnowledgeObjectService,
    private readonly locality: LocalityService,
    private readonly provenance: ProvenanceService,
    @Inject(PORTS.KnowledgeObjectRepo) private readonly ko: KnowledgeObjectRepo,
  ) {}

  /**
   * (1) Mint a citable micro-observation KO (commons / public) whose subjectRef is
   * the inherited source record. (2) Split-and-store via LocalityService, which is
   * the sole writer of the QDS-only public projection + the restricted precise row.
   */
  async create(input: CreateObservationInput): Promise<{ koId: string; obsId: string; public: ObservationPublic }> {
    const sourceRef = `${input.source.system}:${input.source.id}`;
    const { entity } = await this.knowledgeObjects.createKo({
      koType: 'micro-observation',
      tier: 'commons',
      visibility: 'public',
      content: this.buildContent(input),
      subjectRefs: [sourceRef],
      actor: input.actor,
    });

    // The public projection's `ko` drives which distribution map it appears on:
    // attach to a treatment when asked, else to the obs's own micro-observation KO.
    const { obsId, public: pub } = await this.locality.splitAndStore({
      koId: input.attachKo ?? entity._id,
      taxonConcept: input.taxonConcept,
      lat: input.lat,
      lon: input.lon,
      sensitivity: input.sensitivity,
      source: input.source,
      media: input.media,
      publicCaptions: input.note ? [input.note] : undefined,
      actorRef: input.actor.ref,
    });

    return { koId: entity._id, obsId, public: pub };
  }

  /**
   * Curator decision on the public projection (§7). accept → verification 'verified';
   * reject → REQUIRES a non-empty comment and sets verification 'rejected'. Precise
   * coordinates are untouched (they live only in the restricted store).
   */
  async decide(input: DecisionInput): Promise<ObservationPublic> {
    if (input.decision === 'reject' && !input.comment?.trim()) {
      throw new BadRequestException('a non-empty comment is required to reject an observation');
    }
    const projectionId = `${input.obsId}:public`;
    const current = (await this.ko.getPublicProjection(projectionId)) as ObservationPublic | null;
    if (!current) throw new NotFoundException(`no public projection for ${input.obsId}`);

    const verification: ObservationPublic['verification'] = input.decision === 'accept' ? 'verified' : 'rejected';
    const updated: ObservationPublic = { ...current, verification };
    await this.ko.putPublicProjection(projectionId, updated as unknown as Record<string, unknown>);

    await this.provenance.record({
      subjectRef: input.obsId,
      actorRef: input.actor.ref,
      actorRole: input.actor.role,
      action: 'reviewed',
      detail: { decision: input.decision, verification, comment: input.comment ?? null },
    });

    return updated;
  }

  /** A minimal public content body for the citable micro-observation (no precise locality). */
  private buildContent(input: CreateObservationInput): KnowledgeObjectContent {
    const text = input.note?.trim()
      ? `Observation of ${input.taxonConcept}. ${input.note.trim()}`
      : `Observation of ${input.taxonConcept}.`;
    return {
      title: `Micro-observation: ${input.taxonConcept}`,
      sections: [
        {
          path: 'observation',
          blocks: [{ blockId: 'blk:obs-note', type: 'paragraph', text }],
        },
      ],
      claims: {},
    };
  }
}
