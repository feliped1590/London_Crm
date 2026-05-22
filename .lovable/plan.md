# Correção: CNPJ enviado ao ERP perde zero à esquerda

## Problema

No envio do pedido `PED-2026-0090` o ERP rejeitou com:

> Cliente/Pre-cliente não cadastrado para o CNPJ_CPF **9474676000191**

O CNPJ correto é **09474676000191** (14 dígitos). Estamos transformando o CNPJ em `Number` no payload, e o JavaScript descarta o `0` à frente, resultando em 13 dígitos.

Quando enviávamos com o zero (string), o ERP retornava outro erro de tipo — porque o campo estava chegando como string sem padrão. A correção é tratar o CNPJ **sempre como string com 14 dígitos** (CPF como string de 11), igual ao restante dos campos textuais já enviados ao ERP (ex: `cnpj_cpf` no `IMP_CLIENTE` já é string).

## Causa

`supabase/functions/_shared/projedata/order-mapper.ts`:

```ts
function cnpjToNumber(cnpj: string): number {
  const digits = cnpj.replace(/\D/g, '');
  return Number(digits);   // ← perde o zero à esquerda
}
...
cpf_cnpj_cliente: cnpjToNumber(order.company_cnpj),
```

E em `order-types.ts`:

```ts
cpf_cnpj_cliente: number;
```

## Solução

Padronizar `cpf_cnpj_cliente` como **string normalizada (somente dígitos, com pad de zero à esquerda quando necessário)** em todo o pipeline de pedidos. O envelope serializado já escapa as aspas corretamente, então o ERP recebe `"cpf_cnpj_cliente":"09474676000191"`.

### Arquivos a alterar

1. **`supabase/functions/_shared/projedata/order-types.ts`**
   - Trocar `cpf_cnpj_cliente: number` → `cpf_cnpj_cliente: string`

2. **`supabase/functions/_shared/projedata/order-mapper.ts`**
   - Remover `cnpjToNumber`
   - Adicionar helper `normalizeCnpjCpf(value: string): string` que:
     - Remove tudo que não for dígito
     - Faz `padStart(14, '0')` se tiver entre 12–14 dígitos (CNPJ)
     - Faz `padStart(11, '0')` se tiver entre 9–11 dígitos (CPF)
     - Lança erro se ficar fora desses tamanhos
   - Linha 135: `cpf_cnpj_cliente: normalizeCnpjCpf(order.company_cnpj)`
   - Linha 159 (`buildOrderPayload`): apenas repassa a string

3. **`src/components/integrations/OrderPayloadSimulator.tsx`** (linha 312)
   - Trocar `Number(company.cnpj.replace(/\D/g, ''))` por `company.cnpj.replace(/\D/g, '').padStart(14, '0')` para o preview ficar fiel ao que o backend envia.

### Resultado esperado no payload

```json
{
  "tipoComando": "ASDCOMANDO",
  "grupoComando": "IMP_PEDIDO_V3",
  "#out#p_retorno": "T",
  "json": "{\"cpf_cnpj_cliente\":\"09474676000191\", ...}"
}
```

## Fora de escopo

- Não mexer no `company-mapper` (já envia string corretamente)
- Não alterar `cnpjToNumber` em outras integrações (não existe em outro lugar)
- Não reprocessar pedidos já sincronizados — o próximo retry do `PED-2026-0090` usará o novo formato

## Memória a atualizar

Adicionar regra em `mem://integrations/erp-order-outbound-sync`: **CNPJ/CPF sempre enviado como string normalizada (14 ou 11 dígitos com zeros à esquerda) no payload IMP_PEDIDO_V3.**
