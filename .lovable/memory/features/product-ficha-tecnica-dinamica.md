---
name: Ficha Técnica Dinâmica por Grupo
description: Campos dinâmicos por perfil de grupo (Stand Up/Saco/Bobina, Liso/Impresso) salvos em products.ficha_tecnica jsonb
type: feature
---
Cadastro de produtos exibe a aba "Ficha Técnica" com campos condicionais ao `ficha_profile` do grupo.

## Perfis (`product_groups.ficha_profile`)
`none`, `stand_up_liso`, `stand_up_impresso`, `saco_liso`, `saco_impresso`, `bobina_lisa`, `bobina_impressa`. Configurado em "Cadastro Básico → Ficha Técnica → Perfil de Ficha por Grupo".

## Blocos por perfil
- Stand Up (picote/zíper): stand_up_liso, stand_up_impresso
- Acessórios + Embalagem (Fardo/Caixa+qtd): todos os Stand Up e Saco
- Bobina (tubete, peso, diâmetro, metragem, emendas): bobina_lisa, bobina_impressa
- Sentido de embobinamento: somente bobina_impressa
- Impressão (tipo, local, repetições, passo, cilindro, máquina, cameron, fotocélula, cores): todos os perfis "impresso"
- Observações: todos os perfis
- **Sanfona** (toggle + Localização Lateral/Fundo + Valor mm): disponível em todos os Stand Up e Saco; **obrigatória** quando o grupo é Stand Up (`stand_up_liso`/`stand_up_impresso`) **ou** quando "sanfona" aparece em `name`/`nome_impresso`. Salva em `ficha_tecnica.sanfona = { ativa, local, valor }`.

## Concatenação Sanfona no payload ERP
- `Lateral` concatena com **Largura** → `${width}+${valor}` (ex.: `100+30`).
- `Fundo` concatena com **Comprimento** → `${length}+${valor}`.
- Aplicado em dois pontos: (1) `generateErpVersion` → string `erp_versao` enviada em `detalhes` do payload de produto; (2) função SQL `extract_attribute_value` → `valor_padrao` dos atributos Largura/Comprimento enviados via `IMP_ATRIBFICHA_V1`. O trigger `detect_dirty_attributes` reenfileira automaticamente quando a sanfona muda.
- Não é estrutural: não entra em `structure_hash`, pode ser editada após criação.

## Persistência
Coluna `products.ficha_tecnica jsonb` (default `{}`). Não entra em `structure_hash`, é editável após criação.

## Lookups novos (gerenciáveis por Admin/Dev)
- `product_ficha_machines` — Máquinas
- `product_ficha_cylinders` — Diâmetros de cilindro
- `product_ficha_accessories` — Acessórios

## Componentes
- `src/components/products/FichaTecnicaSection.tsx` — render condicional
- `src/components/products/GroupFichaProfileManager.tsx` — atribui perfil por grupo
- `src/hooks/useFichaLookups.ts` — máquinas/cilindros/acessórios
- `src/hooks/useProductLookups.ts` — `GroupLookupItem.ficha_profile` adicionado
