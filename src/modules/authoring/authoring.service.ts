import { Inject, Injectable } from '@nestjs/common';
import { PORTS, type AiDeclarationRepo } from '@core/ports';
import type { AiCoverage, AiDeclaration } from '@core/types';
import { ProvenanceService } from '@modules/provenance/provenance.service';

export interface DeclareAiInput {
  koId: string;
  coverage: AiCoverage;
  role: string;
  model?: string | null;
  accountableHuman?: string | null;
  percentage?: number | null;
  /** The caller — used as the accountable human when none is supplied. */
  actorRef: string;
}

/**
 * §13 / §7 authoring — AI provenance declaration. Three honesty tiers:
 *   - 'recorded'  : on-platform instrumentation; authoritative; a percentage may be stored.
 *   - 'attested'  : a human attests to AI involvement; no instrumented percentage.
 *   - 'estimated' : best-guess, explicitly inferred (never forensic).
 * The percentage is the dividing line: it is ONLY admissible under 'recorded',
 * because only instrumentation can substantiate it (§9.8). Every declaration is
 * also written to the provenance ledger as an AI authorship event.
 */
@Injectable()
export class AuthoringService {
  constructor(
    @Inject(PORTS.AiDeclarationRepo) private readonly repo: AiDeclarationRepo,
    private readonly provenance: ProvenanceService,
  ) {}

  /**
   * Store (or overwrite) the AI declaration for a KO. `percentage` is forced to
   * null unless `coverage === 'recorded'`, so an unsubstantiated number can never
   * be persisted. Provenance is recorded as 'ai-generated' (drafting) or
   * 'ai-edited' (any other role) with actorRole 'ai'.
   */
  async declare(input: DeclareAiInput): Promise<AiDeclaration> {
    // ENFORCE §9.8: a percentage is only admissible under instrumented 'recorded'.
    const percentage = input.coverage === 'recorded' ? input.percentage ?? null : null;
    const accountableHuman = input.accountableHuman ?? input.actorRef;

    const declaration: AiDeclaration = {
      koId: input.koId,
      coverage: input.coverage,
      role: input.role,
      model: input.model ?? null,
      accountableHuman,
      percentage,
      recordedAt: new Date().toISOString(),
    };
    const stored = await this.repo.put(declaration);

    // 'drafting' produces new content (ai-generated); anything else edits (ai-edited).
    const action = input.role === 'drafting' ? 'ai-generated' : 'ai-edited';
    await this.provenance.record({
      subjectRef: input.koId,
      actorRef: input.model ? `ai:${input.model}` : input.actorRef,
      actorRole: 'ai',
      action,
      detail: { coverage: input.coverage, role: input.role, model: stored.model, accountableHuman, percentage },
    });
    return stored;
  }

  /** §7 GET — the stored declaration, or null if none was ever made. */
  getForKo(koId: string): Promise<AiDeclaration | null> {
    return this.repo.getForKo(koId);
  }
}
