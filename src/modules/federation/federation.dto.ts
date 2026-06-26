import { IsString } from 'class-validator';

/** GET /federation/observation?system=&id= */
export class ObservationQueryDto {
  @IsString()
  system!: string; // gbif | inaturalist | fishbase | casabio

  @IsString()
  id!: string;
}

/** GET /federation/sequence?accession= */
export class SequenceQueryDto {
  @IsString()
  accession!: string; // GenBank/ENA/DDBJ accession (INSDC)
}

/** GET /federation/taxon?name= — the scientific name is the interlingua (never translated). */
export class TaxonQueryDto {
  @IsString()
  name!: string;
}

/** GET /federation/person?ref= */
export class PersonQueryDto {
  @IsString()
  ref!: string; // ORCID/Bionomia/IPNI/VIAF reference
}
