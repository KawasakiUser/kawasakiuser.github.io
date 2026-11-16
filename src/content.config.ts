import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const records = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/public/content' }),
  schema: z.object({
    entity: z.enum(['Project', 'ArchiveRecord', 'Note', 'Collaboration', 'Link']),
    permanentId: z.string().regex(/^(PRJ|ARC|NTE|NOT|COL|LNK)-\d{4}$/),
    locale: z.enum(['en', 'zh']),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    publicationStatus: z.enum(['Draft', 'Published', 'Withdrawn']),
    title: z.string().optional(),
    sourceLocale: z.enum(['en', 'zh']),
    primaryType: z.string().optional(),
    lifecycle: z.string().optional(),
    goal: z.string().optional(),
    summary: z.string().optional(),
    date: z.string().optional(),
    category: z.string().optional(),
    body: z.string().optional(),
    archiveKind: z.enum(['Work', 'Milestone']).optional(),
    validityStatus: z.enum(['Valid', 'Withdrawn']).optional(),
    projectIds: z.array(z.string()).default([]),
    relations: z.array(z.object({ id: z.string(), entity: z.enum(['Project', 'ArchiveRecord', 'Note', 'Collaboration', 'Link']) })).optional(),
    publishedAt: z.string().optional(),
    previouslyPublished: z.boolean().optional(),
    withdrawnNotice: z.string().optional()
  })
});
export const collections = { records };
