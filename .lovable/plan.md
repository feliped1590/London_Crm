

# Auditoria de Segurança - Diagnóstico Completo

## Resumo Executivo

A verificação de segurança identificou **questões que requerem atenção**, mas nenhuma vulnerabilidade crítica imediata. O sistema já possui uma boa base de segurança implementada.

---

## Achados por Severidade

### Erros (Prioridade Alta)

| Achado | Descrição | Impacto |
|--------|-----------|---------|
| Security Definer Views (2) | Views definidas com SECURITY DEFINER que usam permissões do criador, não do usuário | Baixo - são views internas |

### Avisos (Prioridade Média)

| Achado | Descrição | Tabelas Afetadas |
|--------|-----------|------------------|
| Políticas RLS Permissivas (18) | Uso de `USING (true)` ou `WITH CHECK (true)` | crm_order_items, crm_orders, crm_products, pipeline_stages, etc. |
| Functions sem search_path (2) | Funções sem `SET search_path` definido | prevent_audit_modification, update_pipelines_updated_at |
| Extensão no schema public (1) | pg_net instalada no schema public | Baixo impacto |
| Proteção de senha vazada | Desabilitada por padrão | Configuração de infraestrutura |

---

## Análise Detalhada das Políticas RLS Permissivas

### Tabelas com `WITH CHECK (true)` (INSERT sem restrição)

| Tabela | Política | Risco Real |
|--------|----------|------------|
| `access_violation_log` | System can insert | BAIXO - tabela de log do sistema |
| `company_audit_log` | System can insert | BAIXO - trigger interno |
| `deal_audit_log` | Service role can insert | BAIXO - trigger interno |
| `order_audit_log` | Service role can insert | BAIXO - trigger interno |
| `ai_copilot_suggestions` | Service role can insert | BAIXO - função interna |
| `proposal_access_logs` | Service role can insert | BAIXO - função interna |
| `google_calendar_sync_logs` | System can insert | BAIXO - sync interno |
| `task_reminders` | Service role can insert | BAIXO - função agendada |
| `user_audit_log` | Authenticated users | BAIXO - imutável por trigger |
| `crm_order_items` | INSERT/UPDATE/DELETE true | MEDIO - dados ERP |
| `crm_orders` | INSERT/UPDATE true | MEDIO - dados ERP |

### Tabelas com `USING (true)` para SELECT e operações

| Tabela | Operações | Justificativa |
|--------|-----------|---------------|
| `crm_clients` | ALL (Service role) | Sync ERP - protegido por autenticação |
| `crm_products` | ALL (Service role) | Sync ERP - protegido por autenticação |
| `erp_sync_control` | ALL (Service role) | Controle de sincronização |
| `erp_sync_logs` | ALL (Service role) | Logs de sincronização |
| `pipeline_stages` | ALL | Configuração global do sistema |

---

## Recomendações de Remediação

### 1. Correções Imediatas (Podem ser feitas agora)

**1.1 Adicionar search_path às funções:**
```sql
-- Atualizar prevent_audit_modification
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria são imutáveis';
END;
$function$;

-- Atualizar update_pipelines_updated_at  
CREATE OR REPLACE FUNCTION public.update_pipelines_updated_at()
RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
```

**1.2 Restringir políticas de dados ERP:**
```sql
-- crm_order_items - restringir a autenticados
DROP POLICY IF EXISTS "crm_order_items_insert_authenticated" ON crm_order_items;
CREATE POLICY "Authenticated users can insert crm_order_items"
ON crm_order_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Repetir para UPDATE e DELETE
```

### 2. Correções de Médio Prazo

**2.1 Restringir visualização de perfis (profiles):**
- Atualmente todos autenticados veem todos os perfis
- Recomendação: permitir ver apenas nome e avatar, ocultar telefone

**2.2 Restringir erp_sync_logs:**
- Mover para acesso apenas admin
- Contém informações de arquitetura do sistema

### 3. Itens Já Aceitos/Ignorados (Baixo Risco)

| Item | Motivo |
|------|--------|
| has_role SECURITY DEFINER | Necessário para RLS, bem protegido |
| pg_net no schema public | Baixo impacto, recomendação de organização |
| dangerouslySetInnerHTML em chart.tsx | CSS estático, não user-controlled |
| Proteção de senha vazada | Configuração de infraestrutura externa |

---

## Verificações Positivas de Segurança

O sistema já possui:
- Autenticação obrigatória para todos os módulos
- RLS ativo em todas as tabelas críticas
- Controle de acesso por função (admin, vendedor, atendente)
- Triggers de imutabilidade em logs de auditoria
- Edge Functions com autenticação e rate limiting
- Secrets configuradas corretamente (8 secrets ativas)
- Separação de roles em tabela dedicada (user_roles)
- Governança de carteira implementada
- Log de intervenções administrativas

---

## Plano de Execução

### Fase 1 - Imediata (pode ser executada agora)
1. Adicionar `search_path` às 2 funções afetadas
2. Restringir políticas de tabelas ERP (crm_order_items, crm_orders)

### Fase 2 - Curto Prazo (próxima sprint)
1. Revisar política de visualização de perfis
2. Restringir erp_sync_logs para admins
3. Mover pg_net para schema dedicado (opcional)

### Fase 3 - Opcional
1. Habilitar proteção de senha vazada (configuração externa)

---

## Conclusão

**O sistema está em bom estado de segurança para produção.** Os achados identificados são principalmente:
- Configurações de melhor prática (não vulnerabilidades ativas)
- Políticas permissivas em tabelas de sistema/auditoria (intencional)
- Funções de trigger sem search_path (baixo risco)

As correções sugeridas na Fase 1 podem ser implementadas imediatamente para elevar ainda mais a postura de segurança.

