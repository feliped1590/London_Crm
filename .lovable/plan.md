

# Fase 3: Limpeza Completa da Base de Dados

## Status Atual

| Etapa | Status |
|-------|--------|
| 1. Licenciamento (25 usuarios) | ✅ Concluido |
| 2. Auditoria de usuarios | ✅ Concluido |
| 3. Ocultar pagina Integracoes | ✅ Concluido |
| 4. Backup pre_go_live | ✅ Confirmado |
| **5. Limpeza completa** | 🔄 Em execucao |
| 6. Exclusao usuarios teste | ⏳ Pendente |
| 7. Validacao final | ⏳ Pendente |

---

## Script de Limpeza Completa

A limpeza sera executada via migration SQL respeitando a ordem de foreign keys para evitar erros de integridade referencial.

### Ordem de Exclusao

```text
1. Tabelas dependentes (filhas)
   ├── proposal_items
   ├── order_items
   ├── deal_participants
   ├── stage_checklist_completions
   └── whatsapp_messages

2. Tabelas intermediarias
   ├── proposals
   ├── orders
   ├── tasks
   ├── activities
   ├── email_logs
   └── ai_conversations

3. Tabelas principais
   ├── deals (+ deal_audit_log)
   ├── contacts
   └── companies

4. Dados ERP (TODOS serao removidos conforme solicitado)
   ├── crm_order_items
   ├── crm_orders
   ├── crm_products
   └── crm_clients

5. Logs e controles
   ├── order_audit_log
   ├── erp_sync_log
   └── ai_copilot_suggestions
```

---

## Migration SQL Completa

```sql
-- ==============================================
-- GO-LIVE Migration 2: Limpeza Completa da Base
-- Backup confirmado: pre_go_live_20260207
-- ==============================================

-- FASE 1: Tabelas dependentes
DELETE FROM public.proposal_items;
DELETE FROM public.order_items;
DELETE FROM public.deal_participants;
DELETE FROM public.stage_checklist_completions;
DELETE FROM public.whatsapp_messages;

-- FASE 2: Tabelas intermediarias
DELETE FROM public.proposals;
DELETE FROM public.orders;
DELETE FROM public.tasks;
DELETE FROM public.activities;
DELETE FROM public.email_logs;
DELETE FROM public.ai_conversations;
DELETE FROM public.ai_copilot_suggestions;

-- FASE 3: Tabelas principais de negocios
DELETE FROM public.deal_audit_log;
DELETE FROM public.deals;
DELETE FROM public.contacts;
DELETE FROM public.companies;

-- FASE 4: Dados do ERP (todos sao de teste)
DELETE FROM public.crm_order_items;
DELETE FROM public.crm_orders;
DELETE FROM public.crm_products;
DELETE FROM public.crm_clients;

-- FASE 5: Logs e controles
DELETE FROM public.order_audit_log;
DELETE FROM public.erp_sync_log;

-- FASE 6: Resetar controles de sincronizacao
UPDATE public.erp_sync_control 
SET last_sync_at = NULL, 
    last_record_count = 0,
    updated_at = now();

-- Manter intactos:
-- ✓ Estrutura do banco (72 tabelas)
-- ✓ Configuracoes (custom_fields, automations, pipelines)
-- ✓ Perfis e permissoes (user_roles, module_permissions)
-- ✓ Tabelas de preco (pricing_tables)
-- ✓ Licenciamento (license_settings)
-- ✓ Auditoria de usuarios (user_audit_log)
```

---

## Proximos Passos Apos Limpeza

### Exclusao de Usuarios de Teste

Apos a limpeza da base, executar a exclusao dos usuarios:
- Usuario Teste - Vendedor
- Jonatan
- Jose

Isso sera feito via Edge Function `delete-user`.

### Validacao Final

- [ ] Login da administradora Bianca
- [ ] Criar primeira empresa em producao
- [ ] Criar primeiro negocio no pipeline
- [ ] Verificar integracao ERP (em background)
- [ ] Testar IA Assistant
- [ ] Confirmar GO-LIVE

---

## Resumo de Alteracoes

| Recurso | Acao |
|---------|------|
| Nova Migration SQL | Limpeza completa de 20+ tabelas |
| Edge Function delete-user | Excluir 3 usuarios de teste |

---

## Resultado Esperado

Apos execucao:
- Base 100% limpa (0 registros operacionais)
- Apenas usuario Bianca ativo
- Sistema pronto para primeiro registro real
- Configuracoes e estrutura preservadas

