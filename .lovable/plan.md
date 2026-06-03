## Problema

Hoje as tabelas `setores`, `segmentos` e `atividades` existem no banco e são **lidas** pelo cadastro de cliente (via `useClassificacao`), mas **não existe nenhuma tela para cadastrar/editar** esses registros. Por isso o Setor "Serviços" aparece sem segmentos e o dropdown fica travado — não tem como popular pela UI.

## Objetivo

Adicionar uma aba **"Classificação"** em *Configurações* permitindo ao Admin gerenciar a taxonomia em três níveis (Setor → Segmento → Atividade), isolada por tenant.

## Escopo

### 1. Nova aba em Settings
- Item de menu **"Classificação"** dentro de *Configurações* (visível só para Admin/Dev).
- Layout em 3 colunas (mestre-detalhe):
  - **Setores** (esquerda) — lista clicável; o selecionado filtra a coluna do meio.
  - **Segmentos** (centro) — lista filtrada pelo setor selecionado.
  - **Atividades** (direita) — lista filtrada pelo segmento selecionado.

### 2. Operações por nível
Cada coluna terá:
- Botão **"+ Novo"** abrindo modal simples (campo *Nome* + *Ordem*).
- Botão de **editar** (renomear / mudar ordem / ativar-inativar) por linha.
- Botão de **excluir** com confirmação (soft delete via `is_active=false` para preservar histórico de clientes vinculados).

### 3. Regras de negócio
- Apagar um Setor não remove segmentos/atividades filhos — apenas marca o setor como inativo. Filhos continuam visíveis se o cliente já estava vinculado, mas somem dos dropdowns de novo cadastro.
- Nome único por nível dentro do mesmo pai (ex.: dois segmentos com mesmo nome no mesmo setor → bloqueado).
- `tenant_id` preenchido automaticamente.
- Apenas Admin/Dev podem criar/editar/inativar; demais usuários só leem.

### 4. Seed inicial sugerido (opcional)
Botão **"Sugerir taxonomia padrão"** que popula uma base coerente com a heurística do CNAE Classifier já implementada (Indústria → Embalagem, Frigorífico, Laticínios…; Serviços → Tecnologia, Transportadoras…; Comércio → Varejo, Atacado…; etc.). Importa só o que ainda não existe.

### 5. Integração com o cadastro de cliente
Sem mudanças no `CustomerNew.tsx` — ele já consome `useClassificacao`, então assim que o Admin cadastrar os segmentos, o dropdown destrava automaticamente e as sugestões via CNAE passam a casar.

## Fora de escopo
- Reorganizar clientes existentes em massa.
- Bulk import por CSV (pode vir depois).
- Edição inline drag-and-drop de ordem (usaremos campo numérico simples).

## Detalhes técnicos

- **Arquivos novos:**
  - `src/pages/settings/ClassificacaoSettings.tsx` (página principal 3 colunas).
  - `src/components/settings/classificacao/ClassificacaoLevelColumn.tsx` (componente reutilizado p/ Setor/Segmento/Atividade).
  - `src/components/settings/classificacao/ClassificacaoFormDialog.tsx` (modal create/edit).
  - `src/hooks/useClassificacaoAdmin.ts` (mutations: create/update/softDelete + invalidate da query `classificacao-options`).
  - Opcional: edge function `seed-classificacao-default` para o botão de sugestão.
- **Roteamento:** adicionar rota em `src/App.tsx` (ex.: `/settings/classificacao`) e link no menu de Configurações.
- **RLS:** verificar/garantir policies em `setores/segmentos/atividades` para INSERT/UPDATE restrito a Admin/Dev do tenant (migration se faltar).
- **Validação:** unicidade `(tenant_id, parent_id, nome)` por trigger/constraint.

## Critérios de aceite
1. Admin acessa *Configurações → Classificação* e cria "Tecnologia" sob o setor "Serviços".
2. Ao voltar em *Novo Cliente* com CNAE de TI, o dropdown Segmento abre e "Tecnologia" aparece — auto-sugestão do CNAE preenche automaticamente.
3. Usuário comum (Vendas) não vê o botão "+ Novo" nem consegue chamar a mutation.
4. Inativar um segmento faz ele sumir dos novos cadastros, mas clientes antigos continuam exibindo o nome.
