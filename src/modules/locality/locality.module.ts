import { Module } from '@nestjs/common';
import { LocalityService } from './locality.service';
import { LocalityController } from './locality.controller';

@Module({
  providers: [LocalityService],
  controllers: [LocalityController],
  exports: [LocalityService],
})
export class LocalityModule {}
