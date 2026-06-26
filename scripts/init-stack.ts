/* Idempotently provision the non-Postgres stores (Couch DBs, MinIO bucket,
 * Elastic indices). Adapters also self-provision on boot; this is for ops/CI.
 * Usage: PERSISTENCE=live ts-node scripts/init-stack.ts */
import nano from 'nano';
import { Client as EsClient } from '@elastic/elasticsearch';
import { Client as MinioClient } from 'minio';
import configuration from '../src/config/configuration';

async function main(): Promise<void> {
  const cfg = configuration();

  // CouchDB databases
  const couch = nano(cfg.couch.url);
  for (const db of [cfg.couch.content, cfg.couch.public, '_users', '_replicator']) {
    try {
      await couch.db.create(db);
      console.log(`couch: created ${db}`);
    } catch (e: any) {
      console.log(`couch: ${db} ${e?.statusCode === 412 ? 'exists' : 'skip(' + e?.statusCode + ')'}`);
    }
  }

  // Elastic indices (public + restricted kept separate, §8)
  const es = new EsClient({ node: cfg.elastic.node });
  for (const idx of ['jose_public', 'jose_restricted']) {
    const exists = await es.indices.exists({ index: idx }).catch(() => false);
    if (!exists) {
      await es.indices.create({ index: idx });
      console.log(`elastic: created ${idx}`);
    } else console.log(`elastic: ${idx} exists`);
  }

  // MinIO bucket
  const minio = new MinioClient({
    endPoint: cfg.s3.endpoint,
    port: cfg.s3.port,
    useSSL: cfg.s3.useSsl,
    accessKey: cfg.s3.accessKey,
    secretKey: cfg.s3.secretKey,
  });
  const has = await minio.bucketExists(cfg.s3.bucket).catch(() => false);
  if (!has) {
    await minio.makeBucket(cfg.s3.bucket, 'us-east-1');
    console.log(`minio: created bucket ${cfg.s3.bucket}`);
  } else console.log(`minio: bucket ${cfg.s3.bucket} exists`);

  console.log('stack init complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
