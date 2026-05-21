## Contexto

Itens com mais de uma versão ativa (`products.parent_product_id` apontando para o pai) já são linhas próprias em `products`, com `versao_numero = 2, 3...`. Cada linha entra na fila `product_sync_queue` quando muda. O mapper V2 (`product-mapper-v2.ts`) já lê `versao_numero` e monta o envelope com `codigo = parent.erp_product_code` + `versoes:[{versao: String(versao_numero), detalhes: erp_versao, ...}]`.

## O que está errado hoje

Olhando o `product_sync_log` da v2 do produto 110793 (id `158e7014…`), o payload enviado foi:
```json
{"codigo":"110793","versoes":[{"versao":"1","roteiro":1,"situacao":"A","detalhes":"300x350x0,160"}]}
```
Ou seja, foi mandado `versao:"1"` com dimensões da v2. Resultado: o ERP **sobrescreveu** a v1 e nunca criou a v2. Confirma na tabela: `erp_versao_codigo = 1` para ambas as versões do mesmo produto.

A causa raiz é que, no momento daquele envio, `versao_numero` ainda não estava preenchido como `2` (o trigger `trg_assign_product_versao_numero` foi adicionado depois, ou o ProductVersionsTab criou o filho sem stripar o campo antes do trigger existir). Hoje:
- O trigger existe (`BEFORE INSERT`, atribui MAX+1).
- O mapper já faz `String(p.versao_numero ?? 1)`.
- `loadProductForSync` já seleciona `versao_numero` e o repassa.

Então a lógica nova funciona. O que precisamos é (a) consertar o legado e (b) blindar contra cenários de erro.

## Mudanças

### 1. Re-sincronizar versões legadas com `versao_numero ≥ 2`

Migration que:
- Para cada produto onde `parent_product_id IS NOT NULL` e `versao_numero >= 2`, marca `pendente_envio = true` e insere em `product_sync_queue` com `status='pending'` (idempotente via `ON CONFLICT`).
- Não altera `erp_product_code` (ele já é o do pai, correto).

### 2. Persistir `erp_versao_codigo` após sync de versão

Em `supabase/functions/process-product-sync/index.ts`, no bloco de sucesso (linhas ~240-260), além de gravar `erp_product_code` no CREATE, gravar também:
```ts
productUpdate.erp_versao_codigo = String(productForSync.versao_numero ?? 1);
productUpdate.erp_versao_situacao = 'A';
```
Assim a UI passa a refletir o número da versão real do ERP (hoje todas mostram `erp_versao_codigo=1` mesmo sendo v2).

### 3. Defender contra envio de filho sem pai sincronizado

Em `loadProductForSync` (`product-validator.ts`), quando `parent_product_id` não é nulo:
- Buscar `parent.erp_product_code`.
- Se o produto filho não tiver `erp_product_code` próprio, **herdar** do pai naquele momento.
- Se o pai também não tiver, lançar erro de validação claro: `"Versão não pode ser sincronizada antes do produto principal ter código ERP"`. O `process-product-sync` já trata erro de validação adiando o item.

### 4. Memória

Atualizar `mem://integrations/erp-attribute-sync` (ou criar `mem://integrations/erp-product-version-sync`) registrando:
- v1 = produto pai; v2+ = filhos com `parent_product_id`.
- Payload por versão: `codigo` é o do pai, `versoes[0].versao = String(versao_numero)`.
- Após sync, `erp_versao_codigo` espelha `versao_numero`.

## Fora de escopo

- Não vou unificar envio de várias versões em um único request (cada versão continua sendo um item de fila independente — é mais simples e respeita o sistema atual de retry/log por versão).
- Não vou alterar o trigger `assign_product_versao_numero` (já está correto).
- Não vou mexer no fluxo de atributos — o `process-attribute-sync` já usa `erp_versao_codigo`, e o passo 2 acima vai alimentar esse campo certinho para as novas versões.

## Como testar

1. Aprovar a migration → fila terá novamente as v2 pendentes.
2. Rodar "Processar fila agora".
3. Conferir em `product_sync_log` que o payload da v2 do 110793 agora sai com `"versao":"2"`.
4. Conferir que `products.erp_versao_codigo` da v2 vira `"2"`.
5. Disparar uma sincronização de atributo da v2 e validar no ERP.
