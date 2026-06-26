import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nano, { DocumentScope, ServerScope } from 'nano';
import type { KnowledgeObjectRepo } from '@core/ports';
import type { KnowledgeObjectEntity, VersionDoc } from '@core/types';

/**
 * CouchDB adapter. Two databases:
 *  - content (jose_content): entities (ko:) + immutable versions (ver:sha256-…)
 *  - public  (jose_public):  QDS-only public projections an untrusted client may replicate
 *
 * Immutable versions are written with their content hash as the Couch `_id`.
 * Their scholarly identity is the hash, never Couch `_rev` (§5) — so compaction
 * of `_rev` history is irrelevant to citation stability.
 */
@Injectable()
export class LiveCouchKnowledgeObjectRepo implements KnowledgeObjectRepo, OnModuleInit {
  private server!: ServerScope;
  private content!: DocumentScope<any>;
  private pub!: DocumentScope<any>;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const c = this.config.get('couch') as any;
    this.server = nano(c.url);
    await this.ensureDb(c.content);
    await this.ensureDb(c.public);
    this.content = this.server.db.use(c.content);
    this.pub = this.server.db.use(c.public);
  }

  private async ensureDb(name: string): Promise<void> {
    try {
      await this.server.db.get(name);
    } catch {
      await this.server.db.create(name);
    }
  }

  private async getDoc<T>(db: DocumentScope<any>, id: string): Promise<T | null> {
    try {
      const doc = await db.get(id);
      return doc as unknown as T;
    } catch (e: any) {
      if (e?.statusCode === 404) return null;
      throw e;
    }
  }

  async createEntity(e: KnowledgeObjectEntity): Promise<KnowledgeObjectEntity> {
    const res = await this.content.insert(e as any, e._id);
    return { ...e, _rev: res.rev };
  }

  async getEntity(koId: string): Promise<KnowledgeObjectEntity | null> {
    return this.getDoc<KnowledgeObjectEntity>(this.content, koId);
  }

  async updateEntity(e: KnowledgeObjectEntity): Promise<KnowledgeObjectEntity> {
    const current = await this.getDoc<KnowledgeObjectEntity>(this.content, e._id);
    const rev = current?._rev;
    const res = await this.content.insert({ ...e, _rev: rev } as any, e._id);
    return { ...e, _rev: res.rev };
  }

  async putVersion(v: VersionDoc): Promise<VersionDoc> {
    const existing = await this.getDoc<VersionDoc>(this.content, v._id);
    if (existing) return existing; // idempotent: identical content hash already stored
    const res = await this.content.insert(v as any, v._id);
    return { ...v, _rev: res.rev };
  }

  async getVersion(versionId: string): Promise<VersionDoc | null> {
    return this.getDoc<VersionDoc>(this.content, versionId);
  }

  async listVersions(koId: string): Promise<VersionDoc[]> {
    const res = await this.content.find({ selector: { ko: koId, '@type': 'Version' }, limit: 10000 });
    return res.docs as unknown as VersionDoc[];
  }

  async putPublicProjection(id: string, doc: Record<string, unknown>): Promise<void> {
    const current = await this.getDoc<any>(this.pub, id);
    await this.pub.insert({ ...doc, _id: id, _rev: current?._rev } as any, id);
  }

  async getPublicProjection(id: string): Promise<Record<string, unknown> | null> {
    return this.getDoc<Record<string, unknown>>(this.pub, id);
  }

  async dumpPublic(): Promise<Record<string, Record<string, unknown>>> {
    const res = await this.pub.list({ include_docs: true });
    const out: Record<string, Record<string, unknown>> = {};
    for (const row of res.rows) {
      if (row.id.startsWith('_design/')) continue;
      out[row.id] = (row as any).doc;
    }
    return out;
  }
}
