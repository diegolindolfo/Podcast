import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  parseDurationToSeconds,
  stripHtml,
  parseRssEpisode,
  parseTimestampToSeconds,
  splitTextWithTimestamps,
  extractChaptersFromDescription,
  generateOpml,
  parseOpmlFeeds
} from '../src/utils';
import { parseId3Chapters } from '../src/services/chapters';
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

    test('parseDurationToSeconds converte segundos e HH:MM:SS', () => {
      assert.equal(parseDurationToSeconds(3600), 3600);
      assert.equal(parseDurationToSeconds('5317'), 5317);
      assert.equal(parseDurationToSeconds('01:30:00'), 5400);
      assert.equal(parseDurationToSeconds('25:10'), 1510);
      assert.equal(parseDurationToSeconds(undefined), null);
    });

    test('stripHtml remove tags HTML e entidades', () => {
      assert.equal(stripHtml('<p>Olá&nbsp;<b>mundo</b> &amp; amigos!</p>'), 'Olá mundo & amigos!');
      assert.equal(stripHtml(''), '');
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

    test('extrai capítulos estruturados a partir da descrição', () => {
      const item = {
        title: 'Episódio com Capítulos nas Notas',
        enclosure: { url: 'https://example.com/audio.mp3' },
        content: `
          Boas-vindas a todos!
          00:00 - Introdução e Abertura
          05:12 - O Grande Tema da Semana
          01:02:30 - Considerações Finais
        `
      };

      const episode = parseRssEpisode(item, mockPodcast);
      assert.ok(episode.chapters);
      assert.equal(episode.chapters.length, 3);
      assert.equal(episode.chapters[0].title, 'Introdução e Abertura');
      assert.equal(episode.chapters[0].startTime, 0);
      assert.equal(episode.chapters[0].endTime, 312);
      assert.equal(episode.chapters[1].title, 'O Grande Tema da Semana');
      assert.equal(episode.chapters[1].startTime, 312);
      assert.equal(episode.chapters[1].endTime, 3750);
      assert.equal(episode.chapters[2].title, 'Considerações Finais');
      assert.equal(episode.chapters[2].startTime, 3750);
    });
  });

  describe('extractChaptersFromDescription', () => {
    test('extrai timestamps em formato (MM:SS) e [HH:MM:SS]', () => {
      const text = `
        (00:00) Início
        [10:15] Discussão
        01:20:00 Encerramento
      `;
      const chaps = extractChaptersFromDescription(text);
      assert.equal(chaps.length, 3);
      assert.equal(chaps[0].startTime, 0);
      assert.equal(chaps[0].title, 'Início');
      assert.equal(chaps[1].startTime, 615);
      assert.equal(chaps[1].title, 'Discussão');
      assert.equal(chaps[2].startTime, 4800);
      assert.equal(chaps[2].title, 'Encerramento');
    });

    test('retorna array vazio quando não há timestamps no texto', () => {
      const chaps = extractChaptersFromDescription('Apenas um texto comum sem horários.');
      assert.deepEqual(chaps, []);
    });
  });

  describe('parseId3Chapters', () => {
    test('extrai capítulos a partir de buffer sintético ID3v2.3 com tags CHAP', () => {
      // Cria um cabeçalho ID3v2.3 simples com um frame CHAP
      const chapElemId = 'ch0\0';
      const chapSubId = 'TIT2';
      const titleText = '\0Primeiro Bloco'; // enc 0 (iso-8859-1) + texto
      const subFrameSize = titleText.length;
      
      const chapPayload = Buffer.concat([
        Buffer.from(chapElemId, 'latin1'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // startTimeMs = 0
        Buffer.from([0x00, 0x00, 0xEA, 0x60]), // endTimeMs = 60000 (1 min)
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]), // startOffsetBytes = -1
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]), // endOffsetBytes = -1
        // Subframe TIT2
        Buffer.from(chapSubId, 'latin1'),
        Buffer.from([0x00, 0x00, 0x00, subFrameSize]),
        Buffer.from([0x00, 0x00]), // flags
        Buffer.from(titleText, 'latin1')
      ]);

      const frameSize = chapPayload.length;
      const id3Header = Buffer.from([
        0x49, 0x44, 0x33, // ID3
        0x03, 0x00,       // v2.3.0
        0x00,             // flags
        0x00, 0x00, 0x01, 0x00 // tagSize syncsafe
      ]);

      const chapFrameHeader = Buffer.concat([
        Buffer.from('CHAP', 'latin1'),
        Buffer.from([0x00, 0x00, 0x00, frameSize]),
        Buffer.from([0x00, 0x00]) // flags
      ]);

      const buffer = Buffer.concat([id3Header, chapFrameHeader, chapPayload]);
      const chapters = parseId3Chapters(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

      assert.equal(chapters.length, 1);
      assert.equal(chapters[0].title, 'Primeiro Bloco');
      assert.equal(chapters[0].startTime, 0);
      assert.equal(chapters[0].endTime, 60);
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
