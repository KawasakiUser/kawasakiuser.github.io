import assert from 'node:assert/strict';
import { validRecords, validRegistry } from '../src/lib/fixtures';
import { validateDataset } from '../src/lib/validate';
import { validateAssetManifest } from '../src/lib/security';
import { buildRoutes } from '../src/lib/routes';

function expectFailure(action: () => unknown, label: string): void {
  assert.throws(action, label);
}
expectFailure(() => validateDataset(validRecords.map((record) => record.permanentId === 'NOT-0001' ? { ...record, projectIds: ['PRJ-9999'] } : record), validRegistry), 'orphan project ID');
expectFailure(() => validateDataset(validRecords, []), 'empty registry');
expectFailure(() => validateDataset(validRecords.map((record) => record.permanentId === 'PRJ-0001' && record.locale === 'zh' ? { ...record, publicationStatus: 'Draft' as const, slug: 'divergent-draft' } : record), validRegistry), 'draft slug divergence');
expectFailure(() => validateAssetManifest([{ path: '../../private/image.png', public: true, approved: true, mime: 'image/png' }]), 'asset traversal');
expectFailure(() => validateDataset(validRecords.map((record) => record.permanentId === 'ARC-0001' ? { ...record, archiveKind: undefined } : record), validRegistry), 'missing archive variant');
assert.ok(buildRoutes([{ ...validRecords[0]!, publicationStatus: 'Draft' as const }], [{ path: '/projects/foundation-fixture/', permanentId: 'PRJ-0001', locale: 'en', firstPublishedAt: '2026-01-01', currentState: 'Published' }]).some((route) => route.kind === 'tombstone'));
console.log('PASS negative integration: invalid dataset, registry, asset and historical route cases fail closed');
