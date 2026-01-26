
# Plano: Criar Documentação de Uso do CRMPro

## Objetivo
Criar um manual de usuário completo e acessível para orientar os usuários finais no uso do software CRMPro, com instruções passo a passo para cada tela e funcionalidade.

## Estrutura da Documentação

A documentação será criada como uma página acessível dentro do próprio sistema, com navegação por tópicos e seções bem organizadas.

### Arquivo Principal
**Criar**: `src/pages/Help.tsx` - Página de documentação/ajuda integrada ao sistema

### Conteúdo Organizado por Módulos

```text
MANUAL DO USUÁRIO - CRMPro
├── 1. Primeiros Passos
│   ├── Login e Autenticação
│   ├── Navegação pelo Sistema
│   └── Botão Atualizar Dados
├── 2. Visão Geral (Dashboard)
│   ├── Cards de Estatísticas
│   ├── Widgets Personalizáveis
│   ├── Botão Personalizar Dashboard
│   └── Insights Resumidos
├── 3. Pipeline de Vendas
│   ├── Visão Kanban vs Lista
│   ├── Criar Novo Negócio
│   ├── Arrastar entre Etapas
│   ├── Editar Negócio (Abas: Dados, Propostas, Equipe, Histórico)
│   ├── Registrar Motivo de Perda
│   └── Filtros por Responsável, Etapa e Empresa
├── 4. Empresas
│   ├── Cadastrar Nova Empresa
│   ├── Campos: Razão Social, CNPJ, Fantasia, IE
│   ├── Visualizar Negócios Vinculados (Coluna Funil)
│   └── Tabela de Preços da Empresa
├── 5. Contatos
│   ├── Cadastrar Novo Contato
│   ├── Vincular a Empresa
│   ├── CPF e Tipo de Pessoa
│   ├── Visualizar Negócios Vinculados
│   └── Acessar WhatsApp do Contato
├── 6. Produtos
│   ├── Cadastrar Produto (SKU, Nome, Categoria)
│   ├── Medidas: Largura, Comprimento, Espessura
│   ├── Materiais e Cores
│   ├── Filtros por Categoria e Status
│   └── Ativar/Inativar Produto
├── 7. Tabelas de Preços
│   ├── Criar Nova Tabela
│   ├── Definir Regras de Desconto
│   ├── Vincular a Empresas/Contatos
│   └── Validade da Tabela
├── 8. Pedidos
│   ├── Criar Pedido Manual
│   ├── Pedido via Proposta Aprovada
│   ├── Status: Pendente, Em Produção, Faturado, Entregue
│   ├── Visualizar Itens do Pedido
│   └── Histórico de Alterações
├── 9. Tarefas
│   ├── Criar Nova Tarefa
│   ├── Prioridades: Baixa, Média, Alta, Urgente
│   ├── Vincular a Empresa, Contato ou Negócio
│   ├── Marcar como Concluída
│   └── Filtros: Pendentes, Concluídas, Atrasadas
├── 10. Relatórios
│   ├── Funil de Vendas
│   ├── Velocidade do Pipeline
│   ├── Motivos de Perda
│   ├── Dashboard Personalizado
│   └── Imprimir/Exportar Relatório
├── 11. Configurações (Apenas Administradores)
│   ├── Campos Personalizados
│   ├── Etapas do Pipeline
│   ├── Automações
│   ├── Permissões por Perfil
│   ├── Carteiras de Clientes
│   ├── Gerenciar Usuários
│   └── Dados de Teste
└── 12. Dicas e Boas Práticas
    ├── Manter Dados Atualizados
    ├── Usar o Botão Atualizar
    └── Registrar Atividades no Histórico
```

## Implementação

### 1. Criar Página de Ajuda (`src/pages/Help.tsx`)
- Página dedicada com navegação lateral por seções
- Conteúdo organizado em Accordion expandível
- Busca por palavra-chave nas instruções
- Ícones ilustrativos para cada seção
- Links de navegação direta para as telas do sistema

### 2. Adicionar Rota no Sistema
- Registrar rota `/help` no App.tsx
- Adicionar link "Ajuda" na sidebar (ícone de interrogação)

### 3. Estrutura do Conteúdo

Cada seção seguirá o formato:

```text
┌──────────────────────────────────────────┐
│ 📖 [Título do Módulo]                    │
├──────────────────────────────────────────┤
│ Descrição breve do que o módulo faz      │
├──────────────────────────────────────────┤
│ ✅ Passo 1: Ação inicial                 │
│    → Instrução detalhada                 │
│ ✅ Passo 2: Preencher campos             │
│    → Lista de campos obrigatórios        │
│ ✅ Passo 3: Salvar                       │
│    → O que acontece após salvar          │
├──────────────────────────────────────────┤
│ 💡 Dica: Informação útil adicional       │
│ ⚠️ Atenção: Cuidados importantes         │
└──────────────────────────────────────────┘
```

### 4. Design Visual
- Usar componentes existentes: Accordion, Card, Badge, Tabs
- Navegação lateral sticky para acesso rápido
- Indicador de progresso de leitura
- Botões de "Ir para Módulo" para navegação direta

---

## Arquivos a Criar/Modificar

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| **Criar** | `src/pages/Help.tsx` | Página principal da documentação |
| **Modificar** | `src/App.tsx` | Adicionar rota `/help` |
| **Modificar** | `src/components/layout/AppSidebar.tsx` | Adicionar link para Ajuda |

---

## Exemplo de Conteúdo (Pipeline)

```markdown
## Pipeline de Vendas

O Pipeline é o coração do CRM, onde você gerencia todas as oportunidades de negócio.

### Criar um Novo Negócio

1. Clique no botão **"Novo Negócio"** no canto superior direito
2. Preencha os campos:
   - **Nome**: Título identificador do negócio
   - **Valor**: Valor estimado da venda (R$)
   - **Empresa**: Selecione a empresa relacionada
   - **Contato**: Selecione o contato principal
   - **Data Prevista**: Quando espera fechar o negócio
3. Clique em **"Criar"**

### Mover entre Etapas

**Modo Kanban:**
- Arraste o card do negócio de uma coluna para outra
- Ao mover para "Fechado (Perdido)", será solicitado o motivo da perda

**Modo Lista:**
- Clique no negócio para abrir o formulário
- Altere o campo "Etapa" para a nova posição
- Salve as alterações

💡 **Dica**: O histórico de mudanças de etapa fica registrado na aba "Histórico" do negócio
```

---

## Benefícios

1. **Onboarding mais rápido**: Novos usuários aprendem sozinhos
2. **Menos suporte**: Dúvidas comuns respondidas na documentação
3. **Acessível no sistema**: Não precisa sair para consultar
4. **Navegação direta**: Links para ir direto à tela mencionada
5. **Buscável**: Encontre rapidamente o que precisa
