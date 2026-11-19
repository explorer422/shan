import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const mediaItemSchema = z.object({
  id: z.string().describe('Logical portable media ID'),
  alt: z.string().default(''),
  caption: z.string().optional(),
  aspectRatio: z.string().optional(),
});

export type MediaItemRef = z.infer<typeof mediaItemSchema>;

export const stories = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/stories',
  }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    excerpt: z.string(),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    coverMedia: mediaItemSchema,
    tags: z.array(z.string()).default([]),
    lang: z.enum(['en', 'zh-Hant', 'ja']).default('en'),
    readingTime: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    relatedStories: z.array(z.string()).default([]),
  }),
});

export const moments = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/moments',
  }),
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date(),
    location: z.string().optional(),
    caption: z.string(),
    media: z.array(mediaItemSchema).min(1),
    tags: z.array(z.string()).default([]),
    weather: z.string().optional(),
    mood: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  stories,
  moments,
};
