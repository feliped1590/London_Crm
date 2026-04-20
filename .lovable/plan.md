

## Corrigir erro `column le.is_active does not exist` ao salvar funil

### Causa raiz
A função RPC `public.save_pipeline_with_entities` (criada na migration `20260418175153_*.sql`) valida as empresas emissoras com:
```sql
WHERE le.id = eid AND le.is_active = true
```
Mas a coluna real em `public.legal_entities` se chama **`active`** (não `is_active`). O Postgres lança o erro assim que qualquer empresa é vinculada ao funil — exatamente o cenário do print (Qualyvac marcada).

### Correção
Criar uma migration que faz `CREATE OR REPLACE FUNCTION public.save_pipeline_with_entities(...)` idêntica à atual, trocando apenas a linha 35:

```sql
-- antes
WHERE le.id = eid AND le.is_active = true
-- depois
WHERE le.id = eid AND le.active = true
```

Nenhuma outra alteração de assinatura, lógica ou permissões. Os demais pontos da função já estão corretos (RBAC, escopo derivado, substituição atômica de vínculos, reforço de consistência).

### Validação pós-deploy
1. Abrir "Editar Funil" no funil **OPERAÇÃO QUALYVAC**.
2. Marcar a empresa **QUALYVAC EMBALAGENS EIRELI** e clicar em **Atualizar**.
3. Esperado: toast de sucesso, badge "Restrito a 1 empresa" persistido, sem erro de coluna.
4. Repetir marcando 2+ empresas e desmarcando todas (deve voltar a "global").

### Risco
Mínimo. Mudança de 1 caractere em 1 função SECURITY DEFINER, sem alterar contrato (mesma assinatura, mesmo retorno).

