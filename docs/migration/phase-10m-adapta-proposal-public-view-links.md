# Fase 10M - Adaptacao de `proposal-public-view` para `proposal_public_links`

## 1) Objetivo

Adaptar a Edge Function `proposal-public-view` para resolver acesso publico por `token_hash` na tabela `public.proposal_public_links`, consultando em seguida `public.proposals` e `public.proposal_items`, sem deploy e sem testes HTTP.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch da fase: `phase-10m-adapta-proposal-public-view-links`
- Escopo da fase: alteracao de codigo da funcao + documentacao

## 3) Project ref

Confirmado via `npx supabase projects list`:

- `cansbrrwrprcycjvgvqm` (`crm-qualyvac-staging`)

## 4) Arquivos alterados

- `supabase/functions/proposal-public-view/index.ts`
- `docs/migration/phase-10m-adapta-proposal-public-view-links.md`

## 5) Logica anterior

A funcao recebia token bruto e consultava diretamente `public.proposals` por `approval_token`, validando expiracao via `approval_token_expires_at`.

## 6) Nova logica

Nova sequencia de resolucao:

1. Recebe token bruto no body (`POST`);
2. Normaliza e valida formato/tamanho;
3. Calcula hash SHA-256 em hexadecimal;
4. Busca em `public.proposal_public_links` por `token_hash`;
5. Exige link:
   - `status = 'active'`
   - `revoked_at is null`
   - `expires_at > now()`
   - `token_hash_alg = 'sha256'`
6. Valida `max_access_count` (quando definido);
7. Resolve `proposal_id`;
8. Busca proposta em `public.proposals` por `id`;
9. Busca itens em `public.proposal_items` por `proposal_id`;
10. Retorna payload publico reduzido.

## 7) Como o token e validado

Mantidos hardenings:

- Apenas `POST` e `OPTIONS`;
- Rejeicao de metodo invalido (`405` + `Allow`);
- Validacao de presenca;
- Validacao de comprimento (`TOKEN_MIN_LENGTH`/`TOKEN_MAX_LENGTH`);
- Validacao de formato (`TOKEN_FORMAT_REGEX`);
- Erro generico para link invalido/inexistente/expirado;
- Sem stack trace em resposta.

## 8) Como o hash e calculado

Implementada funcao `sha256Hex(value)` usando `crypto.subtle.digest('SHA-256', ...)` e conversao para hex string.

## 9) Como `proposal_public_links` e consultada

Consulta realizada em `proposal_public_links` com os filtros:

- `.eq('token_hash', tokenHash)`
- `.eq('token_hash_alg', 'sha256')`
- `.eq('status', 'active')`
- `.is('revoked_at', null)`
- `.gt('expires_at', nowIso)`
- `.single()`

Nao ha query com token bruto.

## 10) Tratamento de expiracao/revogacao/status

Essas regras foram movidas para o lookup em `proposal_public_links`:

- expirado -> excluido via `expires_at > now()`;
- revogado -> excluido via `revoked_at is null`;
- inativo -> excluido via `status = 'active'`.

Tambem foi adicionada validacao de `max_access_count` quando preenchido.

## 11) Como `proposals` e `proposal_items` sao consultadas

- Proposta: por `id` vindo de `proposal_public_links.proposal_id`
- Itens: por `proposal_id` na tabela `proposal_items`

Sem uso de `approval_token` em query.

## 12) Payload publico retornado

Mantido payload publico reduzido da fase anterior:

- dados principais da proposta (numero, status, validade, totais, etc.);
- dados publicos de company/contact/legal_entity;
- lista de itens com campos comerciais esperados.

## 13) Campos sensiveis nao retornados

Nao sao retornados:

- token bruto;
- `token_hash`;
- campos internos de `proposal_public_links` (status/revogacao/auditoria/metadados);
- stack trace interno.

## 14) `SUPABASE_SERVICE_ROLE_KEY` foi mantido?

Sim. Mantido temporariamente por necessidade operacional da funcao publica e leitura controlada sob RLS (conforme estrategia das fases anteriores).

## 15) `access_count`/`last_accessed_at` foram atualizados?

Nao nesta fase.  
Decisao: deixar pendente para fase posterior de endurecimento funcional, evitando update extra sem revisar completamente implicacoes de concorrencia/auditoria.

## 16) Validacao estatica executada

- `deno check supabase/functions/proposal-public-view/index.ts` tentado, mas `deno` nao esta disponivel no ambiente (`CommandNotFoundException`).
- `git diff` executado para inspecao das alteracoes.

## 17) Confirmacao de que nao houve deploy

Nenhum comando de deploy foi executado nesta fase.

## 18) Riscos remanescentes

1. Fluxo de aprovacao (`proposal-approve`) ainda nao adaptado para `proposal_public_links`;
2. Incremento de `access_count` e `last_accessed_at` pendente;
3. Necessidade de validacao funcional controlada em staging apos deploy.

## 19) Criterios para Fase 10N (deploy)

1. Revisao final do diff da funcao;
2. Confirmacao de ausencia de alteracoes fora dos arquivos permitidos;
3. Deploy exclusivo da funcao `proposal-public-view`;
4. Validacao negativa sem token real;
5. Validacao positiva sintetica com link hash valido em staging.
