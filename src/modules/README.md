# Modules

Cada subpasta aqui representa um **domínio de negócio** auto-contido.

## Estrutura padrão

```
src/modules/<dominio>/
├── components/      # UI específica do domínio
├── hooks/           # Hooks específicos do domínio
├── services/        # Chamadas Supabase / edge functions
├── types/           # Tipos do domínio
├── utils/           # Utilitários puros do domínio
└── index.ts         # API pública (barrel) — único ponto de entrada externo
```

## Regras de ouro

1. **Importação externa só pelo `index.ts`**: outros módulos importam de `@/modules/<dominio>`, nunca de paths internos como `@/modules/<dominio>/components/Foo`.
2. **Sem imports cruzados de internals**: `modules/orders` não pode importar de `modules/products/hooks/...`. Use apenas a API pública.
3. **Código compartilhado vai em `@/shared`**: utilitários, UI primitiva, tipos transversais. Se algo é usado por 3+ módulos, promova para `shared`.
4. **Supabase client/types**: continuam em `@/integrations/supabase/` — auto-gerados, intocáveis.
5. **Migração incremental**: ao mover arquivos, manter re-exports temporários nos paths antigos para não quebrar consumidores.

## Domínios planejados

- `documents/` ✅ (já existe — referência de padrão)
- `products/` — produtos, SKU, ficha técnica, descrição automática
- `orders/` — pedidos, aprovação, sync ERP
- `customers/` — clientes, portfolio, enriquecimento CNPJ
- `proposals/` — propostas comerciais
- `pipeline/` — funis, etapas, multi-entity
- `pricing/` — tabelas, regras, autorização
- `portfolio/` — realocação, transferências
- `fiscal/` — engine fiscal, reforma 2026
- `erp-sync/` — orquestração de sincronização
- `whatsapp/`, `prospecting/`, `insights/`
