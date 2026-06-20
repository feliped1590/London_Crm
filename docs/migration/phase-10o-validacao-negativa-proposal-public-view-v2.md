# Fase 10O - Validacao negativa da `proposal-public-view` v2

## 1) Objetivo

Executar validacao negativa controlada da funcao `proposal-public-view` versao 2 em staging, sem dados reais, sem dados sinteticos positivos e sem integracoes externas.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch da fase: `phase-10o-validacao-negativa-proposal-public-view-v2`
- Projeto: Supabase Staging

## 3) Project ref

- `cansbrrwrprcycjvgvqm`

## 4) Versao da funcao

Validado por `functions list`:

- `proposal-public-view`
- `ACTIVE`
- `VERSION=2`
- `UPDATED_AT=2026-06-20 21:55:53`

## 5) URL da funcao

- `https://cansbrrwrprcycjvgvqm.supabase.co/functions/v1/proposal-public-view`

## 6) Pre-checks

Pre-checks obrigatorios validados:

1. branch inicial `main` limpa e atualizada;
2. branch da fase criada;
3. projeto/ref corretos;
4. `public.proposal_public_links` existe;
5. `count(*)` em `public.proposal_public_links` = `0`.

## 7) Testes executados

Somente chamadas negativas permitidas:

1. `OPTIONS` preflight;
2. `GET`;
3. `POST` com body `{}`;
4. `POST` com token malformado `abc`;
5. `POST` com token sintetico inexistente:
   - `test_10o_000000000000000000000000000000000000000000000000000000`

## 8) Status HTTP observado em cada teste

1. `OPTIONS` -> `200`
2. `GET` -> `405`
3. `POST {}` -> `404`
4. `POST {"token":"abc"}` -> `404`
5. `POST {"token":"test_10o_..."}` -> `404`

## 9) Resumo seguro das respostas

- Para cenarios sem token / token malformado / token inexistente, resposta manteve erro generico:
  - `{"error":"Link inválido ou expirado"}`
- `GET` rejeitado com metodo indevido (`405`) e cabecalho `Allow: POST, OPTIONS`.

## 10) Se houve vazamento de dados

Nao houve vazamento de dados:

- nenhum dado de proposta;
- nenhum dado de cliente/contato;
- nenhum dado interno de `proposal_public_links`.

## 11) Se houve stack trace

Nao houve stack trace nas respostas.

## 12) Se houve retorno de `token_hash` ou dados internos

Nao houve retorno de `token_hash`, `proposal_id`, `status`, `expires_at`, `revoked_at` ou outros campos internos.

## 13) Se anti-enumeracao funcionou

Sim. Tokens ausente/malformado/inexistente retornaram resposta consistente e generica (`404` + mensagem unica), sem distinguir existencia real.

## 14) Confirmacao de que nenhum dado foi inserido

Validacao SQL read-only apos os testes:

```sql
select count(*) as total_links
from public.proposal_public_links;
```

Resultado: `0`.

## 15) Confirmacao de que `proposal_public_links` continuou vazia

Confirmado: `total_links = 0` apos todos os testes negativos.

## 16) Riscos remanescentes

1. Ainda falta validar fluxo positivo sintetico (link valido hash + proposal associada).
2. Ainda falta validar limites operacionais de acesso (`max_access_count`) com cenario controlado.

## 17) Decisao

**Aprovada para teste positivo sintetico controlado** na proxima fase, mantendo bloqueios de dados reais e integracoes externas.

## 18) Proximos passos

1. Fase seguinte: criar cenario sintetico minimo para validar caminho positivo da v2.
2. Executar uma unica chamada positiva controlada.
3. Confirmar payload minimo sem vazamento e com comportamento funcional esperado.
