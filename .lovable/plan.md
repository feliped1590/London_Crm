# Versões independentes com SKU, descrição e atributos próprios

## Problema

Hoje, ao criar uma nova versão em `ProductVersionsTab`:
- O filho herda o `name` (cadastro completo) do pai — que termina com o `erp_versao` do pai. Resultado: 5 versões diferentes aparecem com o mesmo nome.
- O `sku` é gravado como placeholder (`"<pai>-v"`).
- Os atributos (ficha técnica e demais campos editáveis) ficam compartilhados via cópia inicial, mas não há fluxo claro para editar cada versão de forma isolada.

## Objetivo

Cada versão (pai e filhos) é uma linha **independente** em `products`:

1. **SKU, `erp_versao` e `name`** recalculados a partir das próprias dimensões.
2. **Atributos editáveis por versão** (ficha técnica, fiscal por versão se aplicável, dimensões, observações, etc.) — alterar uma versão **não** afeta as outras.

A relação `parent_product_id` continua existindo apenas como agrupamento visual (linhagem da família de versões). Não há mais propagação automática do pai para os filhos.

## Mudanças

### 1. Criação de versão — `src/components/products/ProductVersionsTab.tsx`

No `handleCreate`, antes do `insert`:

1. Reaproveitar lookups (`useProductLookups`) para obter labels/códigos.
2. Calcular o perfil de dimensão do grupo (mover `getGroupProfile` de `Products.tsx` para util compartilhado `src/utils/products/getGroupProfile.ts`).
3. Gerar para o filho:
   - `erp_versao` via `generateErpVersion(profile, w, l, t, extractGusset(parent.ficha_tecnica))`
   - `sku` via `generateStructuralSku({ tipoCode, familyCode, groupCode, subgroupCode, classCode, width:w, length:l, thickness:t, dimensionProfile: profile })`
   - `name` via `generateProductDescription({ family, group, subgroup, productClass, printedName: parent.nome_impresso })` + `erp_versao` do filho
4. **Clonar** a `ficha_tecnica` do pai como ponto de partida (snapshot inicial), depois cada versão evolui independente.
5. Enviar `erp_versao`, `sku`, `name`, `ficha_tecnica` clonada e demais campos herdados no `childPayload` (substitui o placeholder atual de `sku`).

`sku_unique` continua sendo gerado pelo trigger `trg_generate_sku_unique`.

### 2. Edição de versão

Permitir abrir cada linha da tabela em `ProductVersionsTab` no mesmo formulário de produto, mas vinculado ao **id da versão** (filho), não do pai. O `handleEdit` em `Products.tsx` já carrega por id — adicionar botão "Editar" por linha na tabela de versões que invoca o mesmo dialog para o filho.

Ao salvar:
- Recalcular `erp_versao`, `sku` e `name` da própria versão (já há lógica em `Products.tsx` que cobre isso para o pai — passa a aplicar igual para filhos).
- `pendente_envio = true`, `origem_alteracao = 'CRM'` para sincronizar com ERP.
- **Nenhuma propagação** para outras versões.

### 3. Remoção de propagação implícita

- **Não criar** trigger de propagação pai → filhos.
- Garantir que nenhum job/trigger atual sobrescreva campos das versões com valores do pai. Auditar:
  - `compute_product_erp_hash` — já usa campos da própria linha, OK.
  - `detect_dirty_attributes` (fila de atributos ERP) — já reage por produto individual, OK.
  - Verificar se há outras queries em edge functions / hooks que filtram por `parent_product_id IS NULL` e replicam — não aplicar.

### 4. Listagem na aba (mesmo componente)

A tabela passa a exibir:
- Versão, Dimensões, SKU, `erp_versao`, **Descrição (`name`)**, Status
- Ação "Editar" (abre formulário do filho) e "Inativar/Reativar".

### 5. Migration de backfill

Script idempotente para versões existentes:
- Recalcular `erp_versao`, `sku`, `name` de cada filho a partir das suas próprias dimensões e dos lookups herdados.
- Manter `ficha_tecnica` atual de cada versão (não sobrescrever).
- Marcar `pendente_envio = true` e `origem_alteracao = 'CRM'`.

### 6. Memória

Atualizar `mem://features/product-structural-immutability-and-sku-architecture`:
- Cada versão é independente: SKU, `erp_versao`, `name`, `ficha_tecnica` e atributos são por versão.
- `parent_product_id` é apenas linhagem; pai e filhos compartilham apenas o `erp_product_code` (mesma identidade no ERP) e os lookups iniciais no momento da criação.

## Fora de escopo

- Mudar regra de imutabilidade de campos técnicos (continuam imutáveis após criação, por versão).
- Alterar fluxo de sincronização ERP além de marcar `pendente_envio` no recálculo.
- Unificar formulário (ainda é o mesmo `ProductDialog`, apenas invocado com o id do filho).
