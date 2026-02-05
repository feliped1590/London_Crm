
# Plano: Exibir Nomes dos Vendedores no Histórico de Alterações

## Problema Identificado

No componente `CompanyAuditHistory`, quando o campo alterado é "Vendedor Responsável" (`field_name === 'owner_id'`), os valores `old_value` e `new_value` contêm UUIDs de usuários, que são exibidos diretamente na interface ao invés dos nomes legíveis.

## Solução Proposta

Modificar o componente para identificar quando o campo é `owner_id` e resolver os UUIDs para nomes de usuários usando a tabela `profiles`.

## Alterações Técnicas

### Arquivo: `src/components/customers/CompanyAuditHistory.tsx`

1. **Expandir a query de profiles** para incluir também os UUIDs presentes em `old_value` e `new_value` quando `field_name === 'owner_id'`

2. **Modificar a função `formatValue`** para receber o mapa de profiles e resolver o nome quando o campo for `owner_id`

### Lógica de Implementação

```
1. Coletar todos os UUIDs únicos:
   - changed_by (quem alterou)
   - old_value e new_value QUANDO field_name === 'owner_id'

2. Buscar todos os profiles em uma única query

3. Na exibição, verificar:
   - Se field_name === 'owner_id':
     → Exibir profiles[old_value] e profiles[new_value]
   - Caso contrário:
     → Exibir valores normalmente
```

## Resultado Esperado

Antes:
```
8f1cd810-2ae9-4b65-aade-ca1c1493a7f9 → fccbcaa5-2f0f-44d4-93a6-277bf1334a6d
```

Depois:
```
João Silva → Maria Santos
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/customers/CompanyAuditHistory.tsx` | Expandir coleta de UUIDs e resolver nomes para campos owner_id |
