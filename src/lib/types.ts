export const ENTITIES = ['Project', 'ArchiveRecord', 'Note', 'Collaboration', 'Link'] as const;
export type Entity = (typeof ENTITIES)[number];
export type Locale = 'en' | 'zh';
export type PublicationStatus = 'Draft' | 'Published' | 'Withdrawn';
export type ArchiveKind = 'Work' | 'Milestone';

export interface RecordBase {
  entity: Entity;
  permanentId: string;
  locale: Locale;
  sourceLocale: Locale;
  slug: string;
  publicationStatus: PublicationStatus;
  title?: string;
  summary?: string;
  goal?: string;
  primaryType?: string;
  lifecycle?: string;
  date?: string;
  category?: string;
  archiveKind?: ArchiveKind;
  projectIds: string[];
  publishedAt?: string;
  previouslyPublished?: boolean;
  withdrawnNotice?: string;
  relations?: Array<{ id: string; entity: Entity }>;
  body?: string;
}

export interface RegistryEvent {
  permanentId: string;
  entity: Entity;
  state: 'Assigned' | 'Retired';
  recordedAt: string;
}

export interface RouteRecord {
  path: string;
  permanentId: string;
  locale: Locale;
  entity: Entity;
  kind: 'page' | 'tombstone' | 'withdrawn';
  noindex: boolean;
}

export interface RouteHistory {
  path: string;
  permanentId: string;
  locale: Locale;
  firstPublishedAt: string;
  currentState: 'Published' | 'Tombstone' | 'Withdrawn';
}
