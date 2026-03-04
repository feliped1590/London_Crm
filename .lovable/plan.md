

## Diagnóstico

Após análise detalhada do código e das políticas de segurança do banco de dados (RLS), identifiquei o seguinte:

1. **As políticas de segurança (RLS) estão corretas** — vendedores e atendentes só conseguem buscar do banco os negócios onde são donos, criadores, participantes ou delegados. Administradores veem tudo.

2. **O problema real é o filtro padrão no frontend** — o filtro "Responsável" inicia com o valor `"all"` (Todos) para todos os tipos de usuário. Para administradores, isso mostra todos os negócios do banco. Para vendedores, mesmo com `"all"`, o RLS já restringe, mas a opção "Todos" fica visível sem necessidade.

3. **A correção necessária é exclusivamente no frontend** — alterar o valor inicial do filtro e ajustar as opções visíveis conforme o perfil do usuário.

---

## Plano de Implementação

### 1. Alterar o filtro padrão para "Meus negócios" (`src/pages/Pipeline.tsx`)

- Mudar o `useState` do `filterOwner` de `'all'` para `'mine'` — assim **todos os perfis** (incluindo administradores) iniciam vendo apenas seus próprios negócios.

### 2. Restringir opções do filtro para não-administradores (`src/components/pipeline/PipelineFilters.tsx`)

- Receber uma nova prop `isAdmin` no componente de filtros.
- Vendedores/atendentes: remover a opção "Todos" do select de responsável (só terão "Meus negócios").
- Administradores: manter ambas as opções ("Meus negócios" e "Todos").

### 3. Ajustar "Limpar filtros" para respeitar o novo padrão

- A função `clearFilters` deve redefinir o filtro de responsável para `'mine'` em vez de `'all'`.

---

**Resultado esperado**: Todos os usuários iniciam vendo apenas seus próprios negócios. Somente administradores podem optar por ver todos os negócios do pipeline selecionando "Todos" no filtro.

