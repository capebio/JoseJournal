import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

/** §7 POST /names — register a nomenclatural Name (the string, never a circumscription). */
export class CreateNameDto {
  @IsString()
  nameString!: string;

  @IsOptional()
  @IsString()
  authorship?: string;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsOptional()
  @IsIn(['ICN', 'ICZN', 'ICNP', 'other'])
  code?: 'ICN' | 'ICZN' | 'ICNP' | 'other';

  @IsOptional()
  @IsString()
  nomStatus?: string;

  @IsOptional()
  @IsObject()
  registration?: Record<string, string>; // {zoobank|ipni: id}
}

/**
 * §7 POST /concepts — assert a TaxonConcept ("Name sec. Treatment"). secVersion is
 * the ver:… of the asserting treatment; two treatments may assert competing
 * concepts on one name and both coexist (§9.7).
 */
export class CreateConceptDto {
  @IsString()
  nameId!: string; // name:…

  @IsString()
  secVersion!: string; // ver:… of the asserting Treatment ("sec.")

  @IsOptional()
  @IsObject()
  circumscription?: Record<string, unknown>;
}

/** §7 POST /assertions — bind a subject (observation/specimen/version) to a concept. */
export class CreateAssertionDto {
  @IsString()
  conceptId!: string; // concept:…

  @IsString()
  subjectRef!: string; // obs:… | specimen:… | ver:…

  @IsOptional()
  @IsString({ each: true })
  evidenceRefs?: string[];

  @IsOptional()
  @IsString()
  assertedBy?: string; // acct:… | idrec:… — defaults to the caller
}

/** §7 POST /names/:id/acts — record a nomenclatural act on a name. */
export class CreateActDto {
  @IsString()
  actType!: string; // new_combination|synonymy|lectotypification|…

  @IsString()
  code!: string; // ICN|ICZN|ICNP|other

  @IsOptional()
  @IsString()
  governingDecision?: string;

  @IsOptional()
  @IsString()
  vorVersion?: string; // ver:… the valid protologue
}
