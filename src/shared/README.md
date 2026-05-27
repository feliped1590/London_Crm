# Shared

Código **transversal** usado por múltiplos módulos.

## Estrutura

```
src/shared/
├── ui/        # Componentes primitivos (shadcn) — futuro destino de components/ui
├── lib/       # Utilitários puros (formatters, masks, ownership, etc.)
├── hooks/     # Hooks genéricos (use-mobile, useDebouncedValue, etc.)
└── types/     # Tipos transversais (Tenant, LegalEntity, Role, etc.)
```

## Quando promover algo para `shared`?

- É usado por **3+ módulos** distintos.
- Não tem conhecimento de regras de negócio de um domínio específico.
- É estável (mudança aqui afeta o sistema todo).

## O que NÃO vai aqui

- Componentes específicos de um domínio (vão em `modules/<dominio>/components`).
- Regras de negócio (vão no módulo dono).
- Chamadas a APIs específicas de domínio (vão em `modules/<dominio>/services`).
