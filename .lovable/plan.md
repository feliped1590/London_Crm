# Sincronização de atributos ERP — diagnóstico e correção

## O que está acontecendo

O toast **"Failed to send a request to the Edge Function"** é causado por **um único motivo concreto**:

> A função `process-attribute-sync` **existe no código mas nunca foi deployada** no Lovable Cloud.

Confirmado por:
- `curl` direto na função → `404 NOT_FOUND` ("Requested function was not found").
- Logs da função → vazios (nenhum boot, nenhum shutdown registrado).
- Arquivo `supabase/functions/process-attribute-sync/index.ts` presente e íntegro.

Por isso o botão **"Processar fila agora"** falha imediatamente no `supabase.functions.invoke(...)`, antes de qualquer lógica de payload rodar. Nada chega ao ERP.

## O payload já está correto?

**Sim.** A construção está conforme o padrão `IMP_ATRIBFICHA_V1`:

```json
{
  "tipoComando": "ASDCOMANDO",
  "grupoComando": "IMP_ATRIBFICHA_V1",
  "#out#p_retorno": "T",
  "json": "{\"empresa\":1,\"produto\":\"109839\",\"versao\":\"300x500x0,120\",\"atributo\":1,\"valor_padrao\":\"300\"}"
}
```

Regras já implementadas e corretas:
- 1 atributo por request
- `empresa`, `produto` (erp_product_code), `versao` (erp_versao), `atributo` (erp_codigo), `valor_padrao`
- `tolerancia_mais` / `tolerancia_menos` só quando `aceita_tolerancia = true`
- Bloqueio quando produto ainda não tem `erp_product_code`
- Retry exponencial até 5 tentativas
- Log append-only em `attribute_sync_log`

## Estado atual da fila

| Status | Qtd |
|---|---|
| pending | 46 |
| blocked_no_erp_code | 39 |

Os 39 bloqueados foram travados **antes** do produto receber o `erp_product_code`. Conferi alguns deles: o produto **já tem** `erp_product_code` agora (ex.: 110803), então estão presos por estado antigo da fila. Precisam ser re-enfileirados como `pending`.

## Plano de correção

### Passo 1 — Deploy da função (resolve o 404)
Fazer deploy de `process-attribute-sync`. Após isso, o botão "Processar fila agora" para de dar erro e começa a processar os 46 `pending`.

### Passo 2 — Reabrir os 39 itens `blocked_no_erp_code` cujo produto já recebeu código ERP
Migration única que faz:

```sql
UPDATE attribute_sync_queue q
SET status = 'pending',
    attempt_count = 0,
    error_message = NULL,
    next_retry_at = NULL,
    updated_at = now()
FROM products p
WHERE q.product_id = p.id
  AND q.status = 'blocked_no_erp_code'
  AND p.erp_product_code IS NOT NULL
  AND btrim(p.erp_product_code::text) <> '';
```

Itens cujo produto ainda não foi para o ERP permanecem `blocked_no_erp_code` (correto — eles destravam sozinhos quando o produto sincronizar via `process-product-sync`, conforme regra já existente).

### Passo 3 — Rodar a fila e validar
1. Disparar `process-attribute-sync` uma vez (botão da UI ou curl).
2. Conferir no banco: `attribute_sync_queue` deve ter `status='sent'` para os bem-sucedidos e `attribute_sync_log` deve ter o `response_body` real do ERP.
3. Se aparecer erro do ERP (`#ERRO#...`), a mensagem fica visível na coluna "Erro" da UI e no log — daí é tratamento caso a caso (atributo inexistente no ERP, versão errada, etc.).

## Fora de escopo (não vou tocar agora)
- Lógica de payload (já validada)
- Serializer Projedata
- RLS das tabelas `attribute_sync_*`
- Cron automático para drenar a fila — hoje é manual via botão, e está OK até validarmos o fluxo end-to-end.
