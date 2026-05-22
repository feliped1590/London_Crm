## Diagnóstico

Cliente exibido como **CAFELLOW** (CNPJ 53.817.395/0001-86, nome real no banco: *TMP COMERCIO DE BEBIDAS LTDA*, id `19252384-71b3-4dda-b69a-b82519022043`).

A fila `company_sync_queue` tem **1 item travado** desde **21/05 19:08** com:

- `status = 'processing'`
- `attempts = 0`
- `error_message = null`
- `processed_at = null`

Não há logs da edge `process-company-sync` para esse item — o worker começou a processar (fez o lock pulando de `pending` → `processing` na linha 224 de `process-company-sync/index.ts`) mas **morreu antes de finalizar** (timeout, crash ou deploy no meio da execução).

### Por que ficou eternamente "Processando"

1. O worker só pega itens com `status = 'pending'` (linha 147). Itens em `processing` nunca são retomados.
2. O botão de retentar do usuário retorna cedo nas linhas 107–109:
   ```ts
   if (existingEntry?.status === 'processing') {
     return jsonResponse({ ..., message: 'Cliente já está sendo processado na fila' });
   }
   ```
   Ou seja, o usuário não consegue destravar pela UI — sempre vê "já está sendo processado".
3. Não existe nenhum mecanismo de **stale-lock recovery** (timeout de execução, cron de limpeza, etc).

Esse é um bug latente: qualquer crash/timeout durante o sync deixa o cliente preso para sempre.

## Plano

### 1. Destravar imediatamente o item da CAFELLOW/TMP

Migração SQL única, resetando o registro para `pending`:

```sql
UPDATE company_sync_queue
SET status = 'pending',
    attempts = 0,
    error_message = NULL,
    next_retry_at = NULL,
    processed_at = NULL,
    updated_at = now()
WHERE id = '41967ab9-b86a-4069-9f4a-56f80fe0b5fc'
  AND status = 'processing';
```

Próximo tick do cron `process-company-sync` (ou clique manual no avião) faz o sync normalmente.

### 2. Prevenir o problema (stale-lock recovery)

Em `supabase/functions/process-company-sync/index.ts`, **antes** de buscar a fila pendente (antes da linha 144), adicionar um pequeno bloco que devolve para `pending` qualquer item em `processing` há mais de **5 minutos**:

```ts
// Recupera locks órfãos (worker morreu antes de finalizar)
const staleThreshold = new Date(Date.now() - 5 * 60_000).toISOString();
await supabase
  .from('company_sync_queue')
  .update({
    status: 'pending',
    error_message: 'Recuperado de lock órfão (worker anterior não finalizou)',
    updated_at: new Date().toISOString(),
  })
  .eq('status', 'processing')
  .lt('updated_at', staleThreshold);
```

Também ajustar o early-return das linhas 107–109 para aplicar a mesma regra: se o item está em `processing` mas o `updated_at` é mais antigo que 5 minutos, considerar órfão e resetar antes de seguir o fluxo normal (em vez de retornar a mensagem de "já está sendo processado").

### 3. Validação

- Após aplicar a migração: `SELECT status FROM company_sync_queue WHERE id = '41967ab9-...'` → deve estar `pending`.
- Acompanhar próximo run da edge function e confirmar que o cliente vai para `synced` ou `error` (com mensagem real).
- Em runs futuros, qualquer item travado por crash será auto-recuperado em até 5 min.

## Fora de escopo

- Não vou mexer no nome exibido na UI ("CAFELLOW" vs nome real no banco) — é outra investigação.
- Não vou alterar lógica de mapper/validator do company sync.
