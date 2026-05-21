## Diagnóstico

O toast "O campo Versão (ERP) é obrigatório. Preencha manualmente." aparece porque `handleSave` em `src/pages/Products.tsx` consulta `hasAutoDimensions(profile)`. Quando o perfil do grupo é `'none'`, a geração automática é desligada.

Estado atual no banco (`product_groups.dimension_profile`):

```text
BOBINA              partial
IMPRESSO BOBINA     partial
IMPRESSO SACO       full
LISO BOBINA         partial
LISO SACO           full
STAND UP IMPRESSO   none   ← bug
STAND UP LISO       none   ← bug
STAND UP POUCH      none   (intencional — sem ficha, sem dimensões)
```

Os grupos Stand Up usam Largura + Comprimento + Espessura no formulário (formato `LxCxE`), portanto deveriam ser `full` como os grupos Saco. Provavelmente foram cadastrados como `none` por engano numa migration anterior — e por isso o `erp_versao` parou de ser gerado.

## Plano

1. Criar migration atualizando os dois grupos Stand Up com ficha técnica para o perfil correto:

   ```sql
   UPDATE public.product_groups
      SET dimension_profile = 'full'
    WHERE label IN ('STAND UP LISO', 'STAND UP IMPRESSO');
   ```

   `STAND UP POUCH` fica como `none` (sem ficha, sem dimensões — comportamento intencional).

2. Validar reabrindo o cadastro de produto Stand Up Liso da tela atual: ao preencher Largura/Comprimento/Espessura (e opcionalmente a sanfona) o campo `Versão (ERP)` deve aparecer preenchido automaticamente (`100x200+30x0,240` no caso da tela), e o "Criar" deve concluir sem o erro de Versão obrigatória.

## Fora de escopo

- Não tocar em código TypeScript: a lógica de geração e o fallback (`group?.dimension_profile || 'full'`) já estão corretos. O problema é exclusivamente de dado.
- Não alterar `STAND UP POUCH` nem grupos de Bobina (perfis já corretos).
