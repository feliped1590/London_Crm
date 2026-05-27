# Arquitetura Modular

> Status: **em adoção progressiva**. Estrutura legada (`components/`, `hooks/`, `pages/` por tipo) coexiste com a nova (`modules/` por domínio).

## Objetivo

Evoluir de uma estrutura "por tipo de arquivo" para uma "por domínio de negócio", reduzindo acoplamento entre áreas (Produtos, Pedidos, Clientes, etc.) e tornando refatorações localizadas mais seguras.

## Estrutura-alvo

```
src/
├── modules/<dominio>/{components,hooks,services,types,utils,index.ts}
├── shared/{ui,lib,hooks,types}
├── pages/         # roteamento + composição
├── app/           # App.tsx, providers, router
└── integrations/  # supabase (auto-gerado)
```

## Regras

1. Outros módulos importam **somente** via `@/modules/<dominio>` (barrel).
2. Sem imports cruzados de internals entre módulos.
3. Código usado por 3+ módulos → promovido para `@/shared`.
4. Re-exports temporários nos caminhos antigos durante migração — removidos depois.

## Roadmap

- **Fase 0** — Fundação: pastas, READMEs, regras. ✅
- **Fase 1** — Críticos: `products`, `orders`, `customers`, `proposals`.
- **Fase 2** — Suporte comercial: `pipeline`, `pricing`, `portfolio`.
- **Fase 3** — Transversais: `fiscal`, `erp-sync`, `whatsapp`, `prospecting`, `insights`.
- **Fase 4** — Limpeza: remover re-exports, mover `components/ui` → `shared/ui`.

## Referência

`src/modules/documents/` é a referência viva do padrão (módulo compartilhado entre Propostas e Pedidos).
