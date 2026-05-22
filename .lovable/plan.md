## Problema

A tabela `cron.job_run_details` chegou a **394 MB** — maior tabela do banco, consumindo ~200 MB nas últimas 24h. Não existe retenção automática, e há jobs rodando sem necessidade.

## Diagnóstico dos cron jobs

### Dispatchers a cada 30s (mantém — são necessários)

São pares de jobs (job principal + offset com `pg_sleep(30)`) que verificam filas de sincronização com o ERP:

- `dispatch-company-sync-30s` + `-offset` → `process-company-sync`
- `dispatch-order-sync-30s` + `-offset` → `process-order-sync`
- `dispatch-product-sync-30s` + `-offset` → `process-product-sync`

Cada disparo usa `WHERE EXISTS (... status = 'pending')`, então só chama a edge function se houver item na fila. **A função em si raramente roda** — mas a checagem do cron sempre registra uma linha no histórico. Isso é o padrão "dispatcher 30s" já documentado no projeto.

### `process-scheduled-emails` (remover)

Rodando a cada minuto desde janeiro = 177.637 execuções. Os logs mostram que toda execução retorna **"No scheduled emails to process"**. O módulo de e-mails não está em uso. **Esse é o maior responsável pelo histórico acumulado.**

### `process-product-sync-every-5min` (remover — redundante)

Faz exatamente a mesma coisa que `dispatch-product-sync-30s`, mas sem o filtro `WHERE EXISTS`. Foi substituído pelos dispatchers de 30s.

## Ações

1. **Remover jobs obsoletos:**
   - `cron.unschedule('process-scheduled-emails')`
   - `cron.unschedule('process-product-sync-every-5min')`

2. **Criar retenção automática de 7 dias** para `cron.job_run_details` e `net._http_response`:
   - Novo job `cleanup-cron-history-daily` rodando às 02:30 BRT
   - `DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';`
   - `DELETE FROM net._http_response WHERE created < now() - interval '7 days';`

3. **Limpeza imediata one-shot:**
   - Apagar tudo > 7 dias agora (libera ~390 MB)
   - Rodar `VACUUM (ANALYZE) cron.job_run_details; VACUUM (ANALYZE) net._http_response;` para devolver o espaço ao disco

## Out of scope

- Não mexer nos dispatchers de 30s — são parte da arquitetura de sincronização com o ERP.
- Não mexer no módulo de e-mails (continua disponível para quando for ativado — só remove o job que rodava no vazio).
- Sem mudança em código de aplicação.

## Resultado esperado

- Liberação imediata de **~390 MB** de disco
- Crescimento futuro estabilizado em ~60 MB de pico (apenas 7 dias dos dispatchers)
- Disco volta a ter 7+ GB livres, sem precisar fazer upgrade da instância
- Logs do banco voltam a ser legíveis (177k linhas de "no email to process" some)

## Observação sobre o módulo de e-mails

Quando o módulo for ativado de fato (envio de e-mails transacionais ou de autenticação), o setup oficial recria o cron necessário automaticamente. Remover agora não compromete nada.