
# Correcao: Funcao de Contagem para Paginacao

## Problema Identificado
A funcao `get_companies_for_reallocation_count` esta falhando com erro 400:
```
column c.days_since_interaction does not exist
```

**Causa raiz**: A view `unified_company_for_reallocation` nao possui as colunas `days_since_interaction` e `days_since_order`. Essas colunas sao calculadas dinamicamente na funcao principal `get_companies_for_reallocation`, mas a funcao de contagem tenta acessar diretamente como se fossem colunas da view.

## Solucao
Atualizar a funcao `get_companies_for_reallocation_count` para calcular os dias de inatividade da mesma forma que a funcao principal.

---

## Alteracao Necessaria

### Migration SQL Corrigida

A funcao de contagem deve usar:
```sql
-- Em vez de:
c.days_since_interaction >= p_min_days_no_interaction

-- Usar:
(c.last_interaction_at IS NULL 
 OR EXTRACT(DAY FROM (now() - c.last_interaction_at)) >= p_min_days_no_interaction)
```

Mesma logica para `days_since_order`.

---

## Detalhes Tecnicos

### Comparativo das Abordagens

| Aspecto | Versao com Erro | Versao Corrigida |
|---------|-----------------|------------------|
| Acesso coluna | `c.days_since_interaction` | `EXTRACT(DAY FROM (now() - c.last_interaction_at))` |
| NULL handling | Falha | Tratado com `IS NULL OR ...` |
| Compatibilidade | Incompativel com view | Compativel |

### Codigo SQL Corrigido

```sql
CREATE OR REPLACE FUNCTION get_companies_for_reallocation_count(...)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  result integer;
BEGIN
  SELECT COUNT(*)::integer INTO result
  FROM unified_company_for_reallocation c
  WHERE
    (p_states IS NULL OR c.state = ANY(p_states))
    AND (p_regions IS NULL OR c.regiao = ANY(p_regions))
    AND (
      CASE
        WHEN p_no_owner = true THEN c.owner_id IS NULL
        WHEN p_owner_id IS NOT NULL THEN c.owner_id = p_owner_id
        ELSE true
      END
    )
    AND (
      p_min_days_no_interaction IS NULL 
      OR c.last_interaction_at IS NULL 
      OR EXTRACT(DAY FROM (now() - c.last_interaction_at)) >= p_min_days_no_interaction
    )
    AND (
      p_min_days_no_order IS NULL 
      OR c.last_order_at IS NULL 
      OR EXTRACT(DAY FROM (now() - c.last_order_at)) >= p_min_days_no_order
    )
    AND (
      p_search IS NULL 
      OR p_search = ''
      OR c.company_name ILIKE '%' || p_search || '%'
      OR c.cnpj ILIKE '%' || p_search || '%'
    );
  
  RETURN result;
END;
$$;
```

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Substituir funcao `get_companies_for_reallocation_count` |

---

## Resultado Esperado
- Funcao de contagem retorna o total correto de registros
- Paginacao exibe "Exibindo 1-25 de 200"
- Filtros funcionam normalmente
- Navegacao entre paginas opera sem erros
