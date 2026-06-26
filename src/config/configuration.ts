export type PersistenceMode = 'memory' | 'live';

export interface AppConfig {
  persistence: PersistenceMode;
  port: number;
  couch: { url: string; content: string; public: string };
  pg: { host: string; port: number; user: string; password: string; database: string };
  elastic: { node: string };
  redis: { host: string; port: number };
  s3: { endpoint: string; port: number; useSsl: boolean; accessKey: string; secretKey: string; bucket: string };
  keycloak: { url: string; realm: string; jwksUri: string; issuer: string; devMode: boolean; devSecret: string };
  doi: { agency: string; prefix: string };
  media: { freeVerificationMaxEdge: number };
}

export default (): AppConfig => ({
  persistence: (process.env.PERSISTENCE as PersistenceMode) || 'memory',
  port: parseInt(process.env.PORT || '3000', 10),
  couch: {
    url: process.env.COUCH_URL || 'http://admin:josepw@localhost:5984',
    content: process.env.COUCH_DB_CONTENT || 'jose_content',
    public: process.env.COUCH_DB_PUBLIC || 'jose_public',
  },
  pg: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    user: process.env.PG_USER || 'jose',
    password: process.env.PG_PASSWORD || 'josepw',
    database: process.env.PG_DATABASE || 'jose',
  },
  elastic: { node: process.env.ELASTIC_NODE || 'http://localhost:9200' },
  redis: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) },
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'localhost',
    port: parseInt(process.env.S3_PORT || '9000', 10),
    useSsl: process.env.S3_USE_SSL === 'true',
    accessKey: process.env.S3_ACCESS_KEY || 'joseminio',
    secretKey: process.env.S3_SECRET_KEY || 'joseminiopw',
    bucket: process.env.S3_BUCKET || 'jose-media',
  },
  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'jose',
    jwksUri: process.env.KEYCLOAK_JWKS_URI || 'http://localhost:8080/realms/jose/protocol/openid-connect/certs',
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/jose',
    devMode: process.env.AUTH_DEV_MODE !== 'false',
    devSecret: process.env.AUTH_DEV_SECRET || 'jose-dev-secret',
  },
  doi: { agency: process.env.DOI_AGENCY || 'datacite', prefix: process.env.DOI_PREFIX || '10.80000' },
  media: { freeVerificationMaxEdge: parseInt(process.env.MEDIA_FREE_VERIFICATION_MAX_EDGE || '8192', 10) },
});
