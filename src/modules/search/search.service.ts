import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PORTS, type SearchDoc, type SearchPort } from '@core/ports';
import type { Principal } from '@core/types';

export interface SearchQuery {
  text?: string;
  koType?: string;
  status?: string;
  /** Which Elastic index to hit. Defaults to 'public' (§8 SearchModule). */
  index?: 'public' | 'restricted';
}

/**
 * §8 SearchModule — read-only projection over Elastic. The public and restricted
 * indices are kept STRICTLY SEPARATE: a public query can structurally never reach
 * a restricted-index doc because the two live in different indices and the port
 * filters by index. Indexing happens elsewhere (KnowledgeObjectService on
 * create/reindex); this service only QUERIES.
 *
 * Authority: the public index is queryable by anyone; the restricted index
 * requires an editor or steward (§15 authority matrix). Certification or mere
 * authentication never unlocks the restricted index.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(PORTS.SearchPort) private readonly search: SearchPort) {}

  /** True iff the principal may query the restricted index. */
  private canQueryRestricted(user: Principal | null | undefined): boolean {
    return !!user && (user.roles.includes('editor') || user.roles.includes('steward'));
  }

  /**
   * Query one index. `user` is the (possibly anonymous) caller. Targeting the
   * restricted index without editor/steward authority is refused with a 403 and
   * no leakage of restricted content.
   */
  async query(q: SearchQuery, user?: Principal | null): Promise<SearchDoc[]> {
    const index = q.index ?? 'public';
    if (index === 'restricted' && !this.canQueryRestricted(user)) {
      throw new ForbiddenException('restricted index requires editor or steward role');
    }
    return this.search.search({ text: q.text, koType: q.koType, status: q.status, index });
  }
}
