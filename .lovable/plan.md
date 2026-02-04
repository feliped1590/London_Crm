
# Plano: Restaurar Botao "Criar nova empresa/contato" no SearchableSelect

## Problema Identificado

O botao "Criar nova empresa" e "Criar novo contato" nao estao visiveis no formulario "Novo Negocio" do Pipeline. Analisando o componente `SearchableSelect`, identifiquei que o botao esta em um `CommandGroup` separado que pode nao estar sendo renderizado corretamente ou esta fora da area visivel do scroll.

## Causa Raiz

O componente `SearchableSelect` tem o botao "Criar novo" em dois lugares:

1. **Dentro do `CommandEmpty`** (linhas 92-108) - aparece quando nao ha resultados
2. **Em um `CommandGroup` separado** (linhas 156-170) - aparece quando ha resultados

O problema e que o segundo grupo pode:
- Estar fora da area de scroll (max-h-[300px])
- Ter problema de renderizacao com o componente `cmdk`

## Solucao Proposta

Mover o botao "Criar novo" para **dentro do mesmo `CommandGroup`** das opcoes, apos o ultimo item da lista. Isso garante que:
1. O botao sempre aparece junto com as opcoes
2. Nao ha problemas de grupos separados
3. O scroll inclui naturalmente o botao

## Alteracoes Tecnicas

**Arquivo:** `src/components/ui/searchable-select.tsx`

### Antes (estrutura atual):
```tsx
<CommandList>
  <CommandEmpty>...</CommandEmpty>
  <CommandGroup>
    {/* opcao "Nenhum" */}
    {/* lista de opcoes */}
  </CommandGroup>
  {onCreateNew && filteredOptions.length > 0 && (
    <CommandGroup>
      <CommandItem value="__create__">...</CommandItem>
    </CommandGroup>
  )}
</CommandList>
```

### Depois (estrutura corrigida):
```tsx
<CommandList>
  <CommandEmpty>...</CommandEmpty>
  <CommandGroup>
    {/* opcao "Nenhum" */}
    {/* lista de opcoes */}
    {/* Botao criar novo - DENTRO do mesmo grupo */}
    {onCreateNew && (
      <CommandItem value="__create__">...</CommandItem>
    )}
  </CommandGroup>
</CommandList>
```

## Mudancas Especificas

1. **Remover o segundo `CommandGroup`** (linhas 156-170)
2. **Mover o `CommandItem` de criacao** para dentro do primeiro `CommandGroup`, apos a lista de opcoes
3. **Ajustar a condicao**: Remover `filteredOptions.length > 0` pois o botao deve aparecer sempre que `onCreateNew` estiver definido
4. **Adicionar separador visual**: Usar `border-t` para separar visualmente o botao das opcoes

## Resultado Esperado

| Cenario | Comportamento |
|---------|---------------|
| Lista vazia (busca sem resultado) | Botao aparece no `CommandEmpty` |
| Lista com opcoes | Botao aparece no final da lista, dentro do mesmo grupo |
| Scroll necessario | Botao faz parte do scroll e sempre pode ser alcancado |

## Beneficios

- Resolve o problema de visibilidade do botao
- Simplifica a estrutura do componente
- Mantem a funcionalidade existente
- Melhora a experiencia do usuario ao criar empresas/contatos rapidamente

