import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, parseRssEpisode } from '../src/utils';
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
      assert.equal(episode.episodeArtwork, 'https://example.com/cover600.jpg');
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
});
