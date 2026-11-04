import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSafeUrl, readTextLimited } from '../api/ssrf';

describe('SSRF Protection', () => {
  test('deve bloquear localhost e subdomínios .localhost/.local/.internal', async () => {
    await assert.rejects(
      async () => validateSafeUrl('http://localhost:3000/api/health'),
      /restrito ou não permitido/i
    );
    await assert.rejects(
      async () => validateSafeUrl('http://admin.localhost/secret'),
      /restrito ou não permitido/i
    );
    await assert.rejects(
      async () => validateSafeUrl('http://metadata.internal/token'),
      /restrito ou não permitido/i
    );
  });

  test('deve bloquear loopback IPv4 (127.0.0.1) e IPv6 ([::1], [::ffff:127.0.0.1])', async () => {
    await assert.rejects(
      async () => validateSafeUrl('http://127.0.0.1:8080/secret'),
      /privado não permitido/i
    );
    await assert.rejects(
      async () => validateSafeUrl('http://[::1]:8080/secret'),
      /privado não permitido/i
    );
    await assert.rejects(
      async () => validateSafeUrl('http://[::ffff:127.0.0.1]/secret'),
      /privado não permitido/i
    );
  });

  test('deve bloquear endereço de metadados de nuvem 169.254.169.254', async () => {
    await assert.rejects(
      async () => validateSafeUrl('http://169.254.169.254/latest/meta-data'),
      /privado não permitido/i
    );
  });

  test('deve bloquear faixa privada 10.0.0.1 e 192.168.1.1', async () => {
    await assert.rejects(
      async () => validateSafeUrl('http://10.0.0.1/admin'),
      /privado não permitido/i
    );
    await assert.rejects(
      async () => validateSafeUrl('http://192.168.1.1/router'),
      /privado não permitido/i
    );
  });

  test('deve rejeitar protocolos que não sejam http ou https', async () => {
    await assert.rejects(
      async () => validateSafeUrl('file:///etc/passwd'),
      /Apenas HTTP e HTTPS são suportados/i
    );
    await assert.rejects(
      async () => validateSafeUrl('ftp://example.com/audio.mp3'),
      /Apenas HTTP e HTTPS são suportados/i
    );
  });

  test('deve aceitar URLs públicas válidas', async () => {
    const url = await validateSafeUrl('https://example.com/feed.xml');
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'example.com');
  });

  test('readTextLimited interrompe respostas que excedem o limite em streaming', async () => {
    const bigChunk = new Uint8Array(1024).fill(65);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bigChunk);
        controller.enqueue(bigChunk);
        controller.close();
      }
    });
    const fakeResponse = new Response(stream);
    await assert.rejects(
      async () => readTextLimited(fakeResponse, 1500),
      (err: any) => err.code === 'TOO_LARGE'
    );
  });
});
