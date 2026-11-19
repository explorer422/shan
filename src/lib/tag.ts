export function tagToSlug(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, '-');
}

export function getActiveTags(
  entries: Array<{ data: { tags?: string[] } }>
): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const list = entry.data.tags || [];
    for (const tag of list) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}
