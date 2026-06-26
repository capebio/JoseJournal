import { ForbiddenException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { PORTS, type SearchDoc, type SearchPort } from '@core/ports';
import type { Principal } from '@core/types';
import { SearchService } from './search.service';
import { makeContext } from '@src/test-support/make-context';

const editor = (id: string): Principal => ({ sub: id, accountId: id, assurance: 'verified', roles: ['editor'], orcid: null });
const author = (id: string): Principal => ({ sub: id, accountId: id, assurance: 'verified', roles: ['author'], orcid: null });

function doc(over: Partial<SearchDoc> & Pick<SearchDoc, 'id' | 'index'>): SearchDoc {
  return {
    koId: 'ko:1',
    koType: 'treatment',
    status: 'verified',
    tier: 'commons',
    visibility: 'public',
    title: 'Mesembryanthemum',
    text: 'succulent leaves opposite',
    ...over,
  };
}

describe('§9 Search / index separation + authority', () => {
  let mod: TestingModule;
  let port: SearchPort;
  let service: SearchService;

  beforeEach(async () => {
    mod = await makeContext();
    await mod.init();
    // PORTS.SearchPort is provided by the global in-memory PersistenceModule;
    // SearchModule isn't wired into makeContext, so build the service over the port.
    port = mod.get(PORTS.SearchPort);
    service = new SearchService(port);
    // Index one public and one restricted doc directly through the port.
    await port.index(doc({ id: 'pub-1', index: 'public', title: 'Public treatment' }));
    await port.index(doc({ id: 'res-1', index: 'restricted', title: 'Restricted treatment', visibility: 'private' }));
  });
  afterEach(async () => mod.close());

  it('a public query returns only public-index docs (separate indices)', async () => {
    const hits = await service.query({ text: 'treatment' }); // anonymous, default index
    expect(hits.map((d) => d.id)).toEqual(['pub-1']);
    expect(hits.every((d) => d.index === 'public')).toBe(true);
  });

  it('defaults to the public index when index is omitted', async () => {
    const hits = await service.query({}, author('acct:a'));
    expect(hits.every((d) => d.index === 'public')).toBe(true);
    expect(hits.some((d) => d.id === 'res-1')).toBe(false);
  });

  it('an anonymous caller cannot query the restricted index', async () => {
    await expect(service.query({ index: 'restricted' }, null)).rejects.toThrow(ForbiddenException);
  });

  it('an under-privileged caller (author) cannot query the restricted index', async () => {
    await expect(service.query({ index: 'restricted' }, author('acct:a'))).rejects.toThrow(/restricted/i);
  });

  it('an editor can query the restricted index and sees restricted docs', async () => {
    const hits = await service.query({ index: 'restricted' }, editor('acct:e'));
    expect(hits.map((d) => d.id)).toEqual(['res-1']);
    expect(hits.every((d) => d.index === 'restricted')).toBe(true);
  });

  it('structured filters (koType/status) narrow within the public index', async () => {
    await port.index(doc({ id: 'pub-2', index: 'public', koType: 'article', status: 'vor', title: 'An article' }));
    const byType = await service.query({ koType: 'article' });
    expect(byType.map((d) => d.id)).toEqual(['pub-2']);
    const byStatus = await service.query({ status: 'verified' });
    expect(byStatus.map((d) => d.id)).toEqual(['pub-1']);
  });
});
