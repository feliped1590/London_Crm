# Auditoria de Responsividade — Listas Principais

## Objetivo
Tornar as telas **Produtos**, **Clientes** e **Pedidos** confortáveis em desktops 1440x900 com zoom do navegador até **150%** (equivalente a uma viewport efetiva de ~960px). Hoje o conteúdo quebra, colunas se espremem (ex.: SKU em coluna única empilhado verticalmente) e o usuário precisa reduzir o zoom.

## Diagnóstico atual
- Tabelas usam largura fixa de coluna implícita — colunas com texto curto (SKU, código) recebem largura mínima e o texto quebra letra-a-letra.
- Não há coluna fixa (sticky) na esquerda; ao rolar horizontalmente, perde-se a referência da linha.
- Padding/fonte são constantes — não há "modo compacto" em zoom alto.
- Algumas colunas secundárias (Iniflex, Pedido ERP, Logística com badge) ocupam espaço mesmo quando não há prioridade.

## Estratégia (combinação das três)

### 1. Densidade automática
Criar utilitário `useResponsiveDensity()` que observa `window.innerWidth` (já com zoom aplicado, pois zoom reduz a viewport CSS):
- `>= 1280px` → densidade **comfortable** (padding/fonte atuais)
- `960–1279px` → densidade **compact** (padding reduzido, fonte 13px, badges menores)
- `< 960px` → densidade **dense** + ativa ocultação de colunas

Aplicar via classe no `<Table>` raiz (`data-density="compact"`) e tokens em `index.css` controlando `--row-py`, `--row-px`, `--cell-fs`.

### 2. Ocultação progressiva de colunas
Definir prioridade por coluna em cada lista. Colunas baixa prioridade recebem `hidden xl:table-cell` / `hidden 2xl:table-cell`. Prioridades:

**Produtos**
- Sempre: SKU, Descrição, Preço, Ações
- Esconde primeiro: Grupo, Unidade, NCM, dimensões individuais (L/C/E)
- Adicionar tooltip/expand row para colunas ocultas

**Clientes (Companies)**
- Sempre: Empresa, CNPJ, Responsável, Ações
- Esconde primeiro: Iniflex, Tabela de Preço, Setor, Contato

**Pedidos**
- Sempre: Número, Empresa, Status, Sinc. ERP, Ações
- Esconde primeiro: Tipo, Logística (badge), Pedido ERP

### 3. Scroll horizontal com coluna fixa
Quando densidade = dense e ainda houver overflow:
- Wrap `<Table>` em container `overflow-x-auto`
- Primeira coluna (Empresa/SKU/Número) recebe `sticky left-0 bg-card z-10` com sombra sutil à direita.
- Última coluna de Ações fica `sticky right-0` para permanecer acessível.

## Componentes a criar
- `src/hooks/useResponsiveDensity.ts` — retorna `'comfortable' | 'compact' | 'dense'`.
- `src/components/ui/responsive-table.tsx` — wrapper sobre `Table` que injeta `data-density`, container com overflow e sticky.
- Tokens CSS em `src/index.css` (bloco `@layer components`):
  ```css
  [data-density="compact"] td, [data-density="compact"] th { @apply py-2 px-3 text-[13px]; }
  [data-density="dense"]   td, [data-density="dense"] th   { @apply py-1.5 px-2 text-[12px]; }
  ```

## Arquivos a editar
1. `src/index.css` — tokens de densidade + sticky helper.
2. `src/hooks/useResponsiveDensity.ts` — novo.
3. `src/components/ui/responsive-table.tsx` — novo wrapper.
4. `src/pages/Products.tsx` — aplicar wrapper, marcar prioridade nas `<TableHead>`/`<TableCell>` (classes `hidden xl:table-cell`), encolher célula SKU (`whitespace-nowrap` + `min-w-[120px]`).
5. `src/pages/Companies.tsx` — idem para colunas Iniflex/Setor/Tabela.
6. `src/pages/Orders.tsx` — idem para Tipo/Logística/Pedido ERP, manter Status e Sinc. ERP sempre visíveis.

## Validação
- Testar nas resoluções: 1440x900 @100%, 1440x900 @125%, 1440x900 @150% (~960px efetivos).
- Critérios: nenhum texto quebrando letra-a-letra; coluna identificadora sempre visível; ações alcançáveis sem scroll horizontal completo; sem scroll horizontal indevido até 1280px.

## Fora do escopo (próxima rodada, se aprovado)
- Pipeline, Dashboard, Hoje, modais de edição, formulários longos.
- Refactor para virtualização (TanStack Virtual) — só se a densidade não resolver listas muito longas.
