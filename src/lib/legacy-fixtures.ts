import type { Entity, RecordBase } from './types';
import { ValidationError } from './errors';

/**
 * The inherited G6-A fixture is the only NOT-prefixed Note retained by the
 * adapter. A prefix alone never grants legacy compatibility.
 */
export interface LegacyFixturePin {
  permanentId: string;
  entity: Entity;
  locale: 'en' | 'zh';
  sourceLocale: 'en' | 'zh';
  slug: string;
  sourcePath: string;
  sha256: string;
}

export const LEGACY_FIXTURE_PINS: readonly LegacyFixturePin[] = Object.freeze([
  {
    permanentId: 'NOT-0001',
    entity: 'Note',
    locale: 'en',
    sourceLocale: 'en',
    slug: 'note-fixture',
    sourcePath: 'src/data/public/content/NOT-0001-en.json',
    sha256: '3bd9f70dc751b641d58da178b5a6014f66bd47cd5757aa135ea088a109d897ed'
  }
]);

export function getLegacyFixturePin(id: string): LegacyFixturePin | undefined {
  return LEGACY_FIXTURE_PINS.find((pin) => pin.permanentId === id);
}

export function isPinnedLegacyNoteId(id: string): boolean {
  return Boolean(getLegacyFixturePin(id));
}

export function assertPinnedLegacyFixture(record: RecordBase): void {
  const pin = getLegacyFixturePin(record.permanentId);
  if (!pin || record.entity !== pin.entity || record.locale !== pin.locale || record.sourceLocale !== pin.sourceLocale || record.slug !== pin.slug) {
    throw new ValidationError('LEGACY_ID_UNREGISTERED', 'NOT-prefixed Note is not an approved inherited fixture: ' + record.permanentId);
  }
}
