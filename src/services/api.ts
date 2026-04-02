/// <reference types="vite/client" />
import { Podcast } from '../types';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

function setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number, maxSize: number): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  if (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

function getCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

const CACHE_CONFIG = {
  search: { ttlMs: 10 * 60 * 1000, maxSize: 100 },
  feed: { ttlMs: 5 * 60 * 1000, maxSize: 100 },
  top: { ttlMs: 15 * 60 * 1000, maxSize: 50 },
};

const searchCache = new Map<string, CacheEntry<Podcast[]>>();
const feedCache = new Map<string, CacheEntry<any>>();
const topCache = new Map<string, CacheEntry<Podcast[]>>();

export function clearApiCache(): void {
  searchCache.clear();
  feedCache.clear();
  topCache.clear();
}

export async function searchPodcasts(query: string): Promise<Podcast[]> {
  const cached = getCacheValue(searchCache, query);
  if (cached) return cached;

  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search');
  const data = await res.json();
  const results = data.results || [];

  setCacheValue(searchCache, query, results, CACHE_CONFIG.search.ttlMs, CACHE_CONFIG.search.maxSize);
  return results;
}

export async function getTopPodcasts(genre?: string): Promise<Podcast[]> {
  const cacheKey = genre || 'all';
  const cached = getCacheValue(topCache, cacheKey);
  if (cached) return cached;

  const url = genre ? `/api/top?genre=${encodeURIComponent(genre)}` : '/api/top';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch top podcasts');
  const data = await res.json();
  const results = data.results || [];

  setCacheValue(topCache, cacheKey, results, CACHE_CONFIG.top.ttlMs, CACHE_CONFIG.top.maxSize);
  return results;
}

export async function getPodcastFeed(feedUrl: string): Promise<any> {
  const cached = getCacheValue(feedCache, feedUrl);
  if (cached) return cached;

  const res = await fetch(`/api/feed?url=${encodeURIComponent(feedUrl)}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  const data = await res.json();

  setCacheValue(feedCache, feedUrl, data, CACHE_CONFIG.feed.ttlMs, CACHE_CONFIG.feed.maxSize);
  return data;
}
