# Fase 22U-R2 — Validacao pos-piloto e idempotencia de `legal_entities` (sem novas escritas)

## 1. Objetivo

Validar por leitura a escrita piloto da 22T-R2 em `legal_entities`, confirmar coerencia de delta/idempotencia e verificar que o executor segue bloqueando execucao ampliada.

## 2. Escopo

- pre-check de repositorio;
- leitura de documentos/evidencias da trilha 22*;
- consultas SQL somente read-only para validar registro piloto e escopo negativo;
- consolidacao da evidencia de auditoria pos-piloto;
- documentacao de decisao GO/PARCIAL/NO-GO sem nova escrita.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem RPC/SQL de escrita;
- sem seed/cleanup/rollback;
- sem migration/deploy/push;
- sem alteracao staging/prod;
- sem ERP/API/webhook/n8n;
- sem processamento de filas;
- sem qualquer nova entidade piloto.

## 4. Evidencias 22T revisadas

- `artifacts/migration/phase-22t-r2-pilot-legal-entities-write/before-20260626-224906.json`
- `artifacts/migration/phase-22t-r2-pilot-legal-entities-write/after-20260626-224906.json`
- `docs/migration/phase-22t-r2-pilot-legal-entities-write.md`
- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json`

Ponto de partida confirmado:

- before=0
- after=1
- delta=+1
- registro esperado com id `973a686d-e87f-4114-9d1d-455ed80a92de`

## 5. Registro validado em `legal_entities`

Resultado read-only:

- `exact_match_count=1`
- id, tenant, cnpj, erp_company_code e name batem exatamente com o planejado.

Registro encontrado:

- `id=973a686d-e87f-4114-9d1d-455ed80a92de`
- `tenant_id=00000000-0000-0000-0000-000000000001`
- `cnpj=TMP-CNPJ-LE-0001`
- `erp_company_code=TMP-LE-001`
- `name=Qualyvac Baseline LE`

## 6. Delta e contagens

- `legal_entities` atual: `1`
- comparacao before/after/current: `0 -> 1 -> 1`
- delta before/after: `+1`
- delta after/current: `0`
- coerencia do delta: `true`

## 7. Validacao de tenant

- `tenant_id=00000000-0000-0000-0000-000000000001` existe em `tenants`: `true`
- nao houve indicio de vinculo invalido de tenant para o registro piloto.

## 8. Validacao de chave natural/idempotencia

Validacoes confirmadas:

- constraint presente: `UNIQUE (tenant_id, cnpj)` (`uq_legal_entities_tenant_cnpj`);
- cardinalidade da chave natural para o piloto: `1`;
- ids distintos para a chave natural: `1`;
- duplicidade no mesmo tenant: nao detectada.

Avaliacao de idempotencia (sem reexecutar escrita):

- operacao 22T-R2 usou `ON CONFLICT (tenant_id, cnpj)`;
- chave natural unica valida;
- sem delete/cleanup no caminho piloto;
- idempotencia considerada aceitavel para fase seguinte.

## 9. Validacao de escopo negativo

Validado por leitura que nao houve toque adicional nas entidades monitoradas:

- `profiles`, `user_tenants`, `user_legal_entities`, `sales_reps`, `user_sales_reps`
- `products`, `companies`, `contacts`
- `deals`, `orders`, `order_items`, `proposals`
- `audit_logs`, `notifications`

Itens sem tabela no schema atual (registrados como `not_applicable`):

- `company_contacts`, `sync_queues`, `erp_sync`, `webhooks`, `n8n`, `sessions`, `attachments`

Itens `not_checked`: nenhum.

## 10. Bloqueio de execucao ampliada

Revisao do executor confirmou:

- flags proibidas seguem bloqueadas;
- entidade piloto continua restrita a `legal_entities`;
- lista de entidades excluidas permanece explicita;
- mensagem de parada obrigatoria permanece ativa:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM legal_entities. EXECUÇÃO AMPLIADA BLOQUEADA.`

Conclusao: bloqueio de execucao ampliada permanece ativo.

## 11. Evidencia JSON gerada

- `artifacts/migration/phase-22u-r2-post-pilot-audit/post-pilot-audit-20260626-225314.json`

## 12. Riscos restantes

- risco operacional residual ao abrir escopo para segunda entidade piloto sem novo gate humano;
- risco de drift de dados entre fases caso haja alteracoes manuais fora do fluxo controlado.

## 13. Decisao final GO/PARCIAL/NO-GO

**GO**

Justificativa:

- registro piloto existe e confere com evidencia;
- delta permanece coerente;
- tenant e chave natural validos e sem duplicidade;
- sem evidencias de toque em entidades fora do escopo;
- executor segue bloqueando execucao ampliada;
- nenhuma nova escrita foi executada nesta fase.

## 14. Recomendacao da proxima fase

Avancar para uma fase de gate decisorio da segunda entidade piloto (somente se houver nova autorizacao humana explicita), mantendo rollout incremental e evidencias before/after para cada entidade.

## 15. Confirmacoes obrigatorias

- SQL de escrita executado: nao
- nova escrita em banco: nao
- consultas read-only executadas: sim
- entidade auditada: `legal_entities`
- registro piloto encontrado: sim
- registros adicionais criados: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- push: nao
- staging/prod alterados: nao
- `profiles` tocada: nao
- `company_contacts` tocada: nao
- transacionais tocadas: nao
- executor executou escrita ampliada: nao
