## Objetivo
Adicionar suporte ao atributo ERP **Tipo Solda** sem criar campo novo no cadastro de produto. O valor vem do **subgrupo** do produto e só é enviado ao ERP quando o produto for de grupo **Saco** ou **Stand Up** (via `ficha_profile`).

## Comportamento
- Cadastro de produto: **nada muda visualmente**. O subgrupo já existe.
- Tela "Atributos ERP → Mapeamento": ao criar mapeamento para o ERP code 5 (Tipo Solda), aparece uma nova opção no select "Campo do CRM":
  - **"Tipo Solda — derivado do Subgrupo"**.
- Sync `IMP_ATRIBFICHA_V1`: envia `valor_padrao = label do subgrupo` (ex.: `"2 SOLDAS"`, `"FUNDO RETO"`).
- Se o produto pertencer a grupo cujo `ficha_profile` ≠ `saco_*` / `stand_up_*` → o atributo **não é enfileirado** (nem se houver mapeamento). Se já existir item na fila e o grupo mudar, é descartado/limpo.
- Se o subgrupo estiver vazio ou produto fora do escopo → a fila marca esse item como inválido (`error_message: "Produto fora do escopo de Tipo Solda"`) sem retry infinito.

## Mudanças técnicas

### 1. Banco (migration)
- Adicionar `crm_source = 'derived'` como valor aceito em `product_attribute_mapping` (atualizar CHECK constraint).
- Atualizar função `extract_attribute_value(p_product, p_source, p_path)`:
  - Quando `p_source = 'derived'` e `p_path = 'tipo_solda'`:
    - Buscar `ficha_profile` do grupo do produto (`product_groups.ficha_profile` via `p_product.grupo_id`).
    - Se profile ∉ {`saco_liso`,`saco_impresso`,`stand_up_liso`,`stand_up_impresso`} → `RETURN NULL`.
    - Senão, retornar `product_subgroups.label` correspondente a `p_product.subgrupo_id`.
- Atualizar trigger `detect_dirty_attributes` para reenfileirar atributos derivados quando `subgrupo_id` ou `grupo_id` mudar.

### 2. Edge function `process-attribute-sync`
- Quando `valor_padrao` vier `NULL` para mapeamento `derived/tipo_solda`, marcar item como `status='skipped_out_of_scope'` (novo status) em vez de erro com retry.
- Manter resto do fluxo.

### 3. Frontend `ErpAttributeMappingManager.tsx`
- Adicionar opção em `CRM_PATH_PRESETS`:
  ```ts
  { label: 'Tipo Solda — derivado do Subgrupo', source: 'derived', path: 'tipo_solda' }
  ```
- Estender tipos locais `Mapping.crm_source` para incluir `'derived'`.

### 4. Memória
- Atualizar `mem://integrations/erp-attribute-sync` documentando o source `derived` e o gate por `ficha_profile`.

## Fora de escopo
- Sem novo campo de UI no cadastro de produto.
- Sem alteração no `FichaTecnicaSection`.
- Sem nova tabela: reaproveita `product_subgroups.label` direto.
