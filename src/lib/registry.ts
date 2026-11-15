import type { Entity, RecordBase, RegistryEvent } from './types';
import { ValidationError } from './errors';

export function validateRegistry(events: readonly RegistryEvent[]): void {
  const state = new Map<string, RegistryEvent>();
  for (const event of events) {
    const previous = state.get(event.permanentId);
    if (event.state === 'Assigned' && previous) {
      throw new ValidationError('REGISTRY_REUSE', 'Permanent ID assigned more than once: ' + event.permanentId);
    }
    if (event.state === 'Retired' && (!previous || previous.state !== 'Assigned')) {
      throw new ValidationError('REGISTRY_HISTORY', 'Retirement without assignment: ' + event.permanentId);
    }
    state.set(event.permanentId, event);
  }
}

export function reconcileRegistry(records: readonly RecordBase[], events: readonly RegistryEvent[]): void {
  validateRegistry(events);
  const assigned = new Map(events.filter((event) => event.state === 'Assigned').map((event) => [event.permanentId, event]));
  const recordIds = new Set(records.map((record) => record.permanentId));
  for (const record of records) {
    const event = assigned.get(record.permanentId);
    if (!event) throw new ValidationError('REGISTRY_MISSING', 'Record is not assigned in registry: ' + record.permanentId);
    if (event.entity !== record.entity) throw new ValidationError('REGISTRY_ENTITY', 'Registry entity mismatch: ' + record.permanentId);
  }
  for (const id of assigned.keys()) {
    if (!recordIds.has(id)) throw new ValidationError('REGISTRY_ORPHAN', 'Registry ID has no record: ' + id);
  }
}

export function assertAllocationRace(existing: readonly RegistryEvent[], candidate: RegistryEvent): void {
  if (existing.some((event) => event.permanentId === candidate.permanentId && event.state === 'Assigned')) {
    throw new ValidationError('REGISTRY_RACE', 'Allocation conflict for ' + candidate.permanentId);
  }
}

export function prefixFor(entity: Entity): string {
  return { Project: 'PRJ', ArchiveRecord: 'ARC', Note: 'NOT', Collaboration: 'COL', Link: 'LNK' }[entity];
}
