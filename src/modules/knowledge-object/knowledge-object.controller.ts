import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MinAssurance, Public, Roles } from '@common/decorators';
import type { Principal, VersionDoc } from '@core/types';
import { KnowledgeObjectService } from './knowledge-object.service';
import { CreateKoDto, DraftDto } from './knowledge-object.dto';
import type { LensRequest } from './lens.util';

function actorOf(p: Principal) {
  const role = p.roles[0] ?? 'author';
  return { ref: p.accountId, role };
}

/** Enforce per-visibility read access (§9.2): private/collaborator content is never public. */
export function assertCanRead(version: VersionDoc, principal?: Principal): void {
  if (version.visibility === 'public') return;
  if (!principal) throw new ForbiddenException('authentication required for non-public content');
  const isAuthor = version.authors.includes(principal.accountId);
  const isPrivileged = principal.roles.some((r) => r === 'editor' || r === 'steward');
  if (!isAuthor && !isPrivileged) throw new ForbiddenException('not permitted to read this version');
}

function lensFrom(q: Record<string, string>): LensRequest {
  return {
    depth: q.depth === 'verbose' ? 'verbose' : 'surface',
    register: q.register === 'popular' ? 'popular' : 'academic',
    language: q.language || 'en',
    includeRestricted: false,
  };
}

@ApiTags('knowledge-objects')
@Controller('ko')
export class KnowledgeObjectController {
  constructor(private readonly svc: KnowledgeObjectService) {}

  @MinAssurance('verified')
  @Post()
  async create(@Body() dto: CreateKoDto, @CurrentUser() user: Principal) {
    return this.svc.createKo({ ...dto, actor: actorOf(user) });
  }

  /** Entity → current tip (+banner). ?version pins a specific version; ?from flags arriving via an older link. */
  @Public()
  @Get(':koId')
  async read(@Param('koId') koId: string, @Query() q: Record<string, string>, @CurrentUser() user?: Principal) {
    const versionId = q.version || q.from || null;
    const model = await this.svc.read(koId, versionId, lensFrom(q));
    assertCanRead(model.version, user);
    return model;
  }

  @Public()
  @Get(':koId/v/:verId')
  async readVersion(@Param('koId') koId: string, @Param('verId') verId: string, @Query() q: Record<string, string>, @CurrentUser() user?: Principal) {
    const model = await this.svc.read(koId, verId, lensFrom(q));
    assertCanRead(model.version, user);
    return model;
  }

  @Public()
  @Get(':koId/history')
  async history(@Param('koId') koId: string, @CurrentUser() user?: Principal) {
    const entity = await this.svc.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);
    const versions = await this.svc.history(koId);
    // History lists metadata of all versions; private versions are visible only to authors/privileged.
    return versions
      .filter((v) => v.visibility === 'public' || (user && (v.authors.includes(user.accountId) || user.roles.some((r) => r === 'editor' || r === 'steward'))))
      .map((v) => ({ id: v._id, parent: v.parent, branch: v.branch, status: v.status, createdAt: v.createdAt, doi: v.doi, authors: v.authors }));
  }

  @Roles('author', 'contributor', 'editor', 'steward')
  @Put(':koId/draft')
  async draft(@Param('koId') koId: string, @Body() dto: DraftDto, @CurrentUser() user: Principal) {
    return this.svc.autosaveDraft(koId, dto.content, actorOf(user));
  }
}
