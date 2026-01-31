# CRM Opinado - Plano de Desenvolvimento

## Fase Atual: Sprint 4 (Qualidade de Processo)

**Status:** ✅ Aprovado | **Início:** Imediato

---

## Escopo Sprint 4

### 1. Timeline de Atividades por Registro
**Complexidade:** Baixa | **Tipo:** Obrigatório

- [ ] Componente `ActivityTimeline` para exibir histórico consolidado
- [ ] Exibir na aba de detalhes de Deal, Contact e Company
- [ ] Incluir: mudanças de etapa, emails, WhatsApp, tarefas concluídas
- [ ] Ordenação cronológica reversa (mais recente primeiro)

**Tabela existente:** `activities` (já possui os dados)

---

### 2. Notas Rápidas (Multi-notas com Timestamp)
**Complexidade:** Baixa | **Tipo:** Obrigatório

- [ ] Criar tabela `entity_notes` (entity_type, entity_id, content, created_by, created_at)
- [ ] Componente `QuickNotes` para adicionar/listar notas
- [ ] Integrar em Deal, Contact e Company
- [ ] Suporte a notas rápidas pós-ligação

**Migração necessária:** Nova tabela

---

### 3. Templates de Mensagens WhatsApp
**Complexidade:** Baixa | **Tipo:** Obrigatório

- [ ] Criar tabela `whatsapp_templates` (name, content, variables, is_shared, created_by)
- [ ] Componente para gerenciar templates em Configurações
- [ ] Seletor de template no chat do WhatsApp
- [ ] Suporte a variáveis: {{nome}}, {{empresa}}, {{deal}}

**Migração necessária:** Nova tabela

---

### 4. Notificações/Lembretes por Email
**Complexidade:** Média | **Tipo:** Obrigatório

- [ ] Criar tabela `notification_preferences` (user_id, task_reminder, deal_stagnant, proposal_expiring)
- [ ] UI de preferências em Configurações > Notificações
- [ ] Ativar edge function `process-task-reminders` com preferências
- [ ] Lembrete por email 1h antes de tarefas

**Migração necessária:** Nova tabela + atualizar edge function

---

## Arquitetura Técnica

### Novas Tabelas

```sql
-- entity_notes
CREATE TABLE entity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'deal', 'contact', 'company'
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- whatsapp_templates
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_shared BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- notification_preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users UNIQUE,
  task_reminder_email BOOLEAN DEFAULT true,
  task_reminder_hours INTEGER DEFAULT 1,
  deal_stagnant_alert BOOLEAN DEFAULT true,
  proposal_expiring_alert BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Novos Componentes

| Componente | Localização | Uso |
|------------|-------------|-----|
| `ActivityTimeline` | `src/components/timeline/` | Detalhe de Deal/Contact/Company |
| `QuickNotes` | `src/components/notes/` | Detalhe de Deal/Contact/Company |
| `WhatsAppTemplateSelector` | `src/components/whatsapp/` | Chat WhatsApp |
| `WhatsAppTemplatesManager` | `src/components/settings/` | Configurações |
| `NotificationPreferences` | `src/components/settings/` | Configurações |

---

## Ordem de Implementação

1. **Migração de banco** (todas as tabelas de uma vez)
2. **Timeline de Atividades** (usa dados existentes)
3. **Notas Rápidas** (independente)
4. **Templates WhatsApp** (independente)
5. **Notificações** (depende de edge function)

---

## Limites da Sprint 4

❌ **NÃO INCLUIR:**
- IA proativa ou sugestões automáticas
- Daily Digest
- Sugestão de próxima ação
- Leaderboard
- Mudanças no fluxo central do produto

✅ **FOCO:**
- Qualidade do dia a dia
- Ferramentas de apoio ao vendedor
- Registro de contexto

---

## Backlog Congelado (Pós-validação)

| Feature | Fase | Status |
|---------|------|--------|
| Daily Digest IA | F3 | ⏸️ Aguardando validação |
| Sugestão Próxima Ação | F3 | ⏸️ Aguardando validação |
| Clone de Registros | F2 | ⏸️ Próxima sprint |
| Leaderboard | F2 | ⏸️ Aguardando validação |
| Calendário Visual | F2 | ⏸️ Backlog |
| Tarefas Recorrentes | F2 | ⏸️ Backlog |

---

## Próximos Passos

1. ✅ Plano aprovado
2. ⏳ Executar migração de banco (3 tabelas + RLS)
3. ⏳ Implementar componentes na ordem definida
4. ⏳ Validar com usuários antes de avançar para Fase 3
