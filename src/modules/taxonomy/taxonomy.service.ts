import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PORTS, type TaxonomyRepo } from '@core/ports';
import type { Assertion, NomName, NomenclaturalAct, TaxonConcept } from '@core/types';
import { mintId } from '@core/ids';
import { ProvenanceService } from '@modules/provenance/provenance.service';

export interface Actor {
  ref: string; // acct:… | idrec:…
  role: 'author' | 'contributor' | 'reviewer' | 'steward' | 'editor' | 'ai' | 'system';
}

export interface CreateNameInput {
  nameString: string;
  authorship?: string | null;
  rank?: string | null;
  code?: 'ICN' | 'ICZN' | 'ICNP' | 'other' | null;
  nomStatus?: string | null;
  registration?: Record<string, string> | null;
  actor: Actor;
}

export interface CreateConceptInput {
  nameId: string; // name:…
  secVersion: string; // ver:… of the asserting Treatment
  circumscription?: Record<string, unknown> | null;
  actor: Actor;
}

export interface CreateAssertionInput {
  conceptId: string; // concept:…
  subjectRef: string; // obs:… | specimen:… | ver:…
  evidenceRefs?: string[];
  assertedBy?: string; // defaults to actor.ref
  actor: Actor;
}

export interface CreateActInput {
  nameId: string; // name:…
  actType: string;
  code: string;
  governingDecision?: string | null;
  vorVersion?: string | null; // ver:…
  actor: Actor;
}

/**
 * §3.5 TDWG concept model. The cardinal rule is Name ≠ Taxon: a {@link NomName}
 * is just a governed string, while a {@link TaxonConcept} is "that name *sec.* a
 * particular treatment version". Many treatments can assert competing concepts on
 * one name and they MUST coexist — none overwrites another (§9.7). Every concept
 * stays resolvable to its own asserting `secVersion`, which is what makes
 * taxonomic disagreement first-class rather than a last-writer-wins collision.
 */
@Injectable()
export class TaxonomyService {
  constructor(
    @Inject(PORTS.TaxonomyRepo) private readonly repo: TaxonomyRepo,
    private readonly provenance: ProvenanceService,
  ) {}

  /** Register a nomenclatural name (§7 POST /names). */
  async createName(input: CreateNameInput): Promise<NomName> {
    const name: NomName = {
      id: mintId('name'),
      nameString: input.nameString,
      authorship: input.authorship ?? null,
      rank: input.rank ?? null,
      code: input.code ?? null,
      nomStatus: input.nomStatus ?? null,
      registration: input.registration ?? null,
    };
    const created = await this.repo.createName(name);
    await this.provenance.record({
      subjectRef: created.id,
      actorRef: input.actor.ref,
      actorRole: input.actor.role,
      action: 'created',
      detail: { kind: 'nom_name', nameString: created.nameString, code: created.code },
    });
    return created;
  }

  /**
   * Assert a TaxonConcept ("Name sec. Treatment"). The asserting `secVersion`
   * is stored on the row, so two treatments asserting different concepts on the
   * same name produce two coexisting rows, each resolvable to its own treatment.
   */
  async createConcept(input: CreateConceptInput): Promise<TaxonConcept> {
    if (!(await this.repo.getName(input.nameId))) {
      throw new NotFoundException(`no such name ${input.nameId}`);
    }
    const concept: TaxonConcept = {
      id: mintId('concept'),
      nameId: input.nameId,
      secVersion: input.secVersion,
      circumscription: input.circumscription ?? null,
      createdAt: new Date().toISOString(),
    };
    const created = await this.repo.createConcept(concept);
    await this.provenance.record({
      subjectRef: created.id,
      actorRef: input.actor.ref,
      actorRole: input.actor.role,
      action: 'created',
      detail: { kind: 'taxon_concept', nameId: created.nameId, secVersion: created.secVersion },
    });
    return created;
  }

  /** Bind a subject (observation/specimen/version) to a concept (§7 POST /assertions). */
  async createAssertion(input: CreateAssertionInput): Promise<Assertion> {
    if (!(await this.repo.getConcept(input.conceptId))) {
      throw new NotFoundException(`no such concept ${input.conceptId}`);
    }
    const assertion: Assertion = {
      id: mintId('assert'),
      conceptId: input.conceptId,
      subjectRef: input.subjectRef,
      evidenceRefs: input.evidenceRefs ?? [],
      assertedBy: input.assertedBy ?? input.actor.ref,
      ts: new Date().toISOString(),
    };
    const created = await this.repo.createAssertion(assertion);
    await this.provenance.record({
      subjectRef: created.id,
      actorRef: input.actor.ref,
      actorRole: input.actor.role,
      action: 'created',
      detail: { kind: 'assertion', conceptId: created.conceptId, subjectRef: created.subjectRef },
    });
    return created;
  }

  /** Record a nomenclatural act on a name (§7 POST /names/:id/acts). */
  async createAct(input: CreateActInput): Promise<NomenclaturalAct> {
    if (!(await this.repo.getName(input.nameId))) {
      throw new NotFoundException(`no such name ${input.nameId}`);
    }
    const act: NomenclaturalAct = {
      id: mintId('act'),
      nameId: input.nameId,
      actType: input.actType,
      code: input.code,
      governingDecision: input.governingDecision ?? null,
      vorVersion: input.vorVersion ?? null,
      ts: new Date().toISOString(),
    };
    const created = await this.repo.createAct(act);
    await this.provenance.record({
      subjectRef: created.id,
      actorRef: input.actor.ref,
      actorRole: input.actor.role,
      action: 'created',
      detail: { kind: 'nomenclatural_act', nameId: created.nameId, actType: created.actType, code: created.code },
    });
    return created;
  }

  /** §7 GET /concepts/:id — the concept incl. its asserting sec treatment version. */
  async getConcept(id: string): Promise<TaxonConcept> {
    const concept = await this.repo.getConcept(id);
    if (!concept) throw new NotFoundException(`no such concept ${id}`);
    return concept;
  }

  /**
   * §7 GET /names/:id/concepts — ALL competing concepts on one name. They coexist
   * (§9.7); the array preserves every treatment's view rather than collapsing them.
   */
  listConceptsForName(nameId: string): Promise<TaxonConcept[]> {
    return this.repo.listConceptsForName(nameId);
  }
}
