

# Fase 4G -- UI Multi-CNPJ (Seletor, Pedidos, Gestao e Filtros)

## Resumo

Implementar os componentes de interface necessarios para completar o suporte multi-CNPJ, conectando as tabelas `legal_entities` e `user_legal_entities` ja existentes no banco com a experiencia do usuario.

---

## 1. Componentes a Criar/Modificar

| Componente | Acao | Descricao |
|---|---|---|
| `src/components/layout/LegalEntitySelector.tsx` | Criar | Dropdown no header para selecionar CNPJ ativo |
| `src/components/layout/AppLayout.tsx` | Modificar | Incluir o seletor no header desktop |
| `src/hooks/useLegalEntities.ts` | Criar | Hook para buscar entidades e gerenciar CNPJ ativo |
| `src/components/orders/OrderDialog.tsx` | Modificar | Adicionar campo de CNPJ emissor ao criar/editar pedido |
| `src/components/settings/LegalEntityPermissionsManager.tsx` | Criar | Tela de gestao de vinculos usuario-CNPJ |
| `src/pages/Settings.tsx` | Modificar | Adicionar aba "CNPJs" para admins |

---

## 2. Hook useLegalEntities

Responsabilidades:
- Buscar `legal_entities` do tenant atual (via RLS automatico)
- Buscar `active_legal_entity_id` do perfil do usuario
- Mutation para atualizar `active_legal_entity_id` em `profiles`
- Logica de filtragem: admin ve todos, usuario sem restricoes ve todos, usuario com vinculos ve apenas os seus (consulta `user_legal_entities`)

Queries:
- `legal_entities` filtradas por `active = true`, ordenadas por `name`
- `profiles` para obter `active_legal_entity_id`
- `user_legal_entities` para verificar restricoes do usuario

---

## 3. LegalEntitySelector (Header)

Componente de dropdown compacto para o header desktop:
- Exibe o CNPJ ativo atual (nome curto + CNPJ formatado)
- Lista apenas os CNPJs acessiveis ao usuario (via hook)
- Ao trocar, atualiza `profiles.active_legal_entity_id`
- Se houver apenas 1 CNPJ, exibe como badge sem dropdown
- Se nao houver nenhum CNPJ cadastrado, nao exibe nada

Posicionamento: ao lado do `GlobalSearch` no header desktop do `AppLayout`.

---

## 4. OrderDialog -- Campo CNPJ Emissor

Adicionar um `Select` de CNPJ emissor no formulario de pedido:
- Posicao: acima da selecao de empresa/contato
- Pre-seleciona o `active_legal_entity_id` do usuario
- Lista apenas CNPJs acessiveis (via hook)
- Valor salvo no campo `legal_entity_id` da tabela `orders`
- Passa `legal_entity_id` no INSERT e UPDATE do pedido
- Se nao houver CNPJs cadastrados, campo oculto (compatibilidade legado)

---

## 5. LegalEntityPermissionsManager (Settings)

Tela para admins gerenciarem vinculos usuario-CNPJ:
- Lista usuarios do tenant com seus CNPJs vinculados
- Permite adicionar/remover vinculos (`user_legal_entities`)
- Exibe role de cada vinculo (admin/member/viewer)
- Mostra badge "Acesso total" para usuarios sem restricoes

Estrutura visual:
- Tabela com colunas: Usuario | CNPJs Vinculados | Acoes
- Botao "Vincular CNPJ" abre modal com selecao de usuario + CNPJ + role
- Botao de remover vinculo com confirmacao

---

## 6. Nova Aba em Settings

Adicionar tab "CNPJs" na pagina de configuracoes:
- Icone: `Building2` do lucide-react
- Visivel apenas para admins
- Conteudo: `LegalEntityPermissionsManager`

---

## 7. Fluxo de Dados

```text
legal_entities (banco, RLS por tenant)
       |
       v
useLegalEntities (hook)
       |
       +---> LegalEntitySelector (header)
       |         |
       |         v
       |     profiles.active_legal_entity_id (UPDATE)
       |
       +---> OrderDialog (campo legal_entity_id)
       |         |
       |         v
       |     orders.legal_entity_id (INSERT/UPDATE)
       |
       +---> LegalEntityPermissionsManager (settings)
                 |
                 v
             user_legal_entities (INSERT/DELETE)
```

---

## 8. Secao Tecnica

### Arquivos a criar
1. `src/hooks/useLegalEntities.ts` -- hook com queries e mutations
2. `src/components/layout/LegalEntitySelector.tsx` -- dropdown do header
3. `src/components/settings/LegalEntityPermissionsManager.tsx` -- gestao de permissoes

### Arquivos a modificar
1. `src/components/layout/AppLayout.tsx` -- inserir seletor no header
2. `src/components/orders/OrderDialog.tsx` -- adicionar campo legal_entity_id
3. `src/pages/Settings.tsx` -- adicionar aba CNPJs

### Nenhuma alteracao no banco
Todas as tabelas, funcoes e policies ja estao implementadas (Fases 4E e 4F).

### Riscos e Mitigacoes

| Risco | Mitigacao |
|---|---|
| Usuario sem CNPJs cadastrados | Seletor oculto, campo opcional no pedido |
| Troca de CNPJ ativo sem recarregar dados | Invalidar queries relevantes ao trocar |
| Performance ao listar usuarios+vinculos | Queries com joins otimizados, paginacao se necessario |

