# Pilot Seed Scripts (Fase 17A)

## Status atual dos scripts

- `seed-pilot-dataset.sql`: pronto para execucao futura controlada, com hard-stop e idempotencia.
- `validate-pilot-dataset.sql`: read-only, sem escrita.
- `reconcile-pilot-dataset.sql`: read-only, sem escrita.
- `cleanup-pilot-dataset.sql`: limpeza logica com preview e gate de execucao.
- Nenhum script foi executado nesta fase.

## Objetivo

Montar e validar um dataset sintetico/controlado para piloto tecnico de migracao/reconciliacao, sem uso de dados reais e sem integracoes externas reais.

## Ambiente autorizado (futuro)

- Nome esperado: `crm-qualyvac-restore-test`
- Project ref esperado: `nsnmlleplpzsefzkuxlb`

## Ambientes proibidos

- Staging (proibido): `cansbrrwrprcycjvgvqm`
- Producao: qualquer ref nao explicitamente autorizado

## Pre-requisitos para execucao futura

- Aprovacao explicita de Felipe Duarte para janela de execucao.
- Confirmacao manual do ambiente isolado antes de rodar qualquer SQL.
- Configuracao dos settings obrigatorios na mesma sessao SQL.
- Proibido executar com `service_role` no contexto desta fase.

## Settings obrigatorias (sem secrets)

Antes de `seed-pilot-dataset.sql`:

```sql
set app.pilot_target_ref = 'nsnmlleplpzsefzkuxlb';
set app.pilot_target_name = 'crm-qualyvac-restore-test';
set app.pilot_execution_approved = 'YES';
```

Antes de `cleanup-pilot-dataset.sql` (alem das acima):

```sql
set app.pilot_cleanup_execute = 'NO'; -- preview
-- alterar para YES somente com aprovacao explicita:
-- set app.pilot_cleanup_execute = 'YES';
```

## Ordem sugerida de execucao futura

1. `seed-pilot-dataset.sql`
2. `validate-pilot-dataset.sql`
3. `reconcile-pilot-dataset.sql`
4. `cleanup-pilot-dataset.sql` (somente quando aprovado e necessario)

## Hard-stop obrigatorio

Os scripts abortam quando:

- `app.pilot_target_ref` nao existe ou diverge de `nsnmlleplpzsefzkuxlb`
- `app.pilot_target_ref` e `cansbrrwrprcycjvgvqm` (staging)
- `app.pilot_target_name` nao existe ou diverge de `crm-qualyvac-restore-test`
- `app.pilot_execution_approved` nao existe ou nao e `YES`
- no cleanup, `app.pilot_cleanup_execute` nao e `YES` (fica em preview)

## Namespace e idempotencia

- Namespace/prefixo oficial: `PILOTO_MIGRACAO_20260621`
- Slug de tenant piloto: `piloto-migracao-20260621`
- Prefixos de rastreio: `Cliente Piloto`, `Contato Piloto`, `PIL-SKU-`, `PROP-PIL-`, `ORD-PIL-`, `Task PILOTO_MIGRACAO_20260621`, `Notif PILOTO_MIGRACAO_20260621`
- Insercoes com `where not exists` para evitar duplicidade
- Sem sobrescrever registros fora do namespace piloto

## Politica de auth/users (Fase 17A)

- Nao criar `auth.users` neste script.
- Nao usar emails reais; apenas identificadores sinteticos `@example.test`.
- `profiles` e `user_tenants` so aproveitam usuarios sinteticos preexistentes em `auth.users`.
- `user_roles` esta fora de escopo da Fase 17A (RBAC definitivo pendente); sem insert forcado.
- Trilha de criacao real de auth fica separada e aprovada em fase propria.

## Politica de logs/filas/auditoria

- Logs reais: fora do piloto.
- Filas reais: fora do piloto.
- Auditoria real: fora do piloto.
- Registros sinteticos apenas se forem inertes e identificados por namespace.
- Validacoes/reconciliacao usam checagens heuristicas tolerantes a ausencia de tabelas de fila.

## Politica de storage

- Nao criar objetos reais de storage nesta fase.
- Nao fazer upload/download real nesta fase.
- Metadata de storage fica como escopo futuro (fora da Fase 17A), salvo validacoes read-only quando aplicavel.

## Politica de integracoes

- Proibido disparar ERP/PDF/CNPJ/n8n/webhooks reais.
- Usar apenas estados seguros para evitar sincronizacao externa.
- No seed atual:
  - propostas: `draft` e `rejected`
  - pedidos: `draft` e `pending`
- Se alguma integracao depender de campo sem opcao segura, bloquear execucao e tratar em trilha separada.

## Politica de cleanup

- Nunca usar `truncate`.
- Sempre executar preview/contagens antes.
- Deletar somente registros do namespace piloto.
- Delecao em ordem inversa de dependencia.
- Cleanup somente com `app.pilot_cleanup_execute = 'YES'` e aprovacao explicita.

## Criterios de aprovacao

- Execucao apenas no alvo autorizado.
- Hard-stop validado com settings obrigatorios.
- Dataset piloto criado sem duplicidade indevida.
- Sem FK orfa critica no reconciliador.
- Sem integracao externa real disparada.
- Sem dado real/sensivel versionado ou inserido.
- Cleanup seguro disponivel e rastreavel por prefixo/namespace.

## Criterios de reprovacao

- Ambiente alvo incorreto ou nao isolado.
- Ausencia/divergencia de settings obrigatorias.
- Evidencia de gatilho de integracao externa real.
- Qualquer dado real/sensivel no fluxo.
- Divergencias criticas sem justificativa.
- Risco de cleanup afetar dados fora do piloto.

## Aviso critico

Nao executar estes scripts sem aprovacao explicita de Felipe Duarte.
Nao executar em staging/producao.
