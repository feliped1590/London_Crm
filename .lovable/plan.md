
# Fase 4F -- Permissoes por CNPJ (Modo Permissivo com Admin Soberano)

## Status: ✅ CONSOLIDADO (Migration aplicada)

---

## 1. Tabela user_legal_entities

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| id | UUID PK | NAO | gen_random_uuid() |
| tenant_id | UUID NOT NULL FK | NAO | -- |
| user_id | UUID NOT NULL FK | NAO | profiles(id) CASCADE |
| legal_entity_id | UUID NOT NULL FK | NAO | legal_entities(id) CASCADE |
| role | TEXT NOT NULL | NAO | 'member' |
| created_at | TIMESTAMPTZ | NAO | now() |

Constraints: UNIQUE(user_id, legal_entity_id)

---

## 2. Funcao can_access_legal_entity

- SECURITY DEFINER + SET search_path = public
- Logica: NULL→TRUE, admin→TRUE, sem restricoes→TRUE, explicito→TRUE, senao→FALSE

---

## 3. Policies RESTRICTIVE em orders

| Policy | Tipo | Modo |
|---|---|---|
| legal_entity_select_orders | SELECT | RESTRICTIVE |
| legal_entity_insert_orders | INSERT | RESTRICTIVE |
| legal_entity_update_orders | UPDATE | RESTRICTIVE |
| tenant_isolation_orders | ALL | PERMISSIVE (existente) |
| DELETE | - | Apenas admins (inalterada) |

Composicao: tenant_isolation (PERMISSIVE) AND legal_entity_* (RESTRICTIVE) = ambas devem ser satisfeitas.

---

## 4. Indices

- idx_user_legal_entities_user(user_id)
- idx_user_legal_entities_legal_entity(legal_entity_id)
- idx_orders_legal_entity(legal_entity_id) WHERE NOT NULL

---

## 5. Comportamento Final

| Cenario | Resultado |
|---|---|
| Admin | Ve todos os CNPJs |
| Usuario sem registros em user_legal_entities | Ve todos (modo permissivo) |
| Usuario com registros | Ve apenas CNPJs vinculados |
| Pedido com legal_entity_id = NULL | Acesso permitido |
| Tenant diferente | Sempre bloqueado |

---

## 6. Edge Functions

Nenhuma alteracao. Seguranca 100% no banco (RLS + funcao).

---

## 7. Fases Futuras

- Restricao obrigatoria (remover modo permissivo)
- Permissoes por role (viewer nao cria pedido)
- Comissao por CNPJ
- Metas por CNPJ
