import { IsInt, IsOptional, IsPositive, IsString, Matches } from 'class-validator';

/**
 * POST /media — upload a content-addressed master. The bytes ride in as base64
 * so the JSON envelope stays uniform; the service decodes, hashes, and stores.
 */
export class UploadMediaDto {
  @IsString()
  mime!: string; // e.g. image/jpeg, image/png

  @IsString()
  dataBase64!: string; // raw master bytes, base64-encoded

  /** Max edge (px) at which the diagnostic characters are verifiable (§9.9). */
  @IsOptional()
  @IsInt()
  @IsPositive()
  verificationMaxEdge?: number;
}

/**
 * GET /media/:id?res=… — `res` is either a pixel edge (number-as-string) or the
 * literal `verification`. Absent ⇒ verification resolution. Verification is
 * ALWAYS free and never watermarked (§9.9).
 */
export class ServeMediaQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^(verification|\d+)$/)
  res?: string;
}
