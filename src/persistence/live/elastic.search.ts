import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import type { SearchDoc, SearchPort } from '@core/ports';

/**
 * Elastic adapter — index only, never a source of truth (§2 data-plane).
 * Public and restricted projections live in SEPARATE indices (§8 SearchModule)
 * so a public query can never accidentally read restricted text.
 */
@Injectable()
export class ElasticSearchPort implements SearchPort, OnModuleInit {
  private client!: Client;
  private readonly idx = { public: 'jose_public', restricted: 'jose_restricted' } as const;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const e = this.config.get('elastic') as any;
    this.client = new Client({ node: e.node });
    for (const name of Object.values(this.idx)) {
      const exists = await this.client.indices.exists({ index: name });
      if (!exists) await this.client.indices.create({ index: name });
    }
  }

  async index(doc: SearchDoc): Promise<void> {
    await this.client.index({ index: this.idx[doc.index], id: doc.id, document: doc, refresh: true });
  }

  async search(q: { text?: string; koType?: string; status?: string; index: 'public' | 'restricted' }): Promise<SearchDoc[]> {
    const must: any[] = [];
    if (q.text) must.push({ multi_match: { query: q.text, fields: ['title^2', 'text'] } });
    if (q.koType) must.push({ term: { 'koType.keyword': q.koType } });
    if (q.status) must.push({ term: { 'status.keyword': q.status } });
    const res = await this.client.search({
      index: this.idx[q.index],
      query: must.length ? { bool: { must } } : { match_all: {} },
      size: 1000,
    });
    return res.hits.hits.map((h) => h._source as SearchDoc);
  }
}
