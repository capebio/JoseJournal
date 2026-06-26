import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncLocalStorage } from 'async_hooks';
import { Pool, PoolClient } from 'pg';
import type { UnitOfWork } from '@core/ports';

/**
 * Shared Postgres pool. Transaction-aware: queries issued inside `transaction()`
 * run on the same client (via AsyncLocalStorage), so the §5 tagVoR write
 * (release + doi_registry + provenance) is genuinely atomic on the live stack —
 * mirroring the in-memory UnitOfWork's snapshot/rollback semantics.
 */
@Injectable()
export class PgPool implements OnModuleDestroy {
  readonly pool: Pool;
  private readonly als = new AsyncLocalStorage<{ client: PoolClient }>();

  constructor(config: ConfigService) {
    const pg = config.get('pg') as any;
    this.pool = new Pool({
      host: pg.host,
      port: pg.port,
      user: pg.user,
      password: pg.password,
      database: pg.database,
      max: 10,
    });
  }

  async query<T = any>(text: string, params?: unknown[]): Promise<T[]> {
    const store = this.als.getStore();
    const runner = store?.client ?? this.pool;
    const res = await runner.query(text, params as any[]);
    return res.rows as T[];
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const existing = this.als.getStore();
    if (existing) return work(); // already in a transaction — join it
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.als.run({ client }, work);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Injectable()
export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pg: PgPool) {}
  run<T>(work: () => Promise<T>): Promise<T> {
    return this.pg.transaction(work);
  }
}
