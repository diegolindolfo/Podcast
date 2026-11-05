import { Episode, Podcast } from './types';

export function formatDuration(duration?: string | number): string {
  if (!duration) return '';
  
  // If it's already in HH:MM:SS format
  if (typeof duration === 'string' && duration.includes(':')) {
    const parts = duration.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes} min`;
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      return `${minutes} min`;
    }
    return duration;
  }

  // If it's a number (seconds)
  const seconds = typeof duration === 'string' ? parseInt(duration, 10) : duration;
  if (isNaN(seconds)) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

export function parseRssEpisode(item: any, podcast: Podcast): Episode {
  let episodeArtwork = podcast.artworkUrl600;
  if (item['itunes:image'] && typeof item['itunes:image'] === 'object' && item['itunes:image'].$) {
    episodeArtwork = item['itunes:image'].$.href;
  } else if (typeof item['itunes:image'] === 'string') {
    episodeArtwork = item['itunes:image'];
  } else if (item.itunes?.image) {
    episodeArtwork = item.itunes.image;
  }

  const rawUrl: string = item.enclosure?.url || '';
  const enclosureType: string = (item.enclosure?.type || '').toLowerCase();
  const isVideo =
    enclosureType.startsWith('video/') ||
    /\.(mp4|m4v|mov|webm|mkv)(\?.*)?$/i.test(rawUrl);

  return {
    id: item.guid || item.link || item.title || `${podcast.collectionId}-${Date.now()}`,
    title: item.title || 'Sem título',
    pubDate: item.pubDate || new Date().toISOString(),
    description: item.contentSnippet || item.content || item['itunes:summary'] || item.summary || '',
    audioUrl: rawUrl,
    duration: item['itunes:duration'],
    podcastId: podcast.collectionId,
    podcastName: podcast.collectionName,
    podcastArtwork: podcast.artworkUrl600,
    episodeArtwork,
    mediaType: isVideo ? 'video' : 'audio'
  };
}

/** Converts a timestamp string like "1:05:30" or "15:30" into seconds. */
export function parseTimestampToSeconds(ts: string): number | null {
  const parts = ts.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  return null;
}

export interface TextSegment {
  type: 'text' | 'timestamp';
  value: string;
  seconds?: number;
}

/**
 * Strips HTML tags into readable plain text and splits out timestamps (MM:SS or HH:MM:SS)
 * so they can be rendered as interactive seek buttons without dangerouslySetInnerHTML.
 */
export function splitTextWithTimestamps(raw: string): TextSegment[] {
  if (!raw) return [];
  const cleaned = raw
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const regex = /\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/g;
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    const seconds = parseTimestampToSeconds(match[0]);
    if (seconds === null) continue;
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: cleaned.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'timestamp', value: match[0], seconds });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < cleaned.length) {
    segments.push({ type: 'text', value: cleaned.slice(lastIndex) });
  }

  return segments;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Generates a standard OPML 2.0 XML document from a list of subscribed podcasts. */
export function generateOpml(podcasts: Podcast[]): string {
  const outlines = podcasts
    .filter(p => p.feedUrl)
    .map(
      p =>
        `      <outline type="rss" text="${escapeXml(p.collectionName)}" title="${escapeXml(p.collectionName)}" xmlUrl="${escapeXml(p.feedUrl)}" />`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Podcast App Subscriptions</title>
  </head>
  <body>
    <outline text="feeds">
${outlines}
    </outline>
  </body>
</opml>
`;
}

export interface OpmlFeedEntry {
  title: string;
  xmlUrl: string;
}

/** Parses <outline ... xmlUrl="..." /> entries from an OPML XML string. */
export function parseOpmlFeeds(xmlText: string): OpmlFeedEntry[] {
  if (!xmlText) return [];
  const entries: OpmlFeedEntry[] = [];
  const seen = new Set<string>();
  const outlineRegex = /<outline\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = outlineRegex.exec(xmlText)) !== null) {
    const attrs = match[1];
    const urlMatch = attrs.match(/\bxmlUrl\s*=\s*["']([^"']+)["']/i);
    if (!urlMatch) continue;
    const xmlUrl = unescapeXml(urlMatch[1].trim());
    if (!xmlUrl || seen.has(xmlUrl)) continue;
    seen.add(xmlUrl);

    const titleMatch =
      attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i) ||
      attrs.match(/\btext\s*=\s*["']([^"']+)["']/i);
    const title = titleMatch ? unescapeXml(titleMatch[1].trim()) : xmlUrl;
    entries.push({ title, xmlUrl });
  }

  return entries;
}
