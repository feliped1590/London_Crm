## Objetivo

Permitir que **qualquer** alteração em um produto já vinculado ao ERP (dimensões **e** classificação — tipo, família, grupo, subgrupo, classe) seja salva no CRM, regere `erp_versao`/SKU automaticamente, marque `pendente_envio=true` e dispare nova sincronização **mantendo o mesmo `erp_product_code`** (update no ERP, não criação).

Esta mudança **revoga** a regra-núcleo registrada na memória ("Product tech fields & dimensions are immutable"). Passa a valer: produto sincronizado é editável em todos os campos; cada alteração é refletida no payload do ERP via fila de sync.

## Mudanças

### 1) Banco — remover trigger de imutabilidade estrutural

`DROP` do trigger `trg_protect_product_structure` e da função `protect_product_structure()`. Sem checagens — `tipo_id`, `family_id`, `grupo_id`, `subgrupo_id`, `class_id`, `width`, `length`, `thickness` ficam editáveis mesmo com `erp_product_code` preenchido.

Os triggers existentes cuidam do resto automaticamente:
- `mark_product_pending_sync_before` recomputa `erp_hash`, seta `pendente_envio=true` e `origem_alteracao='CRM'`.
- `mark_product_pending_sync_after` insere em `product_sync_queue`.
- `a_auto_erp_versao` regera `erp_versao` a partir das novas dimensões.
- `trg_generate_sku_unique` regera `sku_unique`.
- `detect_dirty_attributes` marca atributos sujos quando a ficha técnica muda.

### 2) Frontend — `src/pages/Products.tsx`

- `updateMutation.onSuccess`: além de invalidar `['products']`, invalidar `['product-versions', parent_product_id ?? id]` para o grid de Versões recarregar imediatamente após **Atualizar**.
- `updateMutation.onError`: exibir a `error.message` real do banco (hoje engole tudo num toast genérico). Mantém o detector de duplicidade existente.
- Toast de sucesso: "Produto atualizado! Sincronização com ERP enfileirada."

Nenhuma mudança no `handleSubmit` — já envia `width/length/thickness/erp_versao/grupo_id/...` recalculados.

### 3) Memória do projeto

Atualizar `mem://index.md` (Core) e `mem://features/product-structural-immutability-and-sku-architecture` para refletir:
- Produto sincronizado **é editável em todos os campos** (dimensões e classificação).
- Cada alteração regera `erp_versao`/SKU/`sku_unique` e é re-enviada ao ERP no mesmo `erp_product_code`.
- Duplicar Produto deixa de ser o único caminho — vira opcional, para casos onde o usuário realmente quer um novo registro/código no ERP.

## Detalhes técnicos

Migration:

```sql
DROP TRIGGER IF EXISTS trg_protect_product_structure ON public.products;
DROP FUNCTION IF EXISTS public.protect_product_structure();
```

Frontend (`src/pages/Products.tsx`, dentro do `updateMutation`):

```ts
onSuccess: (updatedProduct) => {
  queryClient.invalidateQueries({ queryKey: ['products'] });
  const versionsKey = (updatedProduct as any).parent_product_id ?? updatedProduct.id;
  queryClient.invalidateQueries({ queryKey: ['product-versions', versionsKey] });
  recordProductInteraction({
    entityId: updatedProduct.id,
    tenantId: updatedProduct.tenant_id,
    interactionType: 'update',
  });
  toast.success('Produto atualizado! Sincronização com ERP enfileirada.');
  resetForm();
},
onError: (error: any) => {
  const duplicateMessage = getDuplicateErrorMessage(error);
  toast.error(
    duplicateMessage || error?.message || 'Erro ao atualizar produto',
    { duration: 8000 },
  );
},
```

## Teste manual

1. Abrir o produto (LAMINADO METALIZADO … 175×280×0,170, já com `erp_product_code`).
2. Mudar **espessura** para `0,12` → form mostra `erp_versao = 175x280x0,120` e descrição atualizada.
3. Clicar **Atualizar** → toast de sucesso, grid de Versões reflete `175 × 280 × 0,12` e `175x280x0,120` imediatamente.
4. Conferir em `product_sync_queue` que existe linha `pending` para o `product_id` (mesmo `erp_product_code`).
5. Após `process-product-sync` rodar, o produto vai ao ERP como **update** (mesmo código), com novo `erp_versao`.
6. Editar **Grupo** ou **Família** → também salva, regera SKU/`erp_versao` e enfileira sync. Sem mensagem de bloqueio.

## Riscos e ressalvas

- Histórico: alterar classificação reescreve a identidade do produto no CRM sem criar um novo registro — não há "antes/depois" rastreável a não ser pelos logs (`erp_sync_logs`, `product_sync_log`, `audit_logs`).
- Duplicidade: `idx_products_technical_uniqueness` ainda vale; se a nova combinação colidir com outro produto ativo, o update falha e o toast mostrará a mensagem real.
- ERP: o Projedata recebe um `IMP_PRODUTO` com o mesmo código e os novos campos — comportamento de update já implementado em `buildProductPayloadV2` / `isProductUpdate`.

## Não está no escopo

- Alterar a função de fila, o mapper V2 ou a edge `process-product-sync` (já tratam update por `erp_product_code`).
- Política de "Nova versão" — continua disponível para quem quiser variações em vez de editar a principal.
