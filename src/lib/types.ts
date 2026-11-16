export const ENTITIES = ['Project', 'ArchiveRecord', 'Note', 'Collaboration', 'Link'] as const;
export type Entity = (typeof ENTITIES)[number];
export type Locale = 'en' | 'zh';
export type PublicationStatus = 'Draft' | 'Published' | 'Withdrawn';
export type ArchiveKind = 'Work' | 'Milestone';
export type WorkValidityStatus = 'Valid' | 'Withdrawn';
export type ProjectLifecycle = 'planned' | 'active' | 'paused' | 'completed' | 'retired' | string;
export type RegistryState = 'Assigned' | 'Retired';
export type RouteHistoryState = 'Published' | 'Tombstone' | 'Withdrawn';

export interface RecordBase {
  entity: Entity;
  permanentId: string;
  /** `NOT-` is retained only for the inherited synthetic fixture. New Notes use `NTE-`. */
  legacyFixture?: boolean;
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
  validityStatus?: WorkValidityStatus;
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
  state: RegistryState;
  recordedAt: string;
}

export interface RouteRecord {
  path: string;
  permanentId: string;
  locale: Locale;
  entity: Entity;
  kind: 'page' | 'source-fallback' | 'tombstone' | 'withdrawn' | 'missing';
  noindex: boolean;
  sourceLocale?: Locale;
}

export interface RouteHistory {
  path: string;
  permanentId: string;
  locale: Locale;
  firstPublishedAt: string;
  currentState: RouteHistoryState;
}
