import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AiCoverage } from '@core/types';

/**
 * §7 POST /ko/:koId/ai-declaration body. `coverage` is the spine of the honesty
 * model: 'recorded' = on-platform instrumentation, 'attested' = human attestation,
 * 'estimated' = best-guess. `percentage` is only meaningful for 'recorded' and is
 * forced to null otherwise by the service (§9.8).
 */
export class AiDeclarationDto {
  @IsIn(['recorded', 'attested', 'estimated'])
  coverage!: AiCoverage;

  @IsString()
  role!: string; // e.g. "drafting", "translation", "none"

  @IsOptional()
  @IsString()
  model?: string; // model/version

  @IsOptional()
  @IsString()
  accountableHuman?: string; // acct:… (defaults to the caller)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number; // only honoured when coverage === 'recorded'
}
