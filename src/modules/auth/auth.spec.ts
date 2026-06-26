import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import configuration from '@src/config/configuration';
import { PersistenceModule } from '@persistence/persistence.module';
import { CommonModule } from '@common/common.module';
import { decodeJwt } from '@common/jwt';
import { AuthModule } from './auth.module';
import { AuthController } from './auth.controller';

/**
 * makeContext() does NOT include AuthModule (and its app is HTTP-less), so this
 * spec stands up its own minimal HTTP context: ConfigModule + in-memory
 * PersistenceModule + the global guard (CommonModule) + AuthModule. That lets us
 * prove the round trip: a dev-login token, presented as a bearer, is accepted by
 * the global AuthGuard and resolves to a Principal carrying the requested claims.
 */
describe('§7 Auth / dev-login + whoami', () => {
  let mod: TestingModule;
  let app: INestApplication;

  beforeAll(async () => {
    process.env.PERSISTENCE = 'memory';
    process.env.AUTH_DEV_MODE = 'true';
    mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
        PersistenceModule.forRoot(),
        CommonModule,
        AuthModule,
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('dev-login returns a token whose claims decode to the requested identity', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ sub: 'kc-alice', accountId: 'acct:alice', assurance: 'certified', roles: ['editor'], orcid: '0000-0001', name: 'Alice' })
      .expect(201);

    expect(typeof res.body.token).toBe('string');
    const { header, claims } = decodeJwt(res.body.token);
    expect(header.alg).toBe('HS256');
    expect(claims.sub).toBe('kc-alice');
    expect(claims.accountId).toBe('acct:alice');
    expect(claims.assurance).toBe('certified');
    expect(claims.roles).toEqual(['editor']);
    expect(claims.orcid).toBe('0000-0001');
    expect(claims.name).toBe('Alice');
    // signHs256 always stamps iat/exp.
    expect(typeof claims.iat).toBe('number');
    expect(typeof claims.exp).toBe('number');
  });

  it('the dev-login token, used as a bearer, resolves to a Principal with the requested assurance/roles', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ sub: 'kc-bob', accountId: 'acct:bob', assurance: 'verified', roles: ['reviewer'] })
      .expect(201);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    expect(me.body.sub).toBe('kc-bob');
    expect(me.body.accountId).toBe('acct:bob');
    expect(me.body.assurance).toBe('verified');
    expect(me.body.roles).toEqual(['reviewer']);
  });

  it('GET /auth/me without a token reports anonymous', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').expect(200);
    expect(me.body).toEqual({ anonymous: true });
  });

  it('GET /auth/me with a garbage bearer tolerates it (public read) and reports anonymous', async () => {
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(200);
    expect(me.body).toEqual({ anonymous: true });
  });

  it('dev-login is forbidden when dev mode is off', async () => {
    const controller = mod.get(AuthController);
    const config = mod.get(ConfigService);
    const original = config.get('keycloak') as any;
    const spy = jest.spyOn(config, 'get').mockImplementation((key: string) => (key === 'keycloak' ? { ...original, devMode: false } : original));
    expect(() => controller.devLogin({ sub: 'kc-eve' } as any)).toThrow(/dev mode/i);
    spy.mockRestore();
  });
});
