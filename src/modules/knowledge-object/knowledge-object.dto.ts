import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import type { KnowledgeObjectContent, KoType, Tier, Visibility } from '@core/types';

const KO_TYPES = ['treatment', 'micro-observation', 'dataset', 'report', 'article', 'review', 'method', 'comment', 'synthesis'];

export class CreateKoDto {
  @IsIn(KO_TYPES)
  koType!: KoType;

  @IsOptional()
  @IsIn(['commons', 'journal'])
  tier?: Tier;

  @IsObject()
  content!: KnowledgeObjectContent;

  @IsOptional()
  @IsArray()
  authors?: string[];

  @IsOptional()
  @IsIn(['private', 'collaborators', 'public'])
  visibility?: Visibility;

  @IsOptional()
  @IsString()
  conceptRef?: string;

  @IsOptional()
  @IsArray()
  subjectRefs?: string[];
}

export class DraftDto {
  @IsObject()
  content!: KnowledgeObjectContent;
}

export class AmendDto {
  @IsString()
  baseVersionId!: string;

  @IsObject()
  content!: KnowledgeObjectContent;

  @IsIn(['trivial', 'substantive', 'structural'])
  amendClass!: 'trivial' | 'substantive' | 'structural';

  @IsOptional()
  @IsIn(['raw', 'verified', 'reviewed', 'vor', 'superseded', 'retracted'])
  status?: 'raw' | 'verified' | 'reviewed' | 'vor' | 'superseded' | 'retracted';
}

export class ForkDto {
  @IsString()
  fromVersionId!: string;
}

export class ReleaseDto {
  @IsOptional()
  @IsString()
  versionId?: string; // for journal VoR; defaults to current tip

  @IsOptional()
  @IsIn(['commons', 'journal'])
  tier?: Tier; // 'journal' (default) tags a VoR + mints a DOI; 'commons' is a low-friction release
}

export class RetractDto {
  @IsString()
  versionId!: string;

  @IsString()
  reason!: string;
}
