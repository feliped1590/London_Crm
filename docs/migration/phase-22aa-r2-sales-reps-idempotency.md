# Fase 22AA-R2 — Fechamento de idempotencia do piloto `sales_reps` (sem escrita)

## 1. Objetivo

Fechar tecnicamente a avaliacao de idempotencia do futuro piloto `sales_reps`, validando payload real, tipo de `erp_vendor_code`, risco de colisao e politica conservadora de avanco, sem executar escrita.

## 2. Escopo

- pre-check Git;
- leitura dos documentos/evidencias obrigatorios;
- extracao do payload planejado de `sales_reps` a partir de input/write plan;
- validacao read-only de schema/constraints/indices;
- validacao read-only de colisao no estado atual da tabela;
- definicao da opcao recomendada (A/B/C) para proxima fase;
- geracao de evidencia JSON local.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL de escrita ou RPC de escrita;
- sem migration, seed, cleanup, rollback;
- sem alteracao de schema;
- sem ERP/API/webhook/n8n;
- sem filas;
- sem alteracao de executor;
- sem commit e sem push.

## 4. Estado atual

Pre-check Git executado:

- branch: `main`;
- `git status --short` no inicio:  
  - `?? docs/migration/phase-22y-r2-next-pilot-selection.md`  
  - `?? docs/migration/phase-22z-r2-sales-reps-pilot-prep.md`
- divergencia: `0 0`;
- ultimo commit: `61f3677f feat(migration): add controlled baseline write pilot`.

Arquivos obrigatorios lidos:

- `docs/migration/phase-22y-r2-next-pilot-selection.md`
- `docs/migration/phase-22z-r2-sales-reps-pilot-prep.md`
- `scripts/migration/phase-22k-r2-baseline-write.mjs`
- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json`
- `artifacts/migration/phase-22u-r2-post-pilot-audit/post-pilot-audit-20260626-225314.json`

Validacao de versao de evidencia:

- `write-plan-20260626-224906.json` permanece o mais recente aplicavel.

## 5. Payload real extraido

Resultado da extracao em `latest.json` + write plan:

- `sales_reps` presente como entidade;
- contagem planejada confirmada (`2`);
- **payload linha-a-linha dos 2 registros nao encontrado** nesses artefatos;
- nao foi possivel extrair com confianca, por registro, os campos:
  - `tenant_id`
  - `name`
  - `erp_vendor_code`
  - `email`
  - `active`
  - `type`
  - `phone`

Conclusao desta secao:

- lacuna critica de payload real para fechamento da idempotencia.

## 6. Schema/constraints de `sales_reps`

Validacao read-only no banco (`public.sales_reps`):

- colunas:
  - `id uuid not null default gen_random_uuid()`
  - `name text not null`
  - `type text null default 'interno'`
  - `phone text null`
  - `email text null`
  - `active boolean null default true`
  - `tenant_id uuid not null`
  - `created_at timestamptz null default now()`
  - `erp_vendor_code integer null`
- constraints:
  - PK em `id`
  - FK `tenant_id -> tenants(id)`
- indices:
  - unico apenas para PK (`id`)
  - indice nao unico em `erp_vendor_code`
  - indice nao unico em `tenant_id`

Achado-chave:

- nao existe `UNIQUE (tenant_id, erp_vendor_code)`.

## 7. Validacao de `erp_vendor_code`

Resultados:

- tipo real: `integer`;
- nullable: sim;
- default: nao.

Validacao por registro planejado:

- **nao concluivel** (payload real nao disponivel linha-a-linha);
- nao foi possivel comprovar que os 2 registros possuem `erp_vendor_code` presente, nao vazio e compativel com `integer`.

## 8. Colisoes com dados existentes

Consultas read-only executadas:

- duplicidade por `tenant_id + erp_vendor_code` (dados existentes);
- duplicidade por `tenant_id + name`;
- duplicidade por `tenant_id + lower(email)`;
- contagem total de `sales_reps`.

Resultado:

- `sales_reps` atual: `0` registros;
- nenhuma duplicidade atual detectada nas chaves diagnosticas.

Limite da analise:

- sem payload real dos 2 registros, nao ha como confirmar colisao exata para os registros planejados.

## 9. Avaliacao de idempotencia

Estado atual:

- chave proposta continua `tenant_id + erp_vendor_code`;
- sem constraint unica para reforcar essa chave;
- `erp_vendor_code` nullable;
- payload real nao disponivel por registro.

Conclusao:

- idempotencia do piloto `sales_reps` **nao fechada** nesta fase.

## 10. Opcoes avaliadas

### Opcao A — Sem migration, lookup controlado

- exigiria payload completo por registro e contrato estrito de lookup;
- **nao viavel agora** por falta do payload linha-a-linha.

### Opcao B — Constraint unica antes de escrever

- tecnicamente aumenta seguranca;
- **fora do escopo desta fase** (migration proibida).

### Opcao C — Nao avancar com `sales_reps` agora

- viavel imediatamente;
- preserva seguranca e evita escrita com chave incompleta.

## 11. Politica recomendada

**Opcao C (conservadora): nao avancar para escrita de `sales_reps` nesta etapa.**

Condicoes minimas para destravar:

- disponibilizar payload real dos 2 registros planejados com `tenant_id`, `name`, `erp_vendor_code` e campos adicionais;
- validar `erp_vendor_code` registro-a-registro contra tipo `integer`;
- definir contrato de lookup/idempotencia executavel antes de qualquer mutacao.

## 12. Evidencia JSON gerada

- `artifacts/migration/phase-22aa-r2-sales-reps-idempotency/sales-reps-idempotency-20260627-172847.json`

## 13. Riscos restantes

- ausencia de payload real impede validacao de idempotencia por registro;
- nullable em `erp_vendor_code` aumenta risco de ambiguidade;
- sem constraint unica, persistem riscos de duplicidade/sobrescrita em cenario real;
- potencial desalinhamento entre especificacoes antigas e tipo real da coluna (`integer`).

## 14. Decisao final GO/PARCIAL/NO-GO

**NO-GO**

Motivos:

- payload real dos 2 `sales_reps` nao foi encontrado nos artefatos de input/write plan;
- validacao obrigatoria de `erp_vendor_code` por registro nao pode ser concluida;
- chave segura para execucao piloto nao pode ser comprovada nesta fase sem inventar dados.

## 15. Recomendacao da proxima fase

Executar fase exclusiva de consolidacao do payload real de `sales_reps` (sem escrita), com:

- artefato contendo os 2 registros completos;
- validacao formal de tipo `erp_vendor_code` por registro;
- regra de abort para qualquer `erp_vendor_code` ausente/invalido;
- revisao final do contrato de idempotencia antes de qualquer ajuste de executor.

## 16. Confirmacoes obrigatorias

- nova escrita em banco: nao
- SQL de escrita executado: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- commit: nao
- push: nao
- executor alterado: nao
- staging/prod alterados: nao
- executor executou escrita ampliada: nao
