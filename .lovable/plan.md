
# Fase 4E -- Entidades Juridicas (legal_entities) e Suporte Multi-CNPJ

## Resumo

Tabela `legal_entities` para representar os CNPJs de um grupo economico dentro de um unico tenant. Pedidos e propostas vinculados a uma entidade juridica emissora. Seletor de CNPJ ativo no perfil do usuario.

## Status: ✅ CONSOLIDADO (Migration + Edge Function aplicados)

---

## 1. Modelo

```
tenants (grupo economico)
  +-- legal_entities (CNPJs do grupo)
  +-- orders ──────> legal_entity_id (CNPJ emissor)
  +-- proposals ───> legal_entity_id (CNPJ emissor, opcional)
  +-- profiles ────> active_legal_entity_id (CNPJ selecionado)
```

---

## 2. Tabela legal_entities

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| id | UUID PK | NAO | gen_random_uuid() |
| tenant_id | UUID NOT NULL FK | NAO | -- |
| name | TEXT NOT NULL | NAO | -- |
| trade_name | TEXT | SIM | NULL |
| cnpj | TEXT NOT NULL | NAO | -- |
| is_headquarters | BOOLEAN | NAO | false |
| active | BOOLEAN | NAO | true |
| erp_company_code | TEXT | SIM | NULL |
| address, city, state, phone, email | TEXT | SIM | NULL |
| inscricao_estadual | TEXT | SIM | NULL |
| inscricao_municipal | TEXT | SIM | NULL |
| regime_tributario | TEXT | SIM | NULL |
| created_at / updated_at | TIMESTAMPTZ | NAO | now() |

**Constraints:**
- UNIQUE(tenant_id, cnpj)
- UNIQUE(tenant_id, erp_company_code) WHERE erp_company_code IS NOT NULL

---

## 3. Alteracoes em orders

- `legal_entity_id UUID REFERENCES legal_entities(id)` — nullable Etapa 1
- Trigger `trg_validate_order_legal_entity`: valida que legal_entity pertence ao mesmo tenant

---

## 4. Alteracoes em profiles

- `active_legal_entity_id UUID REFERENCES legal_entities(id)`
- Trigger `trg_validate_profile_legal_entity`: valida pertinencia ao tenant do usuario

---

## 5. Alteracoes em proposals

- `legal_entity_id UUID REFERENCES legal_entities(id)` — opcional

---

## 6. RLS (padrao user_tenants)

- SELECT: `tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())`
- INSERT/UPDATE/DELETE: mesma regra + `has_role(auth.uid(), 'admin')`

---

## 7. Indices

| Indice | Colunas |
|---|---|
| UNIQUE | (tenant_id, cnpj) |
| UNIQUE parcial | (tenant_id, erp_company_code) WHERE NOT NULL |
| idx_legal_entities_tenant_active | (tenant_id) WHERE active = true |
| idx_orders_tenant_legal_entity | (tenant_id, legal_entity_id) WHERE legal_entity_id IS NOT NULL |

---

## 8. Integracao ERP (erp-import-orders)

- Campo `cd_empresa` no payload → lookup `legal_entities(tenant_id, erp_company_code)`
- Se `cd_empresa` enviado e NAO encontrou → REJEITAR pedido + log `legal_entity_not_found`
- Se `cd_empresa` nao enviado → legal_entity_id = NULL (aceitavel temporariamente)
- INSERT e UPDATE passam `legal_entity_id`

---

## 9. Estrategia de Transicao para NOT NULL

### Etapa 1 (atual)
- Coluna nullable para retrocompatibilidade com pedidos legados
- UI e ERP preenchem quando disponivel

### Etapa 2 (apos UI + migracao manual)
```sql
-- Executar APOS migrar todos os pedidos legados:
ALTER TABLE orders ALTER COLUMN legal_entity_id SET NOT NULL;
```

---

## 10. Nota Arquitetural: Comissao

Se regras de comissao variarem por CNPJ emissor, o campo `legal_entity_id` em orders deve ser considerado nas consultas de comissao. NAO implementar agora — apenas documentado.

---

## UI Pendente (proximo passo)

- Seletor de CNPJ no header (ao lado do tenant switcher)
- Seletor de CNPJ no formulario de pedido
- Filtro por CNPJ nos dashboards
