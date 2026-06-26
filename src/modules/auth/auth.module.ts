import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

/**
 * Dev-login + whoami controller. The global AuthGuard (CommonModule) and the
 * IdentityRepo (PersistenceModule) do the actual verification/resolution, so this
 * module only contributes the controller; ConfigService is globally available.
 */
@Module({
  controllers: [AuthController],
})
export class AuthModule {}
