/// <reference types="vite/client" />
import { Podcast } from '../types';

// Simple memory cache
const searchCache = new Map<string, Podcast[]>();
const feedCache = new Map<string, any>();
const topCache = new Map<string, Podcast[]>();

export async function searchPodcasts(query: string): Promise<Podcast[]> {
  if (searchCache.has(query)) {
    return searchCache.get(query)!;
  }

  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search');
  const data = await res.json();
  const results = data.results || [];
  
  searchCache.set(query, results);
  return results;
}

export async function getTopPodcasts(genre?: string): Promise<Podcast[]> {
  const cacheKey = genre || 'all';
  if (topCache.has(cacheKey)) {
    return topCache.get(cacheKey)!;
  }

  const url = genre ? `/api/top?genre=${genre}` : '/api/top';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch top podcasts');
  const data = await res.json();
  const results = data.results || [];
  
  topCache.set(cacheKey, results);
  return results;
}

export async function getPodcastFeed(feedUrl: string): Promise<any> {
  if (feedCache.has(feedUrl)) {
    return feedCache.get(feedUrl);
  }

  const res = await fetch(`/api/feed?url=${encodeURIComponent(feedUrl)}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  const data = await res.json();
  
  feedCache.set(feedUrl, data);
  return data;
}
