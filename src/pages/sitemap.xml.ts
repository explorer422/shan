import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { tagToSlug } from '../lib/tag';

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export const GET: APIRoute = async ({ site, url }) => {
  const siteUrl = site ? site.toString() : url.origin;
  const cleanSite = siteUrl.replace(/\/$/, '');

  const stories = await getCollection('stories', ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  });
  const moments = await getCollection('moments', ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  });

  const tagSet = new Set<string>();
  for (const s of stories) {
    for (const t of s.data.tags || []) {
      tagSet.add(tagToSlug(t));
    }
  }
  for (const m of moments) {
    for (const t of m.data.tags || []) {
      tagSet.add(tagToSlug(t));
    }
  }
  const tags = Array.from(tagSet).sort();

  interface SitemapEntry {
    loc: string;
    lastmod?: string;
  }

  const entries: SitemapEntry[] = [
    { loc: `${cleanSite}/` },
    { loc: `${cleanSite}/stories/` },
    ...stories.map((s) => ({
      loc: `${cleanSite}/stories/${s.id}/`,
      lastmod: s.data.date.toISOString().split('T')[0],
    })),
    { loc: `${cleanSite}/moments/` },
    ...moments.map((m) => ({
      loc: `${cleanSite}/moments/${m.id}/`,
      lastmod: m.data.date.toISOString().split('T')[0],
    })),
    { loc: `${cleanSite}/about/` },
    { loc: `${cleanSite}/tags/` },
    ...tags.map((t) => ({
      loc: `${cleanSite}/tags/${t}/`,
    })),
  ];

  const xmlEntries = entries
    .map((e) => {
      const locTag = `    <loc>${escapeXml(e.loc)}</loc>`;
      const modTag = e.lastmod
        ? `\n    <lastmod>${e.lastmod}</lastmod>`
        : '';
      return `  <url>\n${locTag}${modTag}\n  </url>`;
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    xmlEntries,
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
