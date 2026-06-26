import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MinAssurance, Public } from '@common/decorators';
import type { Principal } from '@core/types';
import { MediaService } from './media.service';
import { ServeMediaQueryDto, UploadMediaDto } from './media.dto';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * §7 POST /media — upload a content-addressed master (verified+). The body
   * carries the bytes as base64; the service decodes, hashes, stores the master,
   * and builds 'jxl' + 'iiif' derivatives.
   */
  @MinAssurance('verified')
  @Post()
  async upload(@Body() dto: UploadMediaDto, @CurrentUser() user: Principal) {
    const bytes = Buffer.from(dto.dataBase64, 'base64');
    return this.media.uploadMaster({
      mime: dto.mime,
      bytes,
      verificationMaxEdge: dto.verificationMaxEdge,
      actorRef: user.accountId,
      actorRole: user.roles[0] ?? 'author',
    });
  }

  /**
   * §7/§9.9 GET /media/:id?res=<number>|'verification' — serve a derivative
   * descriptor. Public: verification resolution is ALWAYS free and never
   * watermarked, so this read is open to any client with no paywall.
   */
  @Public()
  @Get(':id')
  async serve(@Param('id') id: string, @Query() q: ServeMediaQueryDto) {
    return this.media.serve(id, q.res);
  }
}
