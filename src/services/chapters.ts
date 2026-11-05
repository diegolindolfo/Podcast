import { Chapter } from '../types';

/**
 * Extracts chapters from ID3v2 tags (CHAP frames) inside an MP3/M4A file buffer.
 */
export function parseId3Chapters(buffer: ArrayBuffer): Chapter[] {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10) return [];

  // Check ID3 magic bytes
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return [];
  }

  const version = bytes[3]; // e.g. 3 for ID3v2.3, 4 for ID3v2.4
  // ID3v2 syncsafe size
  const tagSize = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const maxOffset = Math.min(bytes.length, tagSize + 10);

  let offset = 10;
  const rawChapters: { startTime: number; endTime?: number; title: string; url?: string }[] = [];

  while (offset + 10 < maxOffset) {
    // Check for padding (zeros)
    if (bytes[offset] === 0) break;

    const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    let frameSize = 0;
    if (version === 4) {
      // ID3v2.4 uses syncsafe integers for frame sizes
      frameSize = ((bytes[offset + 4] & 0x7f) << 21) | ((bytes[offset + 5] & 0x7f) << 14) | ((bytes[offset + 6] & 0x7f) << 7) | (bytes[offset + 7] & 0x7f);
    } else {
      // ID3v2.3 uses regular 32-bit big-endian
      frameSize = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
    }

    offset += 10;
    if (frameSize <= 0 || offset + frameSize > bytes.length) break;

    if (frameId === 'CHAP') {
      try {
        // Element ID: null-terminated ASCII string
        let elemIdEnd = offset;
        while (elemIdEnd < offset + frameSize && bytes[elemIdEnd] !== 0) {
          elemIdEnd++;
        }

        let pos = elemIdEnd + 1;
        if (pos + 16 <= offset + frameSize) {
          const startTimeMs = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
          pos += 4;
          const endTimeMs = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
          pos += 4;
          // Skip startOffsetBytes (4) and endOffsetBytes (4)
          pos += 8;

          // Parse subframes (TIT2 for title, WXXX/WOAR for URL)
          let chapterTitle = '';
          let chapterUrl = '';

          while (pos + 10 < offset + frameSize) {
            if (bytes[pos] === 0) break;
            const subId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
            let subSize = 0;
            if (version === 4) {
              subSize = ((bytes[pos + 4] & 0x7f) << 21) | ((bytes[pos + 5] & 0x7f) << 14) | ((bytes[pos + 6] & 0x7f) << 7) | (bytes[pos + 7] & 0x7f);
            } else {
              subSize = (bytes[pos + 4] << 24) | (bytes[pos + 5] << 16) | (bytes[pos + 6] << 8) | bytes[pos + 7];
            }
            pos += 10;
            if (subSize <= 0 || pos + subSize > offset + frameSize) break;

            if (subId === 'TIT2') {
              const enc = bytes[pos];
              const textBytes = bytes.slice(pos + 1, pos + subSize);
              if (enc === 0) {
                // ISO-8859-1
                chapterTitle = new TextDecoder('latin1').decode(textBytes);
              } else if (enc === 1) {
                // UTF-16 with BOM
                chapterTitle = new TextDecoder('utf-16').decode(textBytes);
              } else if (enc === 2) {
                // UTF-16BE
                chapterTitle = new TextDecoder('utf-16be').decode(textBytes);
              } else {
                // UTF-8
                chapterTitle = new TextDecoder('utf-8').decode(textBytes);
              }
              chapterTitle = chapterTitle.replace(/\0/g, '').trim();
            } else if (subId === 'WXXX' || subId === 'WOAR') {
              try {
                chapterUrl = new TextDecoder('latin1').decode(bytes.slice(pos + 1, pos + subSize)).replace(/\0/g, '').trim();
              } catch {}
            }

            pos += subSize;
          }

          rawChapters.push({
            title: chapterTitle || `Capítulo ${rawChapters.length + 1}`,
            startTime: Math.max(0, Math.floor(startTimeMs / 1000)),
            endTime: endTimeMs > startTimeMs ? Math.floor(endTimeMs / 1000) : undefined,
            url: chapterUrl || undefined
          });
        }
      } catch (err) {
        console.warn('Error parsing CHAP frame:', err);
      }
    }

    offset += frameSize;
  }

  return rawChapters.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Cache for fetched ID3 chapters so we only perform HTTP range requests once per audio URL.
 */
const chaptersCache = new Map<string, Chapter[]>();

/**
 * Fetches the first 128 KB of an audio file via an HTTP Range request to extract ID3 chapters.
 */
export async function fetchRemoteAudioChapters(audioUrl: string): Promise<Chapter[]> {
  if (!audioUrl) return [];
  if (chaptersCache.has(audioUrl)) {
    return chaptersCache.get(audioUrl)!;
  }

  try {
    const res = await fetch(audioUrl, {
      headers: {
        Range: 'bytes=0-131071' // First 128 KB
      }
    });

    if (res.ok || res.status === 206) {
      const buffer = await res.arrayBuffer();
      const chapters = parseId3Chapters(buffer);
      if (chapters.length > 0) {
        chaptersCache.set(audioUrl, chapters);
        return chapters;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch remote audio chapters via Range header:', err);
  }

  return [];
}
