# Fase 19D-C - Habilitacao controlada de `hstore` no target isolado

## 1. Objetivo

Registrar a execucao controlada da habilitacao de `hstore` no ambiente isolado de restore-test, com hard-stops e verificacoes read-only antes/depois.

## 2. Contexto

- Fase 19B: seed falhou por dependencia de `hstore` na funcao `public.enforce_uppercase_text()`.
- Fase 19C: scripts endurecidos (hard-stop tecnico para `hstore` ausente, enums ajustados).
- Fase 19D-A: decisao tecnica documentada recomendando habilitar `hstore` apenas no target isolado.
- Fase 19D-B: plano operacional de habilitacao com checklist estrito.

## 3. Autorizacao explicita registrada

Felipe Duarte autorizou explicitamente:

- habilitar `hstore` somente no target isolado `nsnmlleplpzsefzkuxlb`;
- nao executar em staging;
- nao executar em producao;
- nao executar seed nesta fase;
- nao executar cleanup nesta fase.

## 4. Ambiente autorizado

- Projeto: `crm-qualyvac-restore-test`
- Project ref: `nsnmlleplpzsefzkuxlb`

## 5. Ambientes proibidos

- Staging: `cansbrrwrprcycjvgvqm`
- Producao: qualquer ref diferente do autorizado

## 6. Hard-stop executado

Checklist confirmado antes da acao:

1. target ref correto (`nsnmlleplpzsefzkuxlb`);
2. projeto correto (`crm-qualyvac-restore-test`);
3. staging/producao fora do escopo;
4. comando de escrita limitado a `create extension if not exists hstore;`;
5. seed/validate/reconcile/cleanup explicitamente nao executados.

## 7. Pre-check read-only antes

Resultados antes da habilitacao:

- `hstore_installed_before = false`
- `public.enforce_uppercase_text()` existe e depende de `hstore`
- triggers confirmados em:
  - `carriers`
  - `companies`
  - `contacts`
  - `deals`
  - `order_items`
  - `orders`
  - `pipelines`
  - `products`
  - `tasks`
- contagens principais do piloto em `0`
- filas antes:
  - `order_sync_queue_before = 0`
  - `product_sync_queue_before = 0`
  - `company_sync_queue_before = 0`

## 8. Comando executado

Arquivo temporario (fora do repositorio):

- `C:/Users/Felipe Duarte/AppData/Local/Temp/qualyvac-pilot-hstore/phase19d-c-enable-hstore.sql`

Conteudo executado:

```sql
create extension if not exists hstore;
```

Execucao:

- `supabase db query --workdir <temp> --linked --file <temp>/phase19d-c-enable-hstore.sql`

## 9. Validacao estatica do arquivo temporario

Confirmado antes da execucao:

- continha somente o comando permitido;
- nao continha `insert`, `update`, `delete`, `truncate`, `drop`, `alter table`;
- nao continha seed/cleanup;
- nao continha secrets/tokens/connection string.

## 10. Resultado da execucao

- Execucao concluida com sucesso.
- Nenhum erro critico retornado pelo comando.

## 11. Pos-check read-only depois

Resultados apos a habilitacao:

- `hstore_installed_after = true`
- `pg_extension` contem `hstore`
- `hstore(text, text)` resolvivel = `true`
- `public.enforce_uppercase_text()` continua existente
- triggers permanecem nas mesmas tabelas
- contagens principais do piloto continuam `0`
- filas depois:
  - `order_sync_queue_after = 0`
  - `product_sync_queue_after = 0`
  - `company_sync_queue_after = 0`

## 12. Evidencia externa

Arquivo de evidencia (fora do repositorio):

- `C:/Users/Felipe Duarte/backups/qualyvac-migration/preflight/phase-19d-c-hstore_20260621T1404-0300.json`

## 13. Confirmacoes de seguranca

- Nenhum script do piloto foi executado.
- Nao houve seed.
- Nao houve validate.
- Nao houve reconcile.
- Nao houve cleanup.
- Nao houve deploy.
- Nao houve commit nesta fase de execucao.
- Nao houve push nesta fase de execucao.
- Staging nao foi alterado.
- Producao nao foi alterada.
- Nenhum dado sensivel foi versionado no repositorio.

## 14. Impacto

- `hstore` habilitado somente no restore-test.
- Nenhuma tabela de negocio alterada nesta fase.
- Nenhuma fila alterada.
- Staging/producao nao tocados.

## 15. Riscos remanescentes

- restore-test agora possui `hstore` (desvio controlado em relacao ao estado anterior).
- ainda nao houve seed bem-sucedido apos essa habilitacao.
- proxima execucao de seed exige nova aprovacao explicita.

## 16. Decisao

**APROVADO**.

## 17. Proximo passo

Executar a Fase 19D-D para reexecucao controlada do seed, somente com nova autorizacao explicita de Felipe Duarte e com hard-stops completos.
