# Product Sync - Checklist de Seguranca

## 1. Objetivo

O `process-product-sync` consome a `product_sync_queue` e, no modo real, pode chamar o ERP Projedata e disparar o fluxo de atributos (`process-attribute-sync`).

Este documento formaliza os controles minimos para deploy, teste em dry-run e eventual execucao real futura.

## 2. Modos de execucao

### Dry-run

Ativacao suportada:

- body: `dryRun=true`
- query: `dryRun=true` ou `dry_run=true`
- header: `x-dry-run: true`

Comportamento esperado:

- nao chama ERP;
- nao chama `process-attribute-sync`;
- nao altera fila;
- nao muda status;
- nao incrementa tentativas;
- nao marca `processed_at`;
- retorna itens informativos como:
  - `would_send`
  - `would_fail_validation`
  - `would_defer`

### Execucao real

- somente com autorizacao explicita;
- exige gates de seguranca ativos;
- pode chamar ERP;
- pode alterar status/tentativas da fila;
- pode disparar `process-attribute-sync` apos sucesso real.

## 3. Variaveis de ambiente

| Variavel | Tipo | Obrigatoria para dry-run | Obrigatoria para execucao real | Valor seguro/recomendado | Observacao |
| --- | --- | ---: | ---: | --- | --- |
| `SUPABASE_URL` | runtime | Sim | Sim | Definida no ambiente Supabase | Base URL para cliente Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | credencial | Sim | Sim | Definida e protegida | Necessaria para operacoes service-role |
| `SUPABASE_ANON_KEY` | credencial | Nao (somente se houver Authorization header) | Nao (somente se houver Authorization header) | Definida quando o fluxo usar resolucao de usuario por JWT | Usada para `auth.getUser()` auxiliar |
| `ERP_SYNC_PAUSED` | gate de seguranca | Nao | Recomendado | `true` em ambiente nao produtivo | Quando `true`, bloqueia execucao real |
| `PRODUCT_SYNC_EXECUTION_ENABLED` | gate de seguranca | Nao | Sim | Ausente ou diferente de `true` por padrao | Execucao real so ocorre com `true` |
| `PRODUCT_SYNC_ALLOWED_PROJECT_REF` | gate de projeto | Nao | Recomendado | Definido para o projeto autorizado | Ativa trava por ref quando configurado |
| `SUPABASE_PROJECT_REF` | identidade de projeto | Nao | Recomendado (quando usar gate de projeto) | Definido no runtime | Comparado com ref permitido |
| `SB_PROJECT_REF` | identidade de projeto | Nao | Recomendado (fallback) | Definido no runtime | Fallback para comparacao de projeto |
| `PROJEDATA_API_URL` | endpoint externo | Nao | Sim | Definido apenas para execucao real autorizada | Nao necessario para dry-run |
| `PROJEDATA_API_TOKEN` | credencial/secret externo | Nao | Sim | Definido apenas para execucao real autorizada | Nao necessario para dry-run; nunca logar valor |

## 4. Defaults seguros

- `PRODUCT_SYNC_EXECUTION_ENABLED` ausente ou diferente de `true` bloqueia execucao real.
- `ERP_SYNC_PAUSED=true` e recomendado em ambientes nao produtivos.
- `PRODUCT_SYNC_ALLOWED_PROJECT_REF` deve ser configurado quando houver plano de execucao real.
- `SUPABASE_PROJECT_REF` ou `SB_PROJECT_REF` deve existir para o gate por projeto ser efetivo.
- `PROJEDATA_API_URL` e `PROJEDATA_API_TOKEN` so devem ser exigidos em execucao real.

## 5. Checklist antes de deploy sem execucao

- [ ] Branch alinhada com `origin/main`.
- [ ] Revisao estatica da funcao concluida.
- [ ] `PRODUCT_SYNC_EXECUTION_ENABLED` nao esta `true`.
- [ ] `ERP_SYNC_PAUSED=true` definido para ambiente nao produtivo.
- [ ] (Recomendado) `PRODUCT_SYNC_ALLOWED_PROJECT_REF` definido.
- [ ] Deploy planejado sem invocacao da funcao.
- [ ] Nenhuma chamada ERP durante a fase.
- [ ] Evidencias de pre e pos deploy registradas.

## 6. Checklist antes de teste dry-run

- [ ] Funcao ja deployada.
- [ ] `PRODUCT_SYNC_EXECUTION_ENABLED` diferente de `true`.
- [ ] `ERP_SYNC_PAUSED=true` (preferencial em ambiente nao produtivo).
- [ ] Requisicao obrigatoriamente com `dryRun=true` (body/query/header).
- [ ] Confirmar que fila nao muda antes/depois do teste.
- [ ] Confirmar ausencia de chamada ERP.
- [ ] Confirmar que `process-attribute-sync` nao foi disparada.
- [ ] Registrar resultado do dry-run (itens `would_*`) como evidencia.

## 7. Checklist antes de execucao real futura (NAO AUTORIZADA NESTA TRILHA)

- [ ] Autorizacao humana explicita para execucao real.
- [ ] Target confirmado e isolado.
- [ ] `PRODUCT_SYNC_ALLOWED_PROJECT_REF` configurado.
- [ ] `SUPABASE_PROJECT_REF` e/ou `SB_PROJECT_REF` configurado.
- [ ] `PRODUCT_SYNC_EXECUTION_ENABLED=true`.
- [ ] `ERP_SYNC_PAUSED=false`.
- [ ] `PROJEDATA_API_URL` e `PROJEDATA_API_TOKEN` configurados.
- [ ] Janela de acesso validada.
- [ ] Batch pequeno para primeira execucao.
- [ ] Evidencia pre e pos execucao definida.
- [ ] Plano de pausa/rollback operacional disponivel.

## 8. Proibicoes

- Nao executar em staging/producao sem fase dedicada e autorizacao explicita.
- Nao habilitar execucao real sem gate de projeto quando aplicavel.
- Nao expor tokens/secrets em logs, docs ou evidencias.
- Nao executar "dry-run" sem `dryRun=true`.
- Nao misturar deploy com execucao operacional na mesma fase.
