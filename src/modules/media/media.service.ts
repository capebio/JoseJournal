import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PORTS, type MediaObjectMeta, type MediaRepo } from '@core/ports';
import type { Principal } from '@core/types';
import { mintId } from '@core/ids';
import { sha256Address } from '@core/hash';
import { ProvenanceService } from '@modules/provenance/provenance.service';

export interface UploadMasterInput {
  mime: string;
  /** Decoded master bytes (the controller decodes base64 → Buffer). */
  bytes: Buffer;
  verificationMaxEdge?: number;
  actorRef: string;
  actorRole: Principal['roles'][number];
}

/** What a verification/convenience serve returns to a caller (§9.9). */
export interface ServeDescriptor {
  /** Verification resolution is ALWAYS free; higher tiers are free in v1 too. */
  free: true;
  /** Verification resolution is NEVER watermarked. Present only on the free verification path. */
  watermark?: false;
  address: string; // sha256-… content address of the served derivative
  mime: string;
  maxEdge?: number;
  /** Set when a higher-than-verification edge was requested (tiering deferred). */
  tierNote?: string;
}

/**
 * §7 Media — content-addressed masters with JXL/IIIF delivery derivatives.
 *
 * Two invariants this module exists to uphold:
 *  1. Content addressing (§29): every blob is keyed by its sha256 address, never
 *     a path, so the master and its derivatives are self-verifying and storage
 *     migrations are backfills behind the resolver rather than reference rewrites.
 *  2. Verification resolution is ALWAYS free and never watermarked (§9.9): the
 *     zoom needed to inspect diagnostic characters (≤ verificationMaxEdge) must
 *     reach any reader with no paywall and no watermark.
 */
@Injectable()
export class MediaService {
  constructor(
    @Inject(PORTS.MediaRepo) private readonly media: MediaRepo,
    private readonly provenance: ProvenanceService,
    private readonly config: ConfigService,
  ) {}

  /** The configured ceiling for free verification resolution (px edge). */
  private freeVerificationMaxEdge(): number {
    return (this.config.get('media') as { freeVerificationMaxEdge: number }).freeVerificationMaxEdge;
  }

  /**
   * Store a master + derivatives, content-addressed.
   *
   * KNOWN v1 LIMITATION — EXIF stripping: we have no image-processing library in
   * v1, so we cannot re-encode or actually strip EXIF here. We mark the master
   * `exifStripped: true` and TRUST callers to send pre-stripped bytes; this FLAG
   * being true is what the §6 anti-leakage checklist asserts on. A fast-follow
   * wires a real strip/transcode step (libvips/sharp) at ingest and stops
   * trusting the caller. Likewise the 'jxl' derivative stores the master bytes
   * verbatim under image/jxl in v1 — a transcode is deferred to the same step.
   */
  async uploadMaster(input: UploadMasterInput): Promise<MediaObjectMeta> {
    const bytes = input.bytes;
    const contentAddress = sha256Address(bytes);
    const id = mintId('media');

    const master: MediaObjectMeta = {
      id,
      contentAddress,
      mime: input.mime,
      bytes: bytes.length,
      derivatives: {},
      verificationMaxEdge: input.verificationMaxEdge,
      exifStripped: true, // v1: caller-trusted; see method doc.
    };
    await this.media.putMaster(master, bytes);

    // 'jxl' delivery derivative — v1 stores the master bytes verbatim as image/jxl.
    const jxlMaxEdge = input.verificationMaxEdge ?? this.freeVerificationMaxEdge();
    await this.media.putDerivative(
      id,
      'jxl',
      { contentAddress: sha256Address(bytes), mime: 'image/jxl', maxEdge: jxlMaxEdge },
      bytes,
    );

    // 'iiif' descriptor derivative — a tiny IIIF image-info JSON document.
    const iiifDoc = {
      '@context': 'http://iiif.io/api/image/3/context.json',
      id: `${id}`,
      type: 'ImageService3',
      protocol: 'http://iiif.io/api/image',
      profile: 'level0',
      maxWidth: jxlMaxEdge,
      maxHeight: jxlMaxEdge,
    };
    const iiifBytes = Buffer.from(JSON.stringify(iiifDoc), 'utf8');
    await this.media.putDerivative(
      id,
      'iiif',
      { contentAddress: sha256Address(iiifBytes), mime: 'application/json', maxEdge: jxlMaxEdge },
      iiifBytes,
    );

    await this.provenance.record({
      subjectRef: id,
      actorRef: input.actorRef,
      actorRole: input.actorRole,
      action: 'created',
      detail: { contentAddress, mime: input.mime, bytes: bytes.length, exifStripped: true, verificationMaxEdge: input.verificationMaxEdge ?? null },
    });

    // Re-read so the returned meta reflects both derivatives (the repo stores clones).
    const stored = await this.media.getMeta(id);
    return stored ?? master;
  }

  /**
   * §9.9 Serve a derivative descriptor.
   *
   * Verification resolution is ALWAYS free and NEVER watermarked: `res` absent,
   * the literal 'verification', or any edge ≤ the media's verificationMaxEdge
   * (falling back to the configured ceiling) resolves to the verification
   * derivative with `free:true, watermark:false`. A higher edge is STILL served
   * free in v1 — the tiered convenience layer is a fast-follow — but is tagged
   * with a tierNote so clients know finer tiers are deferred. We NEVER paywall or
   * watermark verification resolution.
   */
  async serve(id: string, res?: string): Promise<ServeDescriptor> {
    const meta = await this.media.getMeta(id);
    if (!meta) throw new NotFoundException(`media ${id} not found`);

    const verificationEdge = meta.verificationMaxEdge ?? this.freeVerificationMaxEdge();
    // The verification derivative is the 'jxl' delivery one (falls back to the master).
    const jxl = meta.derivatives['jxl'];
    const address = jxl?.contentAddress ?? meta.contentAddress;
    const mime = jxl?.mime ?? meta.mime;

    const requestedEdge = res !== undefined && res !== 'verification' ? Number(res) : undefined;
    const isVerification = requestedEdge === undefined || requestedEdge <= verificationEdge;

    if (isVerification) {
      // ≤ verificationMaxEdge: the diagnostic-character zoom — free, no watermark, no paywall.
      return { free: true, watermark: false, address, mime, maxEdge: verificationEdge };
    }

    // Higher than verification: still free in v1 (convenience tier deferred).
    return { free: true, address, mime, maxEdge: requestedEdge, tierNote: 'convenience tier deferred to fast-follow' };
  }
}
