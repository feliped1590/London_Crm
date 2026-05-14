---
name: Ficha Técnica Schema-Driven (Fase 0)
description: Arquitetura declarativa para ficha técnica — tabela ficha_schemas versionada, renderer dinâmico inativo, separação CORE vs dinâmico
type: feature
---
Evolução do bloco "Ficha Técnica" do produto para arquitetura schema-driven.

## Estado atual (Fase 0 entregue)
- Tabela `ficha_schemas` (tenant_id, key, version, is_active, definition jsonb) com 1 versão ativa por (tenant,key) via índice parcial.
- Seed v1 dos 6 perfis: stand_up_liso, stand_up_impresso, saco_liso, saco_impresso, bobina_lisa, bobina_impressa — replica 1:1 os blocos hardcoded de `FichaTecnicaSection`.
- Snapshot por produto: `products.ficha_schema_key` + `products.ficha_schema_version`.
- Feature flag: `tenant_settings.ficha_renderer_version` (default `v1`).
- Renderer dinâmico criado em `src/components/ficha/` (FichaRenderer, SectionRenderer, FieldRenderer, engine/) — **inativo**, não plugado na tela ainda.
- `FichaTecnicaSection` legacy continua único renderer em uso.

## Separação CORE vs Ficha Técnica (regra dura)
**CORE (estrutural / imutável / governado):** grupo, subgrupo, família, unidade, NCM, dimensões, SKU, estrutura fiscal, hashes estruturais, erp_versao. Vivem em colunas próprias de `products`. Nunca devem migrar para `ficha_tecnica`.
**Dinâmico (operacional / flexível):** acessórios, impressão, cameron, fotocélula, observações, tubete, embalagem, info operacional. Vivem em `products.ficha_tecnica jsonb` regido por schema.

## Padronização de nomenclatura (obrigatória)
- `key`, `section.id`, `field.id` → snake_case, sem acento, sem espaço, estável.
- Constraint no banco: `key ~ '^[a-z][a-z0-9_]*$'`.
- Labels são apenas display; nunca usados como chave técnica.

## Limites estruturais (Fase 0)
- Permitido: sections, fields, repeater de 1 nível.
- Proibido: repeater dentro de repeater, recursão.
- Condicionais: `eq, neq, in, nin, gt, lt, truthy, falsy, all, any, not` via `engine/conditions.ts`.

## Governança
- SELECT em `ficha_schemas`: qualquer usuário do tenant.
- INSERT/UPDATE/DELETE: apenas `admin` ou `desenvolvedor`.
- Versionamento: nova `version` por publicação; `is_active=true` único por key.

## ERP
- Schema reserva `field.erp_mapping` e `field.operational_only` para fase futura.
- Hoje a ficha técnica NÃO é enviada ao ERP.

## Migração (próximas fases)
1. Editor de schemas (admin/dev).
2. Cutover por tenant via flag `ficha_renderer_version='v2'`.
3. Backfill de `ficha_schema_key`/`ficha_schema_version` em produtos existentes.
4. Remoção do `FichaTecnicaSection` legacy.
