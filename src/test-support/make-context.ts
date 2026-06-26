import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { VersioningModule } from '@modules/versioning/versioning.module';
import { LocalityModule } from '@modules/locality/locality.module';

/**
 * Build a DI context wired to the in-memory persistence for unit/spec tests.
 * Deterministic and service-free — this is the harness every §9 spec runs on.
 */
export async function makeContext(): Promise<TestingModule> {
  process.env.PERSISTENCE = 'memory';
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
      PersistenceModule.forRoot(),
      ProvenanceModule,
      KnowledgeObjectModule,
      VersioningModule,
      LocalityModule,
    ],
  }).compile();
}

import type { KnowledgeObjectContent } from '@core/types';

/** A minimal valid treatment content body for tests. */
export function sampleContent(title = 'Mesembryanthemum treatment'): KnowledgeObjectContent {
  return {
    title,
    sections: [
      {
        path: 'description',
        blocks: [
          { blockId: 'blk:fixed-desc-1', type: 'paragraph', text: 'Leaves opposite, succulent.', claims: ['claim:c1'] },
          { blockId: 'blk:fixed-fig-1', type: 'figure', captions: { surface: 'Fig 1. Habit.', verbose: 'Fig 1. Habit, showing succulent opposite leaves.' } },
        ],
      },
    ],
    claims: {
      'claim:c1': { statement: 'Leaves are succulent.', evidence: ['obs:fixture'], confidence: 'author-asserted' },
    },
  };
}
