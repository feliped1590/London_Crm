

# Plano: Destravar Envio do PED-2026-0054

## Problema

A Edge Function `process-order-sync` falha na validação porque `companies.erp_code` é `null` para a empresa do pedido. O campo `erp_code` **não é usado no payload** (o payload usa CNPJ), mas o validator exige que esteja preenchido.

## Solução (2 ações)

### 1. Preencher `erp_code` na empresa

Atualizar a empresa "004268 - FELIPE DUARTE" (id: `87d95473-fa0e-4827-a11a-56bdf2875ed0`) com `erp_code = '004268'` via migration SQL:

```sql
UPDATE companies 
SET erp_code = '004268' 
WHERE id = '87d95473-fa0e-4827-a11a-56bdf2875ed0';
```

### 2. Resetar o pedido na fila e disparar

Resetar o item na `order_sync_queue` para `status = 'pending'` e `attempt_count = 0`, e então disparar a Edge Function.

## Alternativa (se `erp_code` não for necessário para outros fluxos)

Remover a validação de `company_erp_code` do validator, já que o payload utiliza apenas CNPJ. Porém, manter é mais seguro para garantir que clientes estejam cadastrados no ERP.

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| Migration SQL | UPDATE na empresa |
| Nenhum código alterado | Apenas dados |

