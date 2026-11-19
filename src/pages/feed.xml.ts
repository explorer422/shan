import type { APIRoute } from 'astro';
import { generateRssFeed } from '../lib/feed';

export const GET: APIRoute = async ({ site, url }) => {
  const siteUrl = site ? site.toString() : url.origin;
  const xml = await generateRssFeed(siteUrl);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
