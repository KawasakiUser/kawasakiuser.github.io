import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const records = defineCollection({loader:glob({pattern:'**/*.json',base:'./src/data/public'}),schema:z.object({
 entity:z.enum(['Project','ArchiveRecord','Note','Collaboration','Link']), permanentId:z.string().regex(/^(PRJ|ARC|NOT|COL|LNK)-\d{4}$/), locale:z.enum(['en','zh']), slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), publicationStatus:z.enum(['Draft','Published','Withdrawn']), title:z.string().min(1), sourceLocale:z.enum(['en','zh']), primaryType:z.string().optional(), lifecycle:z.string().optional(), goal:z.string().optional(), summary:z.string().optional(), date:z.string().optional(), archiveKind:z.enum(['Work','Milestone']).optional(), projectIds:z.array(z.string()).default([]), publishedAt:z.string().optional()
})});
export const collections={records};
