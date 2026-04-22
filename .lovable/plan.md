

# Sprint 2 — Tech/IA Futurista (com ajustes finos aprovados)

## Escopo final consolidado

Mantém todo o plano original aprovado e incorpora os 5 ajustes finos:

### Base já aprovada
- Tokens dark "tech premium" (#0B0F19 / #111827 / bordas #1F2937)
- Identidade roxo (#7C3AED) + azul (#2563EB) com gradiente 135°
- Glow controlado via tokens
- Sidebar com pill ativa + separadores entre grupos
- Header glassmorphism (`surface-glass`)
- Variants `premium` em Button, `elevated` e `glow` em Card
- Input com focus tech, Skeleton com shimmer
- Microinteração base em botões/links

### Ajustes finos incorporados

**1. Gradiente com intensidade variável (3 níveis)**
```text
--gradient-primary-strong:  linear-gradient(135deg, #2563EB, #7C3AED)            (botões CTA)
--gradient-primary-soft:    linear-gradient(135deg, #2563EB cc, #7C3AED cc)      (KPIs em destaque)
--gradient-primary-whisper: linear-gradient(135deg, #2563EB 14%, #7C3AED 14%)    (sidebar item ativo, quase imperceptível)
```
Uso:
- Button `premium` → `strong`
- Card `glow`/KPI principal → `soft`
- Sidebar pill ativa → `whisper`

**2. Glow com intenção (3 intensidades semânticas)**
```text
--glow-hover:    0 0 12px hsl(var(--primary) / 0.12)   (hover passivo)
--glow-active:   0 0 20px hsl(var(--primary) / 0.22)   (estado ativo, sidebar)
--glow-cta:      0 0 28px hsl(var(--primary) / 0.32)   (CTA premium em hover/focus)
```
Utility classes: `.glow-hover`, `.glow-active`, `.glow-cta` (em vez de `.glow-soft`/`.glow-primary` genéricos).

**3. Timings de animação refinados**
```text
--motion-fast:    150ms    (hovers em botões, links, ícones — sensação responsiva)
--motion-base:    200ms    (cards, sidebar, inputs — padrão)
--motion-slow:    280ms    (modais, drawers, transições maiores)
```
- Microinteração base global: `transition-all duration-150` (botões/links/[role=button])
- Cards e itens de sidebar: `duration-200`
- Dialog/Sheet mantêm seus presets Radix

**4. Espaçamento vertical "luxury"**
- Sidebar: `space-y-1` → `space-y-1.5` entre itens; grupos separados por `my-3` (em vez de `my-2`)
- Card padding: padrão `p-6` mantido; novo helper opcional `p-7` em KPIs principais via `card-spacious` quando necessário
- Page header (quando existir): margem inferior `mb-6` → `mb-8`
- Apenas tokens/utilities — não vamos varrer páginas

**5. Peso tipográfico em KPIs**
Adicionar em `@layer utilities`:
```text
.kpi-value  → text-3xl font-bold tracking-tight tabular-nums
.kpi-label  → text-xs font-medium text-muted-foreground uppercase tracking-wide
.kpi-trend  → text-xs font-normal text-muted-foreground
```
Disponíveis para uso em Sprint 3 (PageHeader/KPIs) sem editar páginas agora.

---

## Arquivos a alterar (sem mudar nenhuma página/hook/lógica)

| Arquivo | Mudança |
|---|---|
| `src/index.css` | Tokens dark refinados, 3 gradientes, 3 níveis de glow, 3 timings, utilities `.bg-gradient-*`, `.glow-hover/active/cta`, `.surface-glass`, `.shimmer`, `.kpi-*`, microinteração global 150ms |
| `tailwind.config.ts` | Keyframe + animação `shimmer`; mapeia `transitionDuration` extra (`fast: 150ms`) se necessário |
| `src/components/ui/button.tsx` | Variant `premium` (gradient-strong + glow-cta no hover) + `duration-150` |
| `src/components/ui/card.tsx` | Variants `elevated` (hover-lift + glow-hover) e `glow` (gradient-soft border + glow-active) |
| `src/components/ui/input.tsx` | Focus glow tech (ring + shadow primary/10) + `duration-150` |
| `src/components/ui/skeleton.tsx` | `shimmer` no lugar de `pulse` |
| `src/components/ui/dialog.tsx` | Shadow-xl mais elegante; mantém timings Radix |
| `src/components/layout/AppSidebar.tsx` | Item ativo: `bg-gradient-primary-whisper` + `border-l-2 border-primary` + `glow-active`; hover: `glow-hover` + `translate-x-0.5`; espaçamento `space-y-1.5`; separadores `my-3` entre grupos lógicos; avatar do usuário com `bg-gradient-primary-strong` |
| `src/components/layout/AppLayout.tsx` | Header desktop com classe `surface-glass` |

**Não alterado:** páginas, rotas, hooks, queries, edge functions, RLS, tipos, lógica de negócio, estrutura de componentes.

---

## Riscos

- Variants novas (`premium`/`elevated`/`glow`) são **opt-in** — componentes existentes não mudam visualmente além do refinamento de tokens.
- Mudança de primary para roxo aplica-se globalmente via token semântico (objetivo declarado).
- Timings 150ms são percebidos como mais responsivos sem causar instabilidade visual.

---

## Resultado esperado

- Dark mode com profundidade real e cards visivelmente destacados
- Identidade roxo+azul presente em CTAs, sidebar ativa e KPIs com **3 intensidades distintas** (estratégico, não uniforme)
- Glow comunicando **estado** (hover < ativo < CTA)
- Microinterações com **150ms** em elementos diretos (botões/links) e **200ms** em containers
- Espaçamento mais arejado na sidebar e em containers principais
- Utilities `.kpi-*` prontas para uso em Sprint 3

---

## Sugestões para Sprint 3 (após esta)

1. Componente `<PageHeader />` aplicando `.kpi-*` e espaçamento luxury
2. `chartTheme.ts` removendo ~75 hex hardcoded (DashboardWidget/TaskCalendar)
3. `<EmptyState />` ilustrado reutilizável
4. Stagger animations em listas (Kanban, tabelas)
5. Toggle de densidade compact/comfortable em localStorage
6. `⌘K` no GlobalSearch + atalho funcional
7. Toast premium com ícone colorido + barra de progresso

