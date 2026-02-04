

# Plano: Restringir Botoes de Ativar/Desativar e Excluir a Administradores

## Problema Atual

A tela de Clientes exibe os botoes de ativar/desativar e excluir para todos os usuarios. Quando um usuario nao-admin tenta usar essas acoes, recebe uma mensagem generica de erro vinda do banco.

## Solucao Proposta

Esconder completamente os botoes para usuarios nao-admin, seguindo o principio de "nao mostrar o que nao pode usar".

## Alteracoes no Arquivo

**Arquivo:** `src/pages/Customers.tsx`

### 1. Adicionar Import do Hook de Permissoes

```typescript
import { useModulePermissions } from '@/hooks/useModulePermissions';
```

### 2. Obter Status de Admin

```typescript
const { isAdmin } = useModulePermissions();
```

### 3. Condicionar Exibicao dos Botoes

Envolver os botoes de ativar/desativar e excluir com condicional `{isAdmin && ...}`:

**Botao Toggle Ativo (linhas 723-747):**
```tsx
{/* Toggle active button - apenas admin */}
{isAdmin && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => handleToggleActive(customer, e)}
        disabled={customer.source === 'erp' || toggleActiveMutation.isPending}
      >
        {customer.active ? (
          <PowerOff className="h-4 w-4 text-destructive" />
        ) : (
          <Power className="h-4 w-4 text-primary" />
        )}
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {customer.source === 'erp' 
        ? 'Dados gerenciados pelo ERP' 
        : customer.active 
          ? 'Desativar cliente' 
          : 'Ativar cliente'
      }
    </TooltipContent>
  </Tooltip>
)}
```

**Botao Excluir (linhas 749-765):**
```tsx
{/* Delete button - apenas admin */}
{isAdmin && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => handleDeleteClick(customer, e)}
        disabled={customer.source === 'erp'}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {customer.source === 'erp' ? 'Dados gerenciados pelo ERP' : 'Excluir cliente'}
    </TooltipContent>
  </Tooltip>
)}
```

## Resultado Esperado

| Perfil | Editar | WhatsApp | Ativar/Desativar | Excluir |
|--------|--------|----------|------------------|---------|
| Admin | Visivel | Visivel | Visivel | Visivel |
| Vendedor | Visivel | Visivel | Oculto | Oculto |
| Atendente | Visivel | Visivel | Oculto | Oculto |

## Beneficios

- Interface mais limpa para usuarios comuns
- Evita confusao e tentativas frustradas
- Segue as boas praticas de UX para controle de acesso
- Triggers no banco continuam como ultima barreira de seguranca

