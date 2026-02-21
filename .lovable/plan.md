

## Problema Identificado

O vendedor-teste **nao possui nenhuma restricao configurada** na tabela `user_legal_entities`. A tabela esta completamente vazia. A logica do hook `useLegalEntities` funciona assim:

- Se o usuario NAO tem registros em `user_legal_entities` → modo permissivo (ve TODOS os CNPJs)
- Se o usuario TEM registros → ve apenas os CNPJs vinculados

Como nenhuma restricao foi inserida, o vendedor ve ambos os CNPJs (Novafix e Qualyvac).

## Plano de Correcao

### 1. Inserir a restricao no banco de dados
Criar um registro na tabela `user_legal_entities` vinculando o Vendedor-Teste (ID: `2cdd97c1-bc6a-45f0-b940-a93b01648946`) apenas ao CNPJ da Novafix (ID: `032a2168-7c44-4f08-801e-69ea5e17f4f1`).

### 2. Validar o comportamento do dropdown
Apos a insercao, o hook `useLegalEntities` vai detectar que o vendedor tem 1 registro de restricao e filtrar `accessibleEntities` para mostrar apenas a Novafix no seletor "CNPJ Atendimento" da pagina Pipeline.

### 3. Verificar a pagina CustomerNew.tsx
O mesmo seletor existe na pagina de criacao de clientes (linha 646-650). Tambem usa `useLegalEntities`, entao sera corrigido automaticamente.

### Detalhes Tecnicos

```text
Tabela: user_legal_entities
INSERT: user_id = 2cdd97c1-..., legal_entity_id = 032a2168-...

Logica do hook (ja existente, nao precisa mudar):
  accessibleEntities = userLinks.length === 0 
    ? allEntities           // sem restricao = ve tudo
    : allEntities.filter(e => linkedIds.has(e.id))  // com restricao = filtrado
```

Nenhuma alteracao de codigo e necessaria. Apenas a insercao do dado de restricao no banco.

