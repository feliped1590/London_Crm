# Corrigir campo `versao` no payload IMP_ATRIBFICHA_V1

## Causa raiz
A função `process-attribute-sync` está enviando o **descritivo dimensional** (`products.erp_versao` = `"320x0,070"`) no campo `versao`. O ERP espera o **número da versão ativa** (`"1"`, `"2"`, ...).

## Verificação no banco
A tabela `products` já tem os campos certos populados:

| produto | erp_versao (descritivo) | erp_versao_codigo | versao_numero | erp_versao_situacao |
|---|---|---|---|---|
| 110790 | 320x0,070 | **1** | 1 | A (ativo) |
| 109839 | 300x500x0,120 | **1** | 1 | A |
| 109056 | 200x250x0,120 | **1** | 1 | A |

Ou seja: a fonte correta é **`erp_versao_codigo`** (string) com fallback para **`versao_numero`** (int → string).

## Mudança

Arquivo: `supabase/functions/process-attribute-sync/index.ts`

1. Incluir `erp_versao_codigo, versao_numero` no `select` do produto.
2. Trocar a montagem do `inner.versao`:
   ```ts
   const versao = product.erp_versao_codigo
     ?? (product.versao_numero != null ? String(product.versao_numero) : null);
   if (!versao) throw new Error('Produto sem versão ERP ativa (erp_versao_codigo/versao_numero vazio)');
   inner.versao = versao;
   ```
3. Deploy da função.
4. Resetar os itens `pending` que já erraram com "Produto/Versão não encontrado" para `attempt_count = 0` e rodar a fila novamente.

## Payload resultante (correto)
```json
{
  "tipoComando": "ASDCOMANDO",
  "grupoComando": "IMP_ATRIBFICHA_V1",
  "#out#p_retorno": "T",
  "json": "{\"empresa\":1,\"produto\":\"110790\",\"versao\":\"1\",\"atributo\":85,\"valor_padrao\":\"2\"}"
}
```

## Fora de escopo
- Não vou alterar o `erp_versao` (descritivo dimensional) — ele continua sendo usado nas demais sincronizações de produto, conforme regra de negócio existente.
- Não vou mexer no erro `ORA-06502` (line 81) — vamos tratá-lo separadamente depois que o "Produto/Versão não encontrado" sair do caminho, pois ele pode estar mascarando o erro de tipo.
