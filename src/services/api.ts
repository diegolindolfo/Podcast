/// <reference types="vite/client" />
import { Podcast } from '../types';
import { get as idbGet, set as idbSet } from 'idb-keyval';

// Simple memory cache
const searchCache = new Map<string, Podcast[]>();
const feedCache = new Map<string, any>();
const topCache = new Map<string, Podcast[]>();

export async function searchPodcasts(query: string): Promise<Podcast[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  let results: Podcast[] | null = null;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      results = data.results || [];
    }
  } catch {
    // Fallback to direct iTunes CORS API below
  }

  if (results === null) {
    const fallbackRes = await fetch(`https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(trimmed)}&country=br`);
    if (!fallbackRes.ok) throw new Error('Failed to search');
    const fallbackData = await fallbackRes.json();
    results = fallbackData.results || [];
  }

  searchCache.set(cacheKey, results);
  return results;
}

export async function getTopPodcasts(genre?: string): Promise<Podcast[]> {
  const cacheKey = genre || 'all';
  if (topCache.has(cacheKey)) {
    return topCache.get(cacheKey)!;
  }

  let results: Podcast[] | null = null;

  try {
    const url = genre ? `/api/top?genre=${encodeURIComponent(genre)}` : '/api/top';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      results = data.results || [];
    }
  } catch {
    // Fallback to direct iTunes CORS API below
  }

  if (results === null) {
    const sanitizedGenre = genre && /^\d+$/.test(genre) ? `/genre=${genre}` : '';
    const rssRes = await fetch(`https://itunes.apple.com/br/rss/toppodcasts/limit=50${sanitizedGenre}/json`);
    if (!rssRes.ok) throw new Error('Failed to fetch top podcasts');
    const rssData = await rssRes.json();
    const entries = rssData.feed?.entry || [];
    const ids = entries.map((e: any) => e.id?.attributes?.['im:id']).filter(Boolean).join(',');
    if (!ids) {
      results = [];
    } else {
      const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(ids)}&country=br`);
      if (!lookupRes.ok) throw new Error('Failed to fetch top podcasts');
      const lookupData = await lookupRes.json();
      results = lookupData.results || [];
    }
  }

  topCache.set(cacheKey, results);
  return results;
}

export async function getPodcastFeed(feedUrl: string): Promise<any> {
  if (feedCache.has(feedUrl)) {
    return feedCache.get(feedUrl);
  }

  try {
    const cached = await idbGet(`feed:${feedUrl}`);
    if (cached && typeof cached === 'object' && cached.timestamp && Date.now() - cached.timestamp < 15 * 60 * 1000) {
      feedCache.set(feedUrl, cached.data);
      return cached.data;
    }
  } catch (err) {
    console.warn('IDB cache read failed', err);
  }

  const res = await fetch(`/api/feed?url=${encodeURIComponent(feedUrl)}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  const data = await res.json();
  
  feedCache.set(feedUrl, data);
  try {
    await idbSet(`feed:${feedUrl}`, { timestamp: Date.now(), data });
  } catch (err) {
    console.warn('IDB cache write failed', err);
  }
  return data;
}
