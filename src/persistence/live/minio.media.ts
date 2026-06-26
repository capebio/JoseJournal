import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import type { MediaObjectMeta, MediaRepo } from '@core/ports';

/**
 * MinIO (S3/Swift-compatible) adapter for content-addressed media masters and
 * derivatives. Objects are keyed by their sha256 content address, NEVER by path
 * (§29): migration between CSIR → LifeWatch → EU storage becomes a backfill job
 * behind the resolver, not a reference rewrite. Metadata lives in PG-less JSON
 * objects alongside (a `meta/<id>.json` key) for v1 simplicity.
 */
@Injectable()
export class MinioMediaRepo implements MediaRepo, OnModuleInit {
  private client!: Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const s = this.config.get('s3') as any;
    this.bucket = s.bucket;
    this.client = new Client({
      endPoint: s.endpoint,
      port: s.port,
      useSSL: s.useSsl,
      accessKey: s.accessKey,
      secretKey: s.secretKey,
    });
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) await this.client.makeBucket(this.bucket, 'us-east-1');
  }

  private metaKey(id: string): string {
    return `meta/${id}.json`;
  }
  private blobKey(addr: string): string {
    return `blob/${addr}`;
  }

  async putMaster(meta: MediaObjectMeta, bytes: Buffer): Promise<MediaObjectMeta> {
    await this.client.putObject(this.bucket, this.blobKey(meta.contentAddress), bytes, bytes.length, { 'Content-Type': meta.mime });
    await this.client.putObject(this.bucket, this.metaKey(meta.id), Buffer.from(JSON.stringify(meta)), undefined, { 'Content-Type': 'application/json' });
    return meta;
  }

  async getMeta(id: string): Promise<MediaObjectMeta | null> {
    try {
      const stream = await this.client.getObject(this.bucket, this.metaKey(id));
      const buf = await streamToBuffer(stream);
      return JSON.parse(buf.toString('utf8')) as MediaObjectMeta;
    } catch {
      return null;
    }
  }

  async getBytes(contentAddress: string): Promise<Buffer | null> {
    try {
      const stream = await this.client.getObject(this.bucket, this.blobKey(contentAddress));
      return await streamToBuffer(stream);
    } catch {
      return null;
    }
  }

  async putDerivative(id: string, kind: string, meta: { contentAddress: string; mime: string; maxEdge?: number }, bytes: Buffer): Promise<void> {
    await this.client.putObject(this.bucket, this.blobKey(meta.contentAddress), bytes, bytes.length, { 'Content-Type': meta.mime });
    const current = await this.getMeta(id);
    if (!current) throw new Error(`media ${id} not found`);
    current.derivatives[kind] = meta;
    await this.client.putObject(this.bucket, this.metaKey(id), Buffer.from(JSON.stringify(current)), undefined, { 'Content-Type': 'application/json' });
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
