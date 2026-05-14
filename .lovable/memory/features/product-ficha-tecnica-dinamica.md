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

## Persistência
Coluna `products.ficha_tecnica jsonb` (default `{}`). Não entra em `structure_hash`, é editável após criação. Não é enviada ao ERP.

## Lookups novos (gerenciáveis por Admin/Dev)
- `product_ficha_machines` — Máquinas
- `product_ficha_cylinders` — Diâmetros de cilindro
- `product_ficha_accessories` — Acessórios

## Componentes
- `src/components/products/FichaTecnicaSection.tsx` — render condicional
- `src/components/products/GroupFichaProfileManager.tsx` — atribui perfil por grupo
- `src/hooks/useFichaLookups.ts` — máquinas/cilindros/acessórios
- `src/hooks/useProductLookups.ts` — `GroupLookupItem.ficha_profile` adicionado
