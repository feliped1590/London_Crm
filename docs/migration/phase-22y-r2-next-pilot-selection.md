# Fase 22Y-R2 — Definicao da segunda entidade piloto (sem escrita)

## 1. Objetivo

Definir tecnicamente a segunda entidade piloto para futura escrita controlada no restore-test, minimizando superficie de risco e sem executar qualquer mutacao nesta fase.

## 2. Escopo

- pre-check Git obrigatorio;
- leitura de documentos/evidencias da trilha 22T/22U/22V;
- leitura do executor apenas para analise de guard rails e ordem;
- analise comparativa das candidatas `user_tenants`, `user_legal_entities`, `sales_reps`, `user_sales_reps`;
- recomendacao tecnica de proxima entidade piloto;
- documentacao da decisao GO/PARCIAL/NO-GO.

## 3. Restricoes absolutas

- sem escrita em banco;
- sem SQL de escrita (insert/update/upsert/delete);
- sem RPC de escrita;
- sem seed/cleanup/rollback;
- sem migration/deploy;
- sem ERP/API/webhook/n8n;
- sem processamento de filas;
- sem execucao de nova entidade piloto;
- sem alteracao do executor para ampliar escrita;
- sem commit e sem push.

## 4. Estado atual do marco

Pre-check Git executado nesta fase:

- branch: `main`;
- `git status --short`: sem pendencias (working tree limpa);
- divergencia `origin/main...main`: `0 0`;
- ultimo commit: `61f3677f feat(migration): add controlled baseline write pilot`.

Marco tecnico confirmado:

- alvo: `nsnmlleplpzsefzkuxlb` (`crm-qualyvac-restore-test`);
- batch: `baseline_22f_r2_restore_test_qualyvac`;
- piloto real anterior: `legal_entities` (22T-R2), auditado como GO na 22U-R2;
- execucao ampliada permanece bloqueada no executor.

Arquivos base lidos nesta fase:

- `docs/migration/phase-22t-r2-pilot-legal-entities-write.md`
- `docs/migration/phase-22u-r2-post-pilot-audit.md`
- `docs/migration/phase-22v-r2-controlled-milestone-commit.md`
- `scripts/migration/phase-22k-r2-baseline-write.mjs`
- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json` (mais recente)
- `artifacts/migration/phase-22u-r2-post-pilot-audit/post-pilot-audit-20260626-225314.json` (arquivo unico)

## 5. Candidatas avaliadas

- `user_tenants`
- `user_legal_entities`
- `sales_reps`
- `user_sales_reps`

Presenca no input (`latest.json`):

- todas as 4 candidatas estao presentes.

Presenca no write plan (`write-plan-20260626-224906.json`):

- todas as 4 candidatas estao em `eligibleEntitiesForWrite`.

Contagens planejadas:

- `user_tenants`: 3
- `user_legal_entities`: 3
- `sales_reps`: 2
- `user_sales_reps`: 2

## 6. Analise de dependencias

### `user_tenants`

- depende de `user_id` + `tenant_id` + `role` (camada de permissao);
- depende de existencia/confiabilidade de usuario real;
- possui potencial impacto direto de acesso por tenant;
- escrita isolada e tecnicamente possivel, mas com risco de permissao indevida.

### `user_legal_entities`

- depende de `user_id` + `tenant_id` + `legal_entity_id` + `role`;
- depende de `legal_entities` (ja validada) e de usuarios reais;
- amplifica risco de permissao (escopo por entidade legal);
- maior acoplamento que `user_tenants`.

### `sales_reps`

- depende primariamente de `tenant_id` e atributos cadastrais (`name`, opcionalmente `erp_vendor_code`);
- nao depende de `profiles` para existir como cadastro basico;
- nao concede permissao de acesso a usuario por si so;
- escrita isolada e plausivel apos `legal_entities`.

### `user_sales_reps`

- depende de `user_id` + `sales_rep_id`;
- requer `sales_reps` previamente consistente;
- vincula usuario real a representacao comercial (efeito de acesso/visibilidade indireto);
- nao e boa candidata para segunda rodada isolada.

## 7. Analise de idempotencia

### `sales_reps` (mais favoravel)

- estrategia idempotente viavel por chave natural de negocio (ex.: `tenant_id + erp_vendor_code`, quando preenchido);
- quando `erp_vendor_code` estiver ausente, exige regra explicita conservadora para evitar colisao por `name`;
- como entidade cadastral, permite before/after simples por contagem + chave de negocio.

### `user_tenants` / `user_legal_entities` / `user_sales_reps` (menos favoraveis)

- idempotencia depende de combinacoes com `user_id` e papeis (`role`), mais sujeitas a efeitos colaterais de permissao;
- mesmo com chave composta, erro de mapeamento impacta acesso;
- exigem validacao adicional de usuarios de teste, inexistencia de usuarios reais e politica de papeis.

## 8. Riscos por entidade

### `user_tenants`

- risco alto de permissao/acesso indevido por vinculacao de usuario ao tenant;
- dependencia de `profiles`/`user_id` real (direta via identidade);
- risco funcional superior ao ganho desta rodada.

### `user_legal_entities`

- risco alto (permissao por entidade legal + role);
- dependencia de usuario real e de chave correta de `legal_entity_id`;
- maior superficie de erro de autorizacao.

### `sales_reps`

- risco baixo/moderado, predominantemente cadastral;
- sem concessao direta de acesso de usuario;
- principal cuidado: chave natural idempotente obrigatoria antes da escrita.

### `user_sales_reps`

- risco moderado/alto por vinculo usuario-representante;
- depende de duas entidades estarem corretas (`user_id`, `sales_rep_id`);
- nao indicado como segunda piloto.

## 9. Entidade recomendada

**Recomendacao A — `sales_reps`**

## 10. Justificativa da escolha

- menor contagem planejada entre candidatas com baixo impacto de permissao (2);
- depende de contexto de tenant ja conhecido e nao exige liberar acesso de usuario;
- nao depende de `profiles` para escrita cadastral basica;
- mais isolavel que entidades de vinculo de usuario;
- melhor relacao risco/controle para segunda escrita piloto.

## 11. Entidades descartadas nesta rodada

- `user_tenants` (descartada por risco de permissao/acesso associado a `user_id`);
- `user_legal_entities` (descartada por acoplamento de permissao e dependencia adicional);
- `user_sales_reps` (descartada por dependencia em usuario real e por exigir `sales_reps` previo).

## 12. Criterios para proxima fase

Antes de qualquer escrita de `sales_reps`, exigir:

- confirmacao de chave idempotente operacional (`tenant_id + erp_vendor_code`) e tratamento quando `erp_vendor_code` ausente;
- definicao de payload piloto minimo (idealmente 1 registro, maximo 2 como no plano);
- before evidence read-only (`count`, existencia por chave natural, colisao por chave);
- after evidence read-only (delta, registro afetado, ausencia de toque fora do escopo);
- hard stop explicito para bloquear expansao apos `sales_reps`;
- gate humano explicito com frase de autorizacao dedicada.

## 13. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivo:

- entidade segura recomendada (`sales_reps`);
- riscos das demais candidatas documentados;
- nenhuma escrita executada;
- executor nao alterado;
- nenhuma acao fora de escopo executada.

## 14. Recomendacao da proxima fase

Executar fase dedicada de preparacao do piloto `sales_reps` (somente design + validacao de chave/idempotencia + contrato before/after), ainda sem escrita, seguida de gate humano para eventual execucao controlada em fase posterior.

## 15. Confirmacoes obrigatorias

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
