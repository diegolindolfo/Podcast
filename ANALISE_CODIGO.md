# Análise técnica do projeto Podcast

## Escopo analisado
- Backend/API (`server.ts`, `api/index.ts`)
- Estado e persistência local (`src/store.ts`)
- Camada de serviços (`src/services/api.ts`, `src/services/downloader.ts`)
- Qualidade de build e tipagem (scripts `npm run lint` e `npm run build`)

## Pontos fortes
1. **Tipagem consistente no frontend** com TypeScript + Zustand, incluindo ações assíncronas bem separadas por domínio (downloads, histórico, configurações).
2. **Resiliência básica no parsing de feed** via timeout/abort no endpoint `/api/feed`.
3. **Persistência offline** usando Cache API + `idb-keyval`, aderente à proposta de app de podcasts.
4. **Build e typecheck passam atualmente** (`tsc --noEmit` e `vite build`).

## Riscos e oportunidades (priorizados)

### 1) Segurança: segredo VAPID hardcoded no repositório (Alta)
No backend, há fallback com `publicKey` e **`privateKey`** VAPID embutidos no código. Isso expõe credenciais sensíveis e permite abuso de push caso o código seja público.

**Recomendação:**
- Remover os fallbacks hardcoded.
- Falhar o boot do servidor se as env vars não existirem.
- Rotacionar imediatamente as chaves já expostas.

## 2) Segurança: endpoint `/api/feed` potencialmente vulnerável a SSRF (Alta)
O endpoint recebe `url` de querystring e faz `fetch` direto, sem allowlist, validação de protocolo/host nem bloqueio de IPs internos.

**Recomendação:**
- Validar URL (`http/https` apenas).
- Bloquear destinos internos/privados (`localhost`, `127.0.0.1`, ranges RFC1918, metadata endpoints).
- Preferir allowlist de domínios ou proxy com políticas rígidas.
- Adicionar limites de tamanho de resposta e content-type.

## 3) Arquitetura: duplicação de lógica da API (`server.ts` e `api/index.ts`) (Média)
Há endpoints semelhantes em dois locais diferentes. Isso aumenta custo de manutenção e risco de divergência de comportamento em deploy local vs serverless.

**Recomendação:**
- Extrair handlers compartilhados para módulo único.
- Reusar handlers tanto no Express principal quanto na entrada serverless.

## 4) Qualidade/UX: estratégia de cache sem invalidação (Média)
Em `src/services/api.ts`, os caches em memória (`Map`) não têm TTL, limite de tamanho nem invalidação por contexto. Isso pode causar stale data e consumo crescente de memória durante sessões longas.

**Recomendação:**
- Implementar TTL por chave (ex.: 5–15 min para busca/top, menor para feed).
- Limitar tamanho (LRU simples).
- Expor função de `clearCache` quando usuário fizer refresh manual.

## 5) Eficiência: import dinâmico não gera split real (Média)
O build acusa que módulos importados dinamicamente também são importados estaticamente, anulando benefício de code splitting.

**Recomendação:**
- Escolher apenas um padrão por módulo (dinâmico **ou** estático).
- Se necessário, separar utilitários pesados em módulos exclusivos para lazy load.

## 6) Higiene de código: import não utilizado (Baixa)
`del` é importado de `idb-keyval` em `src/store.ts` e não é usado.

**Recomendação:**
- Remover import para reduzir ruído e evitar dívida técnica incremental.

## Próximos passos sugeridos
1. Corrigir segurança (VAPID + SSRF) antes de novas features.
2. Consolidar camada de API para evitar duplicação.
3. Implementar política de cache com TTL + limite.
4. Revisar estratégia de chunking para reduzir bundle inicial.

## Comandos executados
- `npm run lint`
- `npm run build`
