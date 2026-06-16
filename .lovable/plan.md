## Problema

No vídeo, os atributos "Diâmetro cilindro" e "Máquina" estão chegando ao ERP Projedata com UUIDs (ex.: `33df258f-24bb-4049-…`, `038fb46a-955e-4fe2-9…`) em vez do valor que o ERP espera (o código numérico do cilindro em mm e o código da máquina).

## Causa

O mapeamento atual aponta:

- `Diâmetro cilindro` → `impressao.cilindro_id`
- `Máquina` → `impressao.maquina_id`

Esses campos da `ficha_tecnica` armazenam o UUID do registro em `product_ficha_cylinders` / `product_ficha_machines`. A função SQL `extract_attribute_value` simplesmente lê o JSON pelo caminho, então grava o UUID em `product_attribute_values.valor_padrao`, e o edge function `process-attribute-sync` envia esse UUID ao ERP.

A coluna `value` dessas tabelas é justamente o código que o ERP espera (`"1684"`, `"270"`, `"201"`, etc.).

## Correção

1. **Atualizar `public.extract_attribute_value`** para, quando `p_source = 'ficha_tecnica'` e o `p_path` for `impressao.cilindro_id` ou `impressao.maquina_id`:
   - Ler o UUID no JSON normalmente.
   - Resolver via `SELECT value FROM product_ficha_cylinders WHERE id = uuid` (ou `product_ficha_machines`).
   - Retornar `value` (texto) — ou `NULL` se UUID não existir/estiver inativo.
   - Caso o conteúdo do path já seja um texto que não é UUID (compatibilidade retroativa), retornar como está.

2. **Reprocessar valores existentes** (one-shot, dentro da mesma migration):
   - Para cada produto com `ficha_tecnica->impressao->>'cilindro_id'` ou `maquina_id` preenchido:
     - Recalcular `product_attribute_values.valor_padrao` chamando `extract_attribute_value` dos atributos com `crm_path` em (`impressao.cilindro_id`, `impressao.maquina_id`).
     - Marcar `dirty = true`, limpar `last_sync_error`.
   - Enfileirar em `attribute_sync_queue` (status `pending`) os itens correspondentes para reenvio ao ERP — reaproveitando a lógica do trigger existente `detect_dirty_attributes` (ou inserção direta com `ON CONFLICT DO UPDATE` para `status='pending'`, `attempt_count=0`).

3. **Verificação**: após a migration, conferir alguns registros via SELECT mostrando `valor_padrao` agora numérico (ex.: `"270"`, `"201"`) e disparar `process-attribute-sync` para um produto piloto.

## Arquivos afetados

- Nova migration SQL (alteração da function `extract_attribute_value` + UPDATE/INSERT de re-sync).
- Nenhuma alteração no edge function `process-attribute-sync` ou no frontend.

## Observação

Não é necessário criar coluna nova nem mexer no schema da `ficha_tecnica`. A correção fica isolada na função de extração, mantendo a forma como o formulário grava (UUID) e como o ERP recebe (código `value`).
