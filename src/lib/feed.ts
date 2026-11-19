import { getCollection } from 'astro:content';

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

export async function generateRssFeed(siteUrl: string): Promise<string> {
  const stories = await getCollection('stories', ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  });
  const moments = await getCollection('moments', ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  });

  interface FeedItem {
    title: string;
    link: string;
    guid: string;
    pubDate: string;
    description: string;
    timestamp: number;
  }

  const cleanSite = siteUrl.replace(/\/$/, '');

  const items: FeedItem[] = [
    ...stories.map((s) => ({
      title: s.data.title,
      link: `${cleanSite}/stories/${s.id}/`,
      guid: `shan-story-${s.id}`,
      pubDate: s.data.date.toUTCString(),
      description: s.data.excerpt,
      timestamp: s.data.date.getTime(),
    })),
    ...moments.map((m) => ({
      title: m.data.title || 'Untitled moment',
      link: `${cleanSite}/moments/${m.id}/`,
      guid: `shan-moment-${m.id}`,
      pubDate: m.data.date.toUTCString(),
      description: m.data.caption,
      timestamp: m.data.date.getTime(),
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const xmlItems = items
    .map((item) => {
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
        `      <pubDate>${item.pubDate}</pubDate>`,
        `      <description>${escapeXml(item.description)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>SHAN — Stories &amp; Moments</title>',
    '    <description>',
    '      Notes along the way — stories &amp; moments.',
    '    </description>',
    `    <link>${escapeXml(cleanSite)}/</link>`,
    xmlItems,
    '  </channel>',
    '</rss>',
  ].join('\n');
}
