import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class IssueGrantDto {
  @IsString()
  grantee!: string; // acct:…

  @IsString()
  purpose!: string;

  @IsNumber()
  ttlMs!: number; // time-limited (mandatory)

  @IsOptional()
  @IsBoolean()
  offlinePkg?: boolean;
}

export class PreciseQueryDto {
  @IsString()
  purpose!: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  offline?: string;
}
