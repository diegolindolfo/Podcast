import dns from 'dns/promises';
import net from 'net';

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link Local / Cloud metadata like AWS/GCP 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (Carrier NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // Broadcast / Multicast
    if (parts[0] >= 224) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // IPv4-mapped IPv6 in dotted form (::ffff:127.0.0.1)
    const mappedDotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedDotted) return isPrivateIp(mappedDotted[1]);
    // IPv4-mapped IPv6 normalized by WHATWG URL into hex form (::ffff:7f00:1)
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateIp(`${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`);
    }
    // fc00::/7 (Unique local)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // fe80::/10 (Link-local)
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    return false;
  }

  return true;
}

export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protocolo não permitido. Apenas HTTP e HTTPS são suportados.');
  }

  // URL.hostname keeps brackets for IPv6 literals
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Endereço de destino restrito ou não permitido.');
  }

  // Se já for um IP literal
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Endereço IP privado não permitido.');
    }
    return parsed;
  }

  // Resolve DNS para validar IP de destino real
  let lookupResult: { address: string }[];
  try {
    lookupResult = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Falha ao resolver o domínio de destino.');
  }
  for (const record of lookupResult) {
    if (isPrivateIp(record.address)) {
      throw new Error('Endereço IP resolvido pertence a uma rede interna restrita.');
    }
  }

  return parsed;
}

const MAX_REDIRECTS = 5;

/**
 * fetch() that validates the destination of every redirect hop, so a public URL
 * cannot bounce the server into an internal address.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await validateSafeUrl(current);
    const response = await fetch(url.toString(), { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      // Discard redirect body and follow manually
      response.body?.cancel().catch(() => {});
      current = new URL(location, url).toString();
      continue;
    }
    return response;
  }
  throw new Error('Muitos redirecionamentos.');
}

/** Reads a response body as text, aborting if it exceeds maxBytes (works with chunked responses). */
export async function readTextLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw Object.assign(new Error('Resposta excede o tamanho máximo permitido.'), { code: 'TOO_LARGE' });
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
