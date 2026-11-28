/** Hashtags typed freely ("#LayerCake anniv, lyon") -> clean list, mirrored by the database. */

export const MAX_HASHTAGS = 10;
export const MAX_HASHTAG_LENGTH = 30;

export function parseHashtags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[\s,;#]+/)) {
    const tag = raw
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, MAX_HASHTAG_LENGTH);
    if (tag) seen.add(tag);
    if (seen.size === MAX_HASHTAGS) break;
  }
  return [...seen];
}

export function hashtagsToInput(tags: string[]): string {
  return tags.map((t) => `#${t}`).join(' ');
}
