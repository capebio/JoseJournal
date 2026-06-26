import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * §7 POST /identity/records — the few stable external ids we cross-reference an
 * IdentityRecord against. All optional; the bag is stored verbatim. Field names
 * mirror §3.6 (ipni, botanistAbbrev, bionomia, viaf, isni, wikidata) but the
 * shape stays open so new authorities can be added without a schema change.
 */
export class ExternalIdsDto {
  @IsOptional()
  @IsString()
  ipni?: string;

  @IsOptional()
  @IsString()
  botanistAbbrev?: string;

  @IsOptional()
  @IsString()
  bionomia?: string;

  @IsOptional()
  @IsString()
  viaf?: string;

  @IsOptional()
  @IsString()
  isni?: string;

  @IsOptional()
  @IsString()
  wikidata?: string;
}

export class CreateIdentityRecordDto {
  @IsString()
  displayName!: string;

  @IsOptional()
  @IsObject()
  externalIds?: ExternalIdsDto;
}
