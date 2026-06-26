import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MinAssurance, Public } from '@common/decorators';
import type { Principal } from '@core/types';
import { TaxonomyService, type Actor } from './taxonomy.service';
import { CreateActDto, CreateAssertionDto, CreateConceptDto, CreateNameDto } from './taxonomy.dto';

/** Build the provenance actor from the resolved principal (role = first role, §15). */
function actorOf(user: Principal): Actor {
  return { ref: user.accountId, role: user.roles[0] ?? 'author' };
}

@ApiTags('taxonomy')
@Controller()
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  /** §7 POST /names — register a nomenclatural name. */
  @MinAssurance('verified')
  @Post('names')
  async createName(@Body() dto: CreateNameDto, @CurrentUser() user: Principal) {
    return this.taxonomy.createName({
      nameString: dto.nameString,
      authorship: dto.authorship,
      rank: dto.rank,
      code: dto.code,
      nomStatus: dto.nomStatus,
      registration: dto.registration,
      actor: actorOf(user),
    });
  }

  /** §7 POST /names/:id/acts — record a nomenclatural act on a name. */
  @MinAssurance('verified')
  @Post('names/:id/acts')
  async createAct(@Param('id') id: string, @Body() dto: CreateActDto, @CurrentUser() user: Principal) {
    return this.taxonomy.createAct({
      nameId: id,
      actType: dto.actType,
      code: dto.code,
      governingDecision: dto.governingDecision,
      vorVersion: dto.vorVersion,
      actor: actorOf(user),
    });
  }

  /** §7 POST /concepts — assert a TaxonConcept (Name sec. Treatment). */
  @MinAssurance('verified')
  @Post('concepts')
  async createConcept(@Body() dto: CreateConceptDto, @CurrentUser() user: Principal) {
    return this.taxonomy.createConcept({
      nameId: dto.nameId,
      secVersion: dto.secVersion,
      circumscription: dto.circumscription,
      actor: actorOf(user),
    });
  }

  /** §7 POST /assertions — bind a subject to a concept. */
  @MinAssurance('verified')
  @Post('assertions')
  async createAssertion(@Body() dto: CreateAssertionDto, @CurrentUser() user: Principal) {
    return this.taxonomy.createAssertion({
      conceptId: dto.conceptId,
      subjectRef: dto.subjectRef,
      evidenceRefs: dto.evidenceRefs,
      assertedBy: dto.assertedBy,
      actor: actorOf(user),
    });
  }

  /** §7 GET /concepts/:id — the concept incl. its asserting sec treatment version. */
  @Public()
  @Get('concepts/:id')
  async getConcept(@Param('id') id: string) {
    return this.taxonomy.getConcept(id);
  }

  /** §7 GET /names/:id/concepts — ALL competing concepts on that name (§9.7). */
  @Public()
  @Get('names/:id/concepts')
  async listConceptsForName(@Param('id') id: string) {
    return this.taxonomy.listConceptsForName(id);
  }
}
