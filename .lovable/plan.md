

# Plano: Corrigir Botoes de Acoes Rapidas Submetendo Formulario do Deal

## Problema Identificado

Ao clicar em "Criar Tarefa" ou "Criar Pedido" nas Acoes Rapidas do Pipeline, o sistema:
1. Abre o dialog correspondente
2. Imediatamente submete o formulario do Deal (mostrando "Negocio atualizado!")
3. Fecha tudo via `resetForm()`

**Causa raiz**: Os botoes no componente `DealQuickActions` nao possuem `type="button"`. Em HTML, botoes sem `type` dentro de um `<form>` assumem `type="submit"` por padrao, o que dispara o submit do formulario pai.

## Localizacao no Codigo

**Arquivo:** `src/components/pipeline/DealQuickActions.tsx`

O componente `DealQuickActions` e renderizado dentro do `<form>` de edicao do Deal em `Pipeline.tsx` (linha 723-859), especificamente nas linhas 818-834.

## Alteracoes Necessarias

Adicionar `type="button"` a todos os botoes do componente `DealQuickActions` para prevenir o comportamento de submit:

### Botao WhatsApp (linhas 128-138)
```tsx
<Button
  type="button"  // ADICIONAR
  variant="outline"
  size="sm"
  onClick={handleWhatsAppClick}
  disabled={!hasWhatsApp}
  className="gap-2"
  title={hasWhatsApp ? 'Enviar WhatsApp' : 'Contato sem telefone'}
>
```

### Botao Criar Tarefa (linhas 141-149)
```tsx
<Button
  type="button"  // ADICIONAR
  variant="outline"
  size="sm"
  onClick={() => setTaskDialogOpen(true)}
  className="gap-2"
>
```

### Botao Criar Pedido (linhas 152-162)
```tsx
<Button
  type="button"  // ADICIONAR
  variant="outline"
  size="sm"
  onClick={() => setOrderDialogOpen(true)}
  disabled={!deal.company_id}
  className="gap-2"
  title={deal.company_id ? 'Criar Pedido' : 'Negocio sem empresa vinculada'}
>
```

## Resultado Esperado

| Acao | Antes | Depois |
|------|-------|--------|
| Clicar "Criar Tarefa" | Abre dialog + fecha tudo | Abre dialog de tarefa normalmente |
| Clicar "Criar Pedido" | Abre dialog + fecha tudo | Abre dialog de pedido normalmente |
| Clicar "WhatsApp" | Abre WhatsApp + fecha tudo | Abre WhatsApp ou troca de aba |

## Impacto

- Correcao simples de 3 linhas
- Sem efeitos colaterais
- Restaura o comportamento esperado das acoes rapidas

