import { IsIn, IsOptional, IsString } from 'class-validator';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  koType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  /** Which index to query — defaults to 'public' when omitted. */
  @IsOptional()
  @IsIn(['public', 'restricted'])
  index?: 'public' | 'restricted';
}
