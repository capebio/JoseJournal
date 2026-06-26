import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true }); // the web/field client lives on another origin
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('JOSE — Journal of Systematics and Ecology (v1)')
    .setDescription('The trust boundary. Server-authoritative for minting, release, precise-locality disclosure, consent, and provenance.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  const port = app.get(ConfigService).get<number>('port') ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`JOSE v1 listening on :${port}  (persistence=${process.env.PERSISTENCE || 'memory'})  — Swagger at /api`);
}

bootstrap();
