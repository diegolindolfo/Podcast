import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  parseRssEpisode,
  parseTimestampToSeconds,
  splitTextWithTimestamps,
  generateOpml,
  parseOpmlFeeds
} from '../src/utils';
import { Podcast } from '../src/types';

describe('Utils', () => {
  describe('formatDuration', () => {
    test('formata segundos numéricos corretamente', () => {
      assert.equal(formatDuration(125), '2 min');
      assert.equal(formatDuration(3665), '1h 1m');
      assert.equal(formatDuration(7200), '2h 0m');
    });

    test('formata string HH:MM:SS', () => {
      assert.equal(formatDuration('01:30:15'), '1h 30m');
      assert.equal(formatDuration('00:45:00'), '45 min');
      assert.equal(formatDuration('25:10'), '25 min');
    });

    test('trata entradas vazias ou indefinidas', () => {
      assert.equal(formatDuration(undefined), '');
      assert.equal(formatDuration(''), '');
    });
  });

  describe('parseRssEpisode', () => {
    const mockPodcast: Podcast = {
      collectionId: 12345,
      collectionName: 'Podcast de Teste',
      artistName: 'Apresentador',
      artworkUrl600: 'https://example.com/cover600.jpg',
      feedUrl: 'https://example.com/feed.xml'
    };

    test('extrai campos básicos e enclosure de áudio', () => {
      const item = {
        guid: 'ep-001',
        title: 'Episódio Piloto',
        pubDate: '2026-11-01T12:00:00Z',
        contentSnippet: 'Descrição curta do episódio.',
        enclosure: {
          url: 'https://example.com/ep001.mp3'
        },
        'itunes:duration': '3600'
      };

      const episode = parseRssEpisode(item, mockPodcast);
      assert.equal(episode.id, 'ep-001');
      assert.equal(episode.title, 'Episódio Piloto');
      assert.equal(episode.audioUrl, 'https://example.com/ep001.mp3');
      assert.equal(episode.podcastId, 12345);
      assert.equal(episode.podcastName, 'Podcast de Teste');
      assert.equal(episode.podcastArtwork, 'https://example.com/cover600.jpg');
      assert.equal(episode.mediaType, 'audio');
    });

    test('detecta podcast em vídeo por enclosure type ou extensão .mp4', () => {
      const videoItem1 = {
        guid: 'vid-001',
        title: 'Videocast Especial',
        enclosure: {
          url: 'https://example.com/video.mp4',
          type: 'video/mp4'
        }
      };
      const ep1 = parseRssEpisode(videoItem1, mockPodcast);
      assert.equal(ep1.mediaType, 'video');

      const videoItem2 = {
        guid: 'vid-002',
        title: 'Videocast M4V',
        enclosure: {
          url: 'https://example.com/vodcast.m4v?token=123'
        }
      };
      const ep2 = parseRssEpisode(videoItem2, mockPodcast);
      assert.equal(ep2.mediaType, 'video');
    });

    test('respeita artwork específico do episódio', () => {
      const item = {
        title: 'Episódio com capa própria',
        enclosure: { url: 'https://example.com/audio.mp3' },
        'itunes:image': {
          $: { href: 'https://example.com/custom-art.jpg' }
        }
      };

      const episode = parseRssEpisode(item, mockPodcast);
      assert.equal(episode.episodeArtwork, 'https://example.com/custom-art.jpg');
    });
  });

  describe('Show Notes & Timestamps', () => {
    test('parseTimestampToSeconds converte MM:SS e HH:MM:SS', () => {
      assert.equal(parseTimestampToSeconds('05:30'), 330);
      assert.equal(parseTimestampToSeconds('1:02:03'), 3723);
      assert.equal(parseTimestampToSeconds('99:99'), null);
    });

    test('splitTextWithTimestamps limpa HTML e destaca timestamps', () => {
      const html = '<p>Intro em 00:30<br/>Bloco principal em 01:15:00!</p>';
      const segs = splitTextWithTimestamps(html);
      const timestamps = segs.filter(s => s.type === 'timestamp');
      assert.equal(timestamps.length, 2);
      assert.equal(timestamps[0].value, '00:30');
      assert.equal(timestamps[0].seconds, 30);
      assert.equal(timestamps[1].value, '01:15:00');
      assert.equal(timestamps[1].seconds, 4500);
    });
  });

  describe('OPML Export & Import', () => {
    test('generateOpml e parseOpmlFeeds fazem round-trip das inscrições', () => {
      const subs: Podcast[] = [
        {
          collectionId: 1,
          collectionName: 'Café & Código',
          artistName: 'Dev',
          artworkUrl600: 'https://example.com/a.jpg',
          feedUrl: 'https://example.com/cafe.xml?a=1&b=2'
        },
        {
          collectionId: 2,
          collectionName: 'Histórias',
          artistName: 'Host',
          artworkUrl600: 'https://example.com/b.jpg',
          feedUrl: 'https://example.com/historias.xml'
        }
      ];

      const xml = generateOpml(subs);
      const parsed = parseOpmlFeeds(xml);
      assert.equal(parsed.length, 2);
      assert.deepEqual(parsed[0], {
        title: 'Café & Código',
        xmlUrl: 'https://example.com/cafe.xml?a=1&b=2'
      });
      assert.deepEqual(parsed[1], {
        title: 'Histórias',
        xmlUrl: 'https://example.com/historias.xml'
      });
    });
  });
});
