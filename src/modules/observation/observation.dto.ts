import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** {system,id} pointer to the originating Casabio (or other) record — inherited as the source ref. */
export class ObservationSourceDto {
  @IsString()
  system!: string; // e.g. 'casabio'

  @IsString()
  id!: string; // e.g. 'casabio:obs:1'
}

export class CreateObservationDto {
  @IsString()
  taxonConcept!: string; // concept:…

  @IsNumber()
  lat!: number;

  @IsNumber()
  lon!: number;

  @IsIn(['normal', 'sensitive', 'highly-sensitive'])
  sensitivity!: 'normal' | 'sensitive' | 'highly-sensitive';

  @IsObject()
  @ValidateNested()
  @Type(() => ObservationSourceDto)
  source!: ObservationSourceDto;

  @IsOptional()
  @IsArray()
  media?: string[]; // media:…

  @IsOptional()
  @IsString()
  note?: string; // free-text field note (public — scanned for coordinate leakage by the locality split)

  @IsOptional()
  @IsString()
  attachKo?: string; // ko:… — link this observation's public projection to a treatment's distribution map
}

export class ObservationDecisionDto {
  @IsIn(['accept', 'reject'])
  decision!: 'accept' | 'reject';

  @IsOptional()
  @IsString()
  comment?: string; // mandatory non-empty on reject
}
