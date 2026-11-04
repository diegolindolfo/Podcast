# Podcast App (PWA)

Aplicativo web progressivo (PWA) de podcasts em português, com busca via iTunes/Apple Podcasts, leitura de feeds RSS, reprodução em segundo plano (Media Session API), fila de reprodução, timer com fade-out e downloads para escuta offline.

## Recursos

- **Descoberta e Busca:** Top podcasts do Brasil por categoria e busca integrada via Apple Podcasts API.
- **Player Completo:** Controle de velocidade (0.8x a 2.5x), avanço/retrocesso configurável, fila de reprodução, retomada automática de progresso e Sleep Timer com redução gradual de volume.
- **Modo Offline (PWA):** Download de episódios no Cache Storage com reprodução via Service Worker (suporte a HTTP Range) e fallback automático de proxy para CDNs sem CORS.
- **Backend Unificado:** Rotas compartilhadas entre servidor local (`server.ts` com cache SQLite) e deploy serverless na Vercel (`api/index.ts` com cache em memória), incluindo proteção contra SSRF e rate limiting.

## Executando Localmente

**Pré-requisitos:** Node.js 20+

1. Instale as dependências:
   ```bash
   npm install
   ```
2. (Opcional) Configure as chaves VAPID no arquivo `.env` a partir do `.env.example` para testar o envio de Web Push pelo servidor.
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acesse `http://localhost:3000`.

## Scripts Disponíveis

- `npm run dev` — Inicia o servidor Express + Vite em modo de desenvolvimento.
- `npm run build` — Gera o bundle de produção e o Service Worker da PWA em `dist/`.
- `npm start` — Inicia o servidor em modo de produção servindo `dist/`.
- `npm test` — Executa a suíte de testes automatizados (`tests/`).
- `npm run lint` — Verifica tipos TypeScript (`tsc --noEmit`).
