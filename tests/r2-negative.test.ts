import test from 'node:test';
import assert from 'node:assert/strict';
import { validRecords, validRegistry } from '../src/lib/fixtures';
import { validateDataset } from '../src/lib/validate';
import { validateRegistry } from '../src/lib/registry';
import { buildRoutes, resolveLocale } from '../src/lib/routes';
import { ValidationError } from '../src/lib/errors';

function expectCode(fn: () => unknown, code: string) {
  assert.throws(fn, (e: unknown) => e instanceof ValidationError && e.code === code);
}
test('PCS-R2-REG-01 retired ID cannot back an active record', () => {
  const retired = [...validRegistry, { permanentId: 'PRJ-0001', entity: 'Project' as const, state: 'Retired' as const, recordedAt: '2026-09-01' }];
  expectCode(() => validateDataset(validRecords, retired), 'REGISTRY_RETIRED');
  const active = validRecords.filter((r) => r.permanentId !== 'PRJ-0001');
  const ledger = validRegistry.filter((e) => e.permanentId !== 'PRJ-0001');
  assert.doesNotThrow(() => validateDataset(active.map(r => ({ ...r, projectIds: [] })), ledger));
});
test('PCS-R2-REG-02 rejected attempts to reassign Retired ID', () => {
  const entries = [...validRegistry, { permanentId: 'PRJ-0001', entity: 'Project' as const, state: 'Retired' as const, recordedAt: '2026-09-01' }, validRegistry[0]!];
  expectCode(() => validateRegistry(entries), 'REGISTRY_REUSE');
});
test('PCS-R2-ROUTE-01 withdrawn target never falls back', () => {
  const records = validRecords.map(r => r.permanentId === 'PRJ-0001' && r.locale === 'zh'
    ? { ...r, publicationStatus: 'Withdrawn' as const } : r);
  assert.equal(resolveLocale(records, 'PRJ-0001', 'zh').kind, 'withdrawn');
});
test('PCS-R2-ROUTE-02 old Tombstone URL persists without current record', () => {
  const ledger = [{ path: '/projects/past/', permanentId: 'PRJ-0001', locale: 'en' as const,
    firstPublishedAt: '2025-01-01', currentState: 'Tombstone' as const }];
  const routes = buildRoutes([], ledger);
  assert.deepEqual(routes.map(r => [r.path, r.kind, r.noindex]), [['/projects/past/', 'tombstone', true]]);
});
test('PCS-R2-ROUTE-03 old Withdrawn URL persists after slug changes', () => {
  const ledger = [{ path: '/projects/past/', permanentId: 'PRJ-0001', locale: 'en' as const,
    firstPublishedAt: '2025-01-01', currentState: 'Withdrawn' as const }];
  const result = buildRoutes([validRecords[0]!], ledger);
  assert.ok(result.some(r => r.path === '/projects/past/' && r.kind === 'withdrawn' && r.noindex));
  assert.ok(result.some(r => r.path === '/projects/foundation-fixture/' && r.kind === 'page'));
});
test('PCS-R2-ROUTE-04 old URL reassignment blocked', () => {
  const ledger = [{ path: '/projects/foundation-fixture/', permanentId: 'PRJ-9999', locale: 'en' as const,
    firstPublishedAt: '2025-01-01', currentState: 'Tombstone' as const }];
  expectCode(() => buildRoutes([validRecords[0]!], ledger), 'HISTORY_CONFLICT');
});
test('PCS-R2-ROUTE-05 old Published URL cannot disappear', () => {
  const ledger = [{ path: '/projects/past/', permanentId: 'PRJ-0001', locale: 'en' as const,
    firstPublishedAt: '2025-01-01', currentState: 'Published' as const }];
  expectCode(() => buildRoutes([], ledger), 'HISTORY_DISAPPEARANCE');
});
test('PCS-R2-ROUTE-06 no implicit reactivation of withdrawn URL', () => {
  const ledger = [{ path: '/projects/foundation-fixture/', permanentId: 'PRJ-0001', locale: 'en' as const,
    firstPublishedAt: '2025-01-01', currentState: 'Withdrawn' as const }];
  expectCode(() => buildRoutes([validRecords[0]!], ledger), 'HISTORY_REACTIVATION');
});
