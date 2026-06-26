import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * §7 GET /cite/:koId — the three-identifier model. `as` selects which of the
 * three identifiers the response is pinned to:
 *   entity  -> navigation-only URL (follows the moving tip)
 *   version -> immutable URL pinned to the current tip ver id
 *   doi     -> the KO's VoR DOI (falls back to version when no VoR exists)
 */
export class CiteQueryDto {
  @IsOptional()
  @IsIn(['entity', 'version', 'doi'])
  as?: 'entity' | 'version' | 'doi';
}

/**
 * §7 POST /snippets — anchor a quotation to an IMMUTABLE version+block.
 * Anchors NEVER reference an entity (§3.9): a snippet pins exactly one version's
 * one block so later drift is detectable.
 */
export class CreateSnippetDto {
  @IsString()
  versionId!: string; // ver:… (immutable)

  @IsString()
  sectionPath!: string;

  @IsString()
  blockId!: string; // blk:…

  @IsOptional()
  @IsString()
  quotedText?: string; // defaults to the block's text at cite time
}
