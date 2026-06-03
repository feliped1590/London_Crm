
## 1. Versão 2 fica "Não enviado" mesmo após sync OK

### Causa
Em `loadProductForSync` (`supabase/functions/_shared/projedata/product-validator.ts`), quando o filho não tem `erp_product_code`, ele **herda em memória** o código do pai. Isso faz `isProductUpdate()` retornar `true`, e o bloco em `process-product-sync` que persiste `erp_product_code` só roda quando `!isUpdate`. Resultado: a fila marca `completed`, mas a linha do filho continua com `erp_product_code = NULL` → o `ProductSyncBadge` mostra "Não enviado", e os itens em `attribute_sync_queue` permanecem `blocked_no_erp_code` (porque o `process-attribute-sync` lê o `erp_product_code` da linha do filho).

### Correção (`supabase/functions/process-product-sync/index.ts`)
Após o sync de sucesso, sempre persistir `erp_product_code` na linha quando estiver vazia, usando: `parsedResult.erpCode` (se ERP retornou) **ou** o código herdado do pai (`productForSync.erp_product_code`). Isso vale para filhos (v2+) e mantém o comportamento atual do v1.

Em seguida, manter a chamada `release_blocked_attributes` + drain de `process-attribute-sync` (já existem) — agora elas funcionarão porque a linha terá `erp_product_code`.

### Reparo do registro atual
Migração one-shot para os filhos já sincronizados sem código:

```sql
UPDATE public.products c
SET erp_product_code = p.erp_product_code,
    origem_alteracao = 'SYNC'
FROM public.products p
WHERE c.parent_product_id = p.id
  AND c.erp_product_code IS NULL
  AND p.erp_product_code IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.product_sync_queue q
    WHERE q.product_id = c.id AND q.status = 'completed'
  );

-- Reabrir atributos bloqueados desses filhos
UPDATE public.attribute_sync_queue q
SET status = 'pending', error_message = NULL, next_retry_at = NULL, updated_at = now()
FROM public.products c
WHERE q.product_id = c.id
  AND q.status = 'blocked_no_erp_code'
  AND c.erp_product_code IS NOT NULL;
```

(Sem alterar regra do `IMP_ITEM_VERSAO_TESTE` — o envio de atributos da v2 continua via `IMP_ATRIBFICHA_V1`, agora desbloqueado.)

## 2. Identificação da versão na listagem de produtos

`src/pages/Products.tsx` (tabela em torno da linha 2237): exibir `v{versao_numero}` ao lado do SKU quando `versao_numero > 1`. Sem badge para v1 (subentendido).

```tsx
<TableCell className="font-mono font-medium">
  <div className="flex items-center gap-2">
    <span>{product.sku}</span>
    {(product as any).versao_numero > 1 && (
      <Badge variant="outline" className="text-[10px]">v{(product as any).versao_numero}</Badge>
    )}
  </div>
</TableCell>
```

Listagem já faz `select('*')`, então `versao_numero` está disponível — sem mudança de query.

## 3. Largura total da área "Versões" no cadastro

A aba "Geral" do formulário usa `<div className="grid grid-cols-2 gap-4">`. O bloco `Versões` em `src/pages/Products.tsx` (~linha 2009) está **sem** `col-span-2`, então ocupa apenas metade da largura.

Adicionar `col-span-2` ao wrapper do bloco e remover `-mx-6 px-6` (que provoca overflow horizontal junto com `overflow-y-auto` do DialogContent), substituindo por `col-span-2 pt-4 border-t mt-4`.

Em `src/components/products/ProductVersionsTab.tsx`, garantir `w-full` no contêiner externo da tabela e manter `table-fixed` para o header sticky funcionar até o fim.

## Arquivos alterados

- `supabase/functions/process-product-sync/index.ts` — persistir `erp_product_code` também em filhos (mesmo quando `isUpdate=true` por herança).
- Nova migração — reparar filhos já sincronizados e reabrir atributos bloqueados.
- `src/pages/Products.tsx` — badge `vN` na listagem + `col-span-2` no bloco Versões.
- `src/components/products/ProductVersionsTab.tsx` — garantir largura total do contêiner.

## Fora do escopo

- Mudanças no payload IMP_ITEM_VERSAO_TESTE / mapper.
- Mudanças em RLS ou triggers de `attribute_sync_queue`.
- Re-trigger automático de envio de atributos (será disparado pelo drain existente após o `release_blocked_attributes`).
