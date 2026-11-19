import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { formatDate } from '../lib/date';

export const GET: APIRoute = async () => {
  const allStories = await getCollection('stories', ({ data }) => !data.draft);
  const allMoments = await getCollection('moments', ({ data }) => !data.draft);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const storyItems = allStories.map((s) => ({
    type: 'story',
    id: s.id,
    url: `${base}/stories/${s.id}/`,
    title: s.data.title,
    date: formatDate(s.data.date),
    tags: s.data.tags,
    excerpt: s.data.excerpt,
    body: s.body || '',
  }));

  const momentItems = allMoments.map((m) => ({
    type: 'moment',
    id: m.id,
    url: `${base}/moments/${m.id}/`,
    title: m.data.title || 'Untitled moment',
    date: formatDate(m.data.date),
    tags: m.data.tags,
    location: m.data.location,
    excerpt: m.data.caption,
    body: m.body || '',
  }));

  const data = [...storyItems, ...momentItems];
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
