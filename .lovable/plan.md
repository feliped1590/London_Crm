## Objetivo
Ao gerar o PDF da proposta, incluir uma seção final "Artes" com as imagens anexadas aos produtos presentes nos itens.

## Escopo
- Origem: `file_attachments` onde `entity_type='product'` e `entity_id` ∈ produtos da proposta.
- Filtro: apenas imagens (`mime_type` começando com `image/`).
- Layout: seção dedicada após a tabela de itens, agrupada por item/produto.
- Sem alterações em UI da proposta (apenas no PDF gerado).

## Alterações

### `supabase/functions/generate-proposal-pdf/index.ts`
1. Após o fetch de `items`, coletar `productIds` únicos.
2. Buscar anexos de imagem desses produtos:
   ```sql
   select id, entity_id, bucket, object_path, original_name, is_public, mime_type
   from file_attachments
   where entity_type='product' and entity_id in (...) and mime_type ilike 'image/%'
   order by created_at asc
   ```
3. Para cada anexo, gerar URL utilizável no PDF:
   - Se `is_public=true` → `getPublicUrl`.
   - Caso contrário → `createSignedUrl` (1h).
   - Bucket de produtos atualmente é privado; assumir signed URL como caminho padrão.
4. Indexar `attachmentsByProductId: Map<string, Array<{url, name}>>`.
5. Renderizar nova seção HTML após a tabela de itens e antes da seção de totais/condições, somente se houver pelo menos uma imagem:
   ```html
   <section class="artes">
     <h2>Artes dos Produtos</h2>
     <!-- por item, na ordem da proposta, sem duplicar produto -->
     <div class="arte-item">
       <h3>Item N — SKU — Descrição</h3>
       <div class="arte-grid">
         <figure><img src="..."/><figcaption>nome.png</figcaption></figure>
         ...
       </div>
     </div>
   </section>
   ```
6. CSS:
   - `.artes { page-break-before: always; }` para começar em página nova.
   - `.arte-grid { display:flex; flex-wrap:wrap; gap:12px; }`
   - `figure img { max-width: 320px; max-height: 320px; object-fit: contain; border:1px solid #e2e8f0; border-radius:4px; }`
   - `.arte-item { page-break-inside: avoid; margin-bottom: 24px; }`

### Sem migrações
Reutiliza `file_attachments` existente. RLS não bloqueia: a edge function usa service role.

## Fora de escopo
- Anexos por item específico da proposta.
- PDFs/outros tipos de anexo (apenas imagens).
- UI para escolher quais artes imprimir (imprime todas as imagens anexadas ao produto).

## Detalhes técnicos
- O HTML é convertido em PDF pelo motor já usado em `generate-proposal-pdf`; URLs assinadas precisam estar acessíveis publicamente durante a renderização (TTL 1h cobre).
- Numeração dos itens (`Item N`) usa o mesmo `index` já calculado em `itemsHtml`.
- Se um produto não tiver imagens, simplesmente não aparece na seção.
- Se nenhum item tiver imagens, a seção inteira é omitida (sem página em branco).
