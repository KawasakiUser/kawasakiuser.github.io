import type { Entity, RecordBase, RegistryEvent } from './types';
import { ValidationError } from './errors';

// The ledger is append-only: an old Assigned event does not authorize use
// after a terminal Retired event.
export function currentRegistry(events: readonly RegistryEvent[]): Map<string, RegistryEvent> {
  const current = new Map<string, RegistryEvent>();
  for (const event of events) {
    if (event.state !== 'Assigned' && event.state !== 'Retired') {
      throw new ValidationError('REGISTRY_STATE', 'Unknown registry state: ' + event.permanentId);
    }
    const previous = current.get(event.permanentId);
    if (event.state === 'Assigned' && previous) {
      throw new ValidationError('REGISTRY_REUSE', 'Permanent ID assigned more than once: ' + event.permanentId);
    }
    if (event.state === 'Retired' && (!previous || previous.state !== 'Assigned')) {
      throw new ValidationError('REGISTRY_HISTORY', 'Retirement without active assignment: ' + event.permanentId);
    }
    if (previous && previous.entity !== event.entity) {
      throw new ValidationError('REGISTRY_ENTITY_HISTORY', 'Registry entity changed for ' + event.permanentId);
    }
    current.set(event.permanentId, event);
  }
  return current;
}

export function validateRegistry(events: readonly RegistryEvent[]): void {
  currentRegistry(events);
}

export function reconcileRegistry(records: readonly RecordBase[], events: readonly RegistryEvent[]): void {
  const current = currentRegistry(events);
  const recordIds = new Set(records.map((record) => record.permanentId));
  for (const record of records) {
    const event = current.get(record.permanentId);
    if (!event) throw new ValidationError('REGISTRY_MISSING', 'Record is not assigned in registry: ' + record.permanentId);
    if (event.state === 'Retired') throw new ValidationError('REGISTRY_RETIRED', 'Retired permanent ID is not active: ' + record.permanentId);
    if (event.entity !== record.entity) throw new ValidationError('REGISTRY_ENTITY', 'Registry entity mismatch: ' + record.permanentId);
  }
  for (const [id, event] of current) {
    if (event.state === 'Assigned' && !recordIds.has(id)) {
      throw new ValidationError('REGISTRY_ORPHAN', 'Active Registry ID has no record: ' + id);
    }
  }
}

export function assertAllocationRace(existing: readonly RegistryEvent[], candidate: RegistryEvent): void {
  if (existing.some((event) => event.permanentId === candidate.permanentId && event.state === 'Assigned')) {
    throw new ValidationError('REGISTRY_RACE', 'Allocation conflict for ' + candidate.permanentId);
  }
}

export function prefixFor(entity: Entity): string {
  return { Project: 'PRJ', ArchiveRecord: 'ARC', Note: 'NTE', Collaboration: 'COL', Link: 'LNK' }[entity];
}

export function isNoteId(id: string): boolean {
  return /^(?:NTE|NOT)-\d{4}$/.test(id);
}

export function prefixMatchesEntity(entity: Entity, id: string): boolean {
  return entity === 'Note' ? isNoteId(id) : new RegExp('^' + prefixFor(entity) + '-\\d{4}$').test(id);
}
