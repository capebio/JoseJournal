import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators';
import { FederationService } from './federation.service';
import { ObservationQueryDto, PersonQueryDto, SequenceQueryDto, TaxonQueryDto } from './federation.dto';

/**
 * Federation — READ-ONLY connectors OUT. Every route is a public read that returns
 * a source-tagged federated reference (provenance of which upstream authority it came
 * from). v1 resolvers are offline-safe stubs; real HTTP is behind a future flag.
 *
 * The scientific name is the interlingua across these connectors and is NEVER
 * translated — vernacular names are an additive layer only (see resolveTaxon).
 */
@ApiTags('federation')
@Controller('federation')
export class FederationController {
  constructor(private readonly federation: FederationService) {}

  /** GET /federation/observation?system=&id= — GBIF/iNaturalist/FishBase/Casabio. */
  @Public()
  @Get('observation')
  observation(@Query() q: ObservationQueryDto) {
    return this.federation.resolveObservation(q.system, q.id);
  }

  /** GET /federation/sequence?accession= — GenBank/ENA/DDBJ (INSDC). */
  @Public()
  @Get('sequence')
  sequence(@Query() q: SequenceQueryDto) {
    return this.federation.resolveSequence(q.accession);
  }

  /** GET /federation/taxon?name= — Catalogue of Life/EOL/Wikidata vernacular layer. */
  @Public()
  @Get('taxon')
  taxon(@Query() q: TaxonQueryDto) {
    return this.federation.resolveTaxon(q.name);
  }

  /** GET /federation/person?ref= — ORCID/Bionomia/IPNI/VIAF (incl. deceased authors). */
  @Public()
  @Get('person')
  person(@Query() q: PersonQueryDto) {
    return this.federation.resolvePerson(q.ref);
  }
}
