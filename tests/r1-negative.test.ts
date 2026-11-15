// PCS-provided independent targeted regression examples (not a replacement for full tests).
// Copy into existing G6-A tests/ after correcting imports if repository file structure changes.
// These tests are EXPECTED TO FAIL against original G6-A source until defects are fixed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validRecords, validRegistry } from '../src/lib/fixtures';
import { validateDataset } from '../src/lib/validate';
import { resolveLocale, buildRoutes } from '../src/lib/routes';
import { validateAssetManifest } from '../src/lib/security';

test('R1-001 forward reference is order independent', () => {
  const input = [{...validRecords[4]!, relations:[{id:'PRJ-0001',entity:'Project' as const}]}, ...validRecords.filter(r=>r.permanentId!=='NOT-0001')];
  assert.doesNotThrow(()=>validateDataset(input, validRegistry));
});
test('R1-002 projectIds must reject unknown Project ID', () => {
  const input=validRecords.map(r=>r.permanentId==='NOT-0001'?{...r,projectIds:['PRJ-9999']}:r);
  assert.throws(()=>validateDataset(input,validRegistry));
});
test('R1-003 no orphan permanent ID outside registry', () => {
  assert.throws(()=>validateDataset(validRecords,[]));
});
test('R1-004 registry event entity must match actual record', () => {
  const bad=validRegistry.map(e=>e.permanentId==='PRJ-0001'?{...e,entity:'Note' as const}:e);
  assert.throws(()=>validateDataset(validRecords,bad));
});
test('R1-005 cross-locale slug must match even for Draft', () => {
  const bad=validRecords.map(r=>r.permanentId==='PRJ-0001'&&r.locale==='zh'?{...r,publicationStatus:'Draft' as const,slug:'divergent-draft'}:r);
  assert.throws(()=>validateDataset(bad,validRegistry));
});
test('R1-006 Chinese source language fallback', () => {
  const records=[{...validRecords[0]!,sourceLocale:'zh' as const,publicationStatus:'Draft' as const}, {...validRecords[1]!,sourceLocale:'zh' as const}];
  const answer=resolveLocale(records,'PRJ-0001','en');
  assert.equal(answer.kind,'source-fallback');
  if(answer.kind==='source-fallback') assert.equal(answer.record.locale,'zh');
});
test('R1-007 forbid fake fallback from non-source Published translation', () => {
  const records=[{...validRecords[0]!,sourceLocale:'zh' as const}, {...validRecords[1]!,sourceLocale:'zh' as const,publicationStatus:'Draft' as const}];
  assert.equal(resolveLocale(records,'PRJ-0001','zh').kind,'missing');
});
test('R1-008 published archive must declare variant', () => {
  const bad=validRecords.map(r=>r.permanentId==='ARC-0001'?{...r,archiveKind:undefined}:r);
  assert.throws(()=>validateDataset(bad,validRegistry));
});
test('R1-009 asset traversal must fail, regardless of caller flag', () => {
  assert.throws(()=>validateAssetManifest([{path:'../../private/x.png',public:true,approved:true,mime:'image/png'}]));
});
test('R1-010 persisted URL cannot silently disappear after Draft', () => {
  const oldPath='/projects/foundation-fixture/';
  const old=[{path:oldPath,permanentId:'PRJ-0001',locale:'en' as const,firstPublishedAt:'2026-01-01',currentState:'Published' as const}];
  const current=[{...validRecords[0]!,publicationStatus:'Draft' as const,previouslyPublished:false}];
  const result=buildRoutes(current,old);
  assert.ok(result.some(r=>r.path===oldPath&&r.noindex)||false,'must keep tombstone/noindex for historical route or fail validation');
});

// Additional required CI-level tests are specified in 02_FOCUSED_CORRECTION_CONTRACT.md:
// (a) insert synthetic Draft JSON into src/data/public; validate/build MUST fail;
// (b) insert unauthorized SVG / path traversal asset; validate/build MUST fail;
// (c) actual public content, independent Registry ledger and route ledger MUST be read at build time.
