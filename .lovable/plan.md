

# Plano: ErpMappingsManager com Acesso Restrito a Desenvolvedor

## Resumo

Criar o componente `ErpMappingsManager` com 6 tabs de CRUD para mappings ERP, visivel apenas para desenvolvedores. Atualizar as RLS policies das 4 tabelas de mapping para permitir gerenciamento por `desenvolvedor` (hoje apenas `admin`).

## Etapa 1 — Migration: Atualizar RLS policies

As 4 tabelas de mapping possuem policies de ALL apenas para `admin`. Precisamos incluir `desenvolvedor`:

```sql
-- Dropar policies existentes de ALL e recriar com admin OR desenvolvedor
-- Para cada tabela: freight_type_erp_mapping, sale_type_erp_mapping, 
-- payment_method_erp_mapping, order_type_erp_mapping

DROP POLICY "Admins can manage freight mappings" ON freight_type_erp_mapping;
CREATE POLICY "Admins and devs can manage freight mappings"
  ON freight_type_erp_mapping FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));
-- (repetir para as outras 3 tabelas)
```

## Etapa 2 — Componente `ErpMappingsManager.tsx`

**Arquivo:** `src/components/settings/ErpMappingsManager.tsx`

Componente com sub-tabs internas usando o pattern do `ProductLookupManager`:

| Tab | Tabela | Campos |
|-----|--------|--------|
| Tipos de Pedido | `order_type_erp_mapping` | crm_order_type, erp_flow_code (INT), erp_flow_description |
| Frete | `freight_type_erp_mapping` | crm_freight_type, erp_freight_code (TEXT), erp_freight_description |
| Tipo de Venda | `sale_type_erp_mapping` | crm_sale_type, erp_sale_type_code (INT), erp_sale_type_description |
| Forma Pagamento | `payment_method_erp_mapping` | crm_payment_method, erp_payment_code (INT), erp_payment_description |
| Usuários ERP | `profiles` | full_name (readonly), erp_user_code (edit) |
| Vendedores ERP | `sales_reps` | name (readonly), erp_vendor_code (edit) |

Funcionalidades por tab:
- Listar registros em tabela
- Criar/Editar via Dialog
- Toggle ativo/inativo via Switch (nas 4 tabelas de mapping)
- Validação: campos obrigatórios + duplicidade (toast de erro)
- Loading states, paginação

## Etapa 3 — Controle de acesso no frontend

No `Integrations.tsx`, dentro da tab ERP:
- Query `has_role(auth.uid(), 'desenvolvedor')` via React Query
- Renderizar `<ErpMappingsManager />` apenas se `isDeveloper === true`

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| Nova migration SQL | Atualizar 4 policies (admin OR desenvolvedor) |
| `src/components/settings/ErpMappingsManager.tsx` | Criar (componente principal) |
| `src/pages/Integrations.tsx` | Editar (importar + renderizar condicionalmente) |

