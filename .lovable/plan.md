

# Correcao: Bloqueio de CNPJ Duplicado

## Problema Identificado

O sistema permite cadastrar clientes com o mesmo CNPJ porque existem **duas falhas combinadas**:

1. **Formato inconsistente**: O CNPJ e armazenado **formatado** no banco (ex: `27.751.050/0001-67`), mas a verificacao de duplicidade busca pelo valor **limpo** (ex: `27751050000167`). A query `.eq('cnpj', documentClean)` nunca encontra o registro existente.

2. **Sem restricao no banco**: A coluna `cnpj` na tabela `companies` tem apenas um indice comum, sem constraint UNIQUE. Mesmo corrigindo o frontend, o banco nao impede insercoes duplicadas.

## Dados Afetados

Existe 1 duplicata confirmada no banco:
- `27.751.050/0001-67` - 2 registros (WANDERSON MARCIO... e Wanderson Marcio...)

## Solucao em 3 Passos

### Passo 1: Corrigir a query de verificacao no frontend

No arquivo `src/pages/CustomerNew.tsx`, a funcao `checkDuplicateDocument` precisa buscar pelo CNPJ **no mesmo formato em que esta armazenado** (formatado). Alterar a query para comparar usando o valor formatado em vez do limpo.

### Passo 2: Adicionar UNIQUE constraint no banco

Criar uma migration que:
- Remove a duplicata existente (manter o registro mais recente ou o que tiver mais dados associados)
- Cria um UNIQUE INDEX na coluna `cnpj` ignorando nulos (para permitir clientes PF sem CNPJ)

```sql
-- Unique index parcial (ignora NULLs e vazios)
CREATE UNIQUE INDEX idx_companies_cnpj_unique 
  ON public.companies (cnpj) 
  WHERE cnpj IS NOT NULL AND cnpj != '';
```

### Passo 3: Padronizar formato de armazenamento

Ajustar o `INSERT` para armazenar o CNPJ **sempre limpo** (somente digitos) e corrigir a query de duplicidade para usar o mesmo formato. Isso evita problemas futuros de comparacao. Os dados existentes formatados serao normalizados via migration.

```sql
-- Normalizar CNPJs existentes para somente digitos
UPDATE companies 
  SET cnpj = regexp_replace(cnpj, '[^0-9]', '', 'g')
  WHERE cnpj IS NOT NULL AND cnpj ~ '[^0-9]';
```

## Tratamento da Duplicata Existente

Antes de criar o UNIQUE INDEX, a duplicata sera resolvida. Sera necessario verificar qual dos dois registros possui dados relacionados (contatos, deals, pedidos) para decidir qual manter.

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/CustomerNew.tsx` | Corrigir `checkDuplicateDocument` para usar formato limpo na query, e gravar CNPJ limpo no INSERT |
| Migration SQL | Normalizar CNPJs existentes, remover duplicata, criar UNIQUE INDEX |

## Resultado Esperado

- Validacao no frontend compara corretamente (digitos vs digitos)
- Banco impede duplicatas mesmo em cenarios de requisicoes simultaneas
- CNPJ armazenado em formato padrao (somente digitos), formatacao aplicada apenas na exibicao
