# Fase 10N.4 - Troca de `serve` para `Deno.serve` em `proposal-public-view`

## 1) Objetivo

Aplicar ajuste minimo de bootstrap HTTP na Edge Function `proposal-public-view`, removendo dependencia de `std/http/server.ts` e usando `Deno.serve`, sem alterar logica funcional e sem deploy nesta fase.

## 2) Motivo do ajuste

Fases 10N e 10N.2 falharam no bundling remoto da Supabase ao importar:

- `https://deno.land/std@0.168.0/http/server.ts`

Fase 10N.3 recomendou troca minima para reduzir dependencia remota instavel de bootstrap.

## 3) Arquivo alterado

- `supabase/functions/proposal-public-view/index.ts`

## 4) Import removido

Removido:

- `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`

## 5) Uso de `Deno.serve`

Substituida chamada:

- de `serve(async (req) => { ... })`
- para `Deno.serve(async (req) => { ... })`

## 6) Confirmacao de que a logica funcional nao foi alterada

Revisao de diff confirmou alteracao apenas no bootstrap HTTP:

- validacao de token: inalterada;
- calculo SHA-256: inalterado;
- lookup `proposal_public_links`: inalterado;
- validacoes de status/expiracao/revogacao/max_access_count: inalteradas;
- consultas `proposals` e `proposal_items`: inalteradas;
- payload publico e erros: inalterados;
- CORS, rate limit e uso de `service_role`: inalterados.

## 7) Confirmacao de que nao houve deploy

Nenhum comando de deploy foi executado nesta fase.

## 8) Validacao estatica executada

Executado:

- `git diff` (confirmou mudanca minima);
- `rg -n "deno.land/std@0.168.0/http/server.ts|Deno.serve|serve\\(" supabase/functions/proposal-public-view/index.ts`
  - confirmou `Deno.serve`
  - confirmou ausencia do import antigo.

Tentado:

- `deno check supabase/functions/proposal-public-view/index.ts`
  - nao executado por indisponibilidade local do comando `deno` (`CommandNotFoundException`).

## 9) Riscos remanescentes

1. Deploy ainda nao validado apos troca de bootstrap;
2. Bundler remoto pode continuar intermitente por fatores externos;
3. Validacao funcional da versao adaptada continua pendente ate deploy bem-sucedido.

## 10) Criterios para repetir deploy na proxima fase

1. Pre-check de branch limpa e projeto staging correto;
2. Deploy exclusivo da `proposal-public-view`;
3. Verificar `functions list` para mudanca de `VERSION` ou `UPDATED_AT`;
4. Nao executar teste HTTP na fase de deploy;
5. Se falhar novamente por bundling, registrar erro completo e interromper antes de qualquer teste.
