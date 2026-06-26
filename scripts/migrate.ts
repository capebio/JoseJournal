/* Run SQL migrations against the live Postgres control plane.
 * Usage: PERSISTENCE=live ts-node scripts/migrate.ts   (or: npm run db:migrate) */
import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import configuration from '../src/config/configuration';

async function main(): Promise<void> {
  const cfg = configuration();
  const client = new Client({
    host: cfg.pg.host,
    port: cfg.pg.port,
    user: cfg.pg.user,
    password: cfg.pg.password,
    database: cfg.pg.database,
  });
  await client.connect();
  const dir = join(__dirname, '..', 'db', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    process.stdout.write(`applying ${f} ... `);
    await client.query(sql);
    process.stdout.write('ok\n');
  }
  await client.end();
  console.log(`migrations complete (${files.length} files).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
