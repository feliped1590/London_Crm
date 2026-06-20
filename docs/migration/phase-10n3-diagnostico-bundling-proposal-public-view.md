# Fase 10N.3 - Diagnostico de bundling da `proposal-public-view`

## 1) Objetivo

Diagnosticar a falha recorrente de bundling/deploy da Edge Function `proposal-public-view` em staging, sem alterar codigo e sem executar deploy, para decidir a menor correcao segura.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch da fase: `phase-10n3-diagnostico-bundling-proposal-public-view`
- Analise somente read-only (codigo + configuracao + estado remoto das functions)

## 3) Project ref

Confirmado:

- `cansbrrwrprcycjvgvqm` (`crm-qualyvac-staging`)

## 4) Erro observado nas fases 10N e 10N.2

Falha repetida no deploy remoto da Supabase durante o bundle:

- timeout/500 ao importar `https://deno.land/std@0.168.0/http/server.ts`
- sem publicacao de nova versao da `proposal-public-view` (permanece `ACTIVE`, `VERSION=1`, `UPDATED_AT=2026-06-20 20:26:46`)

## 5) Imports remotos da `proposal-public-view`

Arquivo: `supabase/functions/proposal-public-view/index.ts`

- `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`
- `import { createClient } from "https://esm.sh/@supabase/supabase-js@2";`

Nao ha imports de modulo local no arquivo.

## 6) Imports locais/shared usados pela funcao

- Nao foram encontrados imports `_shared` ou outros imports locais na `proposal-public-view`.

## 7) Outras funcoes que usam o mesmo import

Sim. Existem varias funcoes ainda usando o mesmo padrao `serve` do `deno.land/std@0.168.0/http/server.ts`, por exemplo:

- `proposal-approve`
- `generate-proposal-pdf`
- `generate-order-pdf`
- `prospecting-search`
- `validate-ncm-semantic`
- `lookup-ncm-online`

Tambem ha funcoes com `deno.land/std@0.190.0/http/server.ts`.

## 8) Funcoes com deploy recente e padroes de import

Pelo `functions list` em staging:

- `generate-signed-url-secure` (`ACTIVE`, `VERSION=1`, atualizado em 2026-06-20 20:13:13)
- `proposal-public-view` (`ACTIVE`, `VERSION=1`, 2026-06-20 20:26:46)

Padrao da `generate-signed-url-secure`:

- usa `Deno.serve(...)` diretamente;
- nao importa `deno.land/std/http/server.ts`;
- mantem apenas import remoto `esm.sh` para Supabase client.

## 9) Hipotese principal

Hipotese mais forte:

1. **instabilidade de dependencia remota `deno.land` no bundler remoto** da Supabase (timeout/500 no fetch do import);
2. secundariamente, uso de **padrao de import antigo** (`std/http/server.ts`) aumenta exposicao a essa falha;
3. evidencias nao apontam para erro funcional interno da logica da 10M.

## 10) Opcoes de correcao (sem aplicar nesta fase)

1. novo retry em outra janela (baixo impacto, sem alterar codigo);
2. atualizar import do `std` para versao mais nova;
3. trocar de `serve(...)` importado para `Deno.serve(...)`;
4. alinhar ao padrao de funcao ja deployada com sucesso (`generate-signed-url-secure`);
5. reduzir dependencias remotas desnecessarias;
6. avaliar estrategia de vendorizacao/cache (se adotavel no fluxo Supabase utilizado).

## 11) Recomendacao tecnica

Recomendacao principal para menor risco tecnico-operacional:

- **fazer ajuste minimo de import para `Deno.serve`** na `proposal-public-view`, removendo dependencia direta de `https://deno.land/std@0.168.0/http/server.ts`, sem alterar comportamento funcional.

Justificativa:

- reduz ponto de falha observado no bundling;
- aproxima do padrao ja validado em funcao que publicou com sucesso no mesmo projeto.

## 12) Menor alteracao segura para proxima fase

Alteracao minima sugerida (proxima fase, nao aplicada agora):

1. remover import de `serve` do `deno.land/std`;
2. trocar chamada `serve(async (req) => { ... })` por `Deno.serve(async (req) => { ... })`;
3. manter toda logica funcional e hardening exatamente iguais.

## 13) Criterios para tentar novo deploy

Prosseguir deploy somente se:

1. alteracao limitada ao mecanismo de `serve` (sem alterar regras de negocio);
2. nenhum arquivo fora do escopo for alterado;
3. `functions deploy proposal-public-view --project-ref cansbrrwrprcycjvgvqm` for o unico deploy;
4. pos-deploy `VERSION`/`UPDATED_AT` mudar no `functions list`;
5. sem testes HTTP nesta fase de publish.

## 14) Criterios para nao prosseguir

Nao prosseguir se:

1. deploy continuar falhando por bundling mesmo apos ajuste minimo;
2. houver necessidade de alterar DB/config/secrets;
3. houver risco de publicar outra funcao por engano;
4. surgir necessidade de alterar comportamento funcional alem do escopo de import.

## 15) Respostas objetivas

1. **Erro parece de codigo ou bundling/dependencia remota?**  
   Principalmente bundling/dependencia remota.
2. **A funcao usa import remoto antigo?**  
   Sim (`deno.land/std@0.168.0/http/server.ts`).
3. **Outras funcoes usam esse mesmo import?**  
   Sim, varias.
4. **Alguma funcao deployada com sucesso usa `Deno.serve`?**  
   Sim (`generate-signed-url-secure`).
5. **Menor correcao segura e trocar para `Deno.serve`?**  
   Sim, recomendada.
6. **Essa troca altera comportamento funcional?**  
   Nao, se feita apenas no bootstrap HTTP.
7. **Proxima fase deve ser novo retry ou ajuste de import?**  
   Ajuste minimo de import primeiro; depois novo deploy controlado.
