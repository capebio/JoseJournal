import { IsIn, IsOptional, IsString } from 'class-validator';
import { EXPORT_FORMATS, type ExportFormat } from './export.service';

/** §7 query for GET /ko/:koId/export — ?format=md|docx|jats|json&version=<verId?> */
export class ExportQueryDto {
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat; // defaults to 'md' when omitted

  @IsOptional()
  @IsString()
  version?: string; // ver:… — pins a specific version; otherwise the current tip
}
