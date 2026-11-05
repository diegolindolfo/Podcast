import { Chapter, Episode, Podcast } from './types';

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

/** Converts duration (number of seconds or HH:MM:SS / MM:SS string) into total seconds. */
export function parseDurationToSeconds(duration?: string | number): number | null {
  if (duration === undefined || duration === null || duration === '') return null;
  if (typeof duration === 'number') {
    return isFinite(duration) && duration > 0 ? duration : null;
  }
  const trimmed = duration.trim();
  if (trimmed.includes(':')) {
    return parseTimestampToSeconds(trimmed);
  }
  const num = Number(trimmed);
  return isFinite(num) && num > 0 ? num : null;
}

/** Strips HTML tags and decodes common HTML entities into clean plain text for previews. */
export function stripHtml(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
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

/**
 * Extracts chapters written in episode description/show notes.
 * Formats supported:
 * "00:00 - Introdução"
 * "05:12 O início do tema"
 * "(15:30) Conclusão"
 */
export function extractChaptersFromDescription(description: string): Chapter[] {
  if (!description) return [];

  const cleaned = description
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ');

  const lines = cleaned.split('\n');
  const chapters: Chapter[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Matches timestamps at beginning or enclosed in parens/brackets
    const match = line.match(/^(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))?\s*[-–—:]*\s*(.+)$/);
    if (match) {
      const ts = match[1];
      const title = match[2].trim().replace(/^[-–—:]\s*/, '');
      const seconds = parseTimestampToSeconds(ts);
      if (seconds !== null && title.length > 0) {
        chapters.push({
          startTime: seconds,
          title
        });
      }
    }
  }

  // Calculate endTime based on next chapter start
  for (let i = 0; i < chapters.length; i++) {
    if (i + 1 < chapters.length) {
      chapters[i].endTime = chapters[i + 1].startTime;
    }
  }

  return chapters.sort((a, b) => a.startTime - b.startTime);
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

  const rawDesc = item.contentSnippet || item.content || item['itunes:summary'] || item.summary || '';
  const descChapters = extractChaptersFromDescription(rawDesc);

  return {
    id: item.guid || item.link || item.title || `${podcast.collectionId}-${Date.now()}`,
    title: item.title || 'Sem título',
    pubDate: item.pubDate || new Date().toISOString(),
    description: rawDesc,
    audioUrl: item.enclosure?.url || '',
    duration: item['itunes:duration'],
    podcastId: podcast.collectionId,
    podcastName: podcast.collectionName,
    podcastArtwork: podcast.artworkUrl600,
    episodeArtwork,
    chapters: descChapters.length > 0 ? descChapters : undefined,
    chaptersUrl: item['podcast:chapters']?.$.url || item['psc:chapters']?.$.url || undefined
  };
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

export function generateOpml(subscriptions: Podcast[]): string {
  const dateStr = new Date().toUTCString();
  const outlines = subscriptions
    .map(p => `      <outline type="rss" text="${escapeXml(p.collectionName)}" title="${escapeXml(p.collectionName)}" xmlUrl="${escapeXml(p.feedUrl)}" htmlUrl="" />`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Podcast App Subscriptions</title>
    <dateCreated>${dateStr}</dateCreated>
  </head>
  <body>
    <outline text="feeds">
${outlines}
    </outline>
  </body>
</opml>`;
}

export function parseOpmlFeeds(opmlText: string): { title: string; xmlUrl: string }[] {
  const feeds: { title: string; xmlUrl: string }[] = [];
  const outlineRegex = /<outline\b([^>]+?)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = outlineRegex.exec(opmlText)) !== null) {
    const attrs = match[1];
    const xmlUrlMatch = attrs.match(/xmlUrl=["']([^"']+)["']/i);
    if (!xmlUrlMatch) continue;

    const titleMatch = attrs.match(/title=["']([^"']+)["']/i) || attrs.match(/text=["']([^"']+)["']/i);
    const title = titleMatch ? unescapeXml(titleMatch[1].trim()) : 'Podcast';
    const xmlUrl = unescapeXml(xmlUrlMatch[1].trim());

    if (xmlUrl && !feeds.some(f => f.xmlUrl === xmlUrl)) {
      feeds.push({ title, xmlUrl });
    }
  }

  return feeds;
}
