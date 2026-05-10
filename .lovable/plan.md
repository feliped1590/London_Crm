# Fase 1 — Fundação da Arquitetura Operacional Qualyvac

## Escopo restrito

- **Entidade-alvo:** QUALYVAC EMBALAGENS EIRELI (`0379445a-811b-4842-8d1c-d0b326fed307`).
- **Pipelines envolvidos:** `OPERAÇÃO QUALYVAC`, `QUALYVAC - PCP`, `QUALYVAC - Qualidade`.
- **Intocáveis:** pipeline `Vendas` (`bdb23ee4…`), demais entidades, integrações ERP, fluxo de deals comerciais, automações comerciais existentes.

## Princípios reafirmados

1. ERP **totalmente desacoplado** após o envio do pedido. Nenhum reverse sync.
2. Cards do Kanban operacional representam **pedidos**, não deals.
3. Movimentação **100% manual** nesta fase. Sem automação, IA, SLA, notificações.
4. Pipeline `Vendas` permanece deal-centric, comercial, sem qualquer vínculo operacional.

---

## 1. Mudanças de banco (uma migration única)

### 1.1. `pipelines`
- Adicionar `is_operational boolean NOT NULL DEFAULT false`.
- Backfill: `UPDATE pipelines SET is_operational = true WHERE id IN (3 pipelines Qualyvac)`.
- Trigger `pipelines_operational_guard_trg` (BEFORE INSERT/UPDATE):
  - bloqueia `is_operational = true` se `pipeline_mode = 'sales'` **e** o pipeline não for um dos 3 Qualyvac já marcados (exceção controlada — `QUALYVAC - PCP` é hoje `sales` mas deve ser operacional);
  - bloqueia `is_operational = true` para o pipeline `Vendas` (id explícito) sempre;
  - bloqueia `is_operational = true` se o pipeline não tiver pelo menos 1 vínculo em `pipeline_legal_entities` apontando para a entidade Qualyvac (nesta fase — futura fase pode liberar outras entidades).

### 1.2. `orders`
- Adicionar `operational_pipeline_id uuid NULL REFERENCES pipelines(id) ON DELETE SET NULL`.
- Adicionar `operational_stage_id uuid NULL REFERENCES pipeline_stages(id) ON DELETE SET NULL`.
- Trigger `orders_operational_pipeline_guard_trg` (BEFORE INSERT/UPDATE):
  - se `operational_pipeline_id IS NOT NULL`, exige que o pipeline tenha `is_operational = true`;
  - se `operational_stage_id IS NOT NULL`, exige que o stage pertença ao `operational_pipeline_id`;
  - exige que `orders.legal_entity_id` esteja vinculado ao pipeline via `pipeline_legal_entities`.
- **Não** alteramos `orders.status`, `orders.pipeline_id`, `orders.deal_id` — preservados.

### 1.3. `order_operational_stage_history` (nova tabela)
- Colunas: `id`, `order_id` (FK), `pipeline_id`, `from_stage_id`, `to_stage_id`, `moved_by` (uuid user), `moved_at` (timestamptz default now()), `reason` (text NULL), `tenant_id`.
- Trigger `orders_log_operational_stage_change_trg` (AFTER UPDATE em `orders`): grava 1 linha sempre que `operational_stage_id` mudar.
- RLS: select global por tenant + entidade; insert apenas via trigger (sem policy de insert direto pelo cliente).

### 1.4. RLS / políticas
- `orders` policies existentes já cobrem os novos campos (mesma linha).
- `order_operational_stage_history`: SELECT por tenant + `user_legal_entities`; nenhuma policy de mutação direta.

### 1.5. NÃO mexemos em
- `controls_order_status`, `pipeline_stage_order_status_map`, `apply_pipeline_stage_to_order`, `tenant_settings.pipeline_sync` — ficam dormentes (limpeza em fase posterior, fora do escopo).
- `process-order-sync`, `validate-order-sync`, edge functions ERP — zero alterações.

---

## 2. Frontend — novos arquivos e mudanças

### 2.1. Hooks novos (não tocam nos existentes)
- `src/hooks/useOperationalPipelines.ts` — lista pipelines com `is_operational = true` visíveis ao usuário.
- `src/hooks/useOperationalKanbanData.ts` — order-centric: busca `orders` com `operational_pipeline_id = X` agrupados por `operational_stage_id`. Inclui realtime opt-in (canal próprio, isolado).
- `src/hooks/useMoveOrderOperationalStage.ts` — mutation única: update + grava motivo opcional.

### 2.2. Componentes novos
- `src/components/pipeline/operational/OperationalKanbanBoard.tsx` — board independente, drag & drop manual.
- `src/components/pipeline/operational/OperationalOrderCard.tsx` — card de pedido (cliente, valor, prazo, "✔ Enviado ao ERP em DD/MM" como info estática).
- `src/components/pipeline/operational/OperationalKanbanHeader.tsx` — selector de pipeline operacional + banner explicativo.
- `src/components/pipeline/operational/OperationalDisclaimerBanner.tsx` — banner fixo "Pipeline operacional interno — não sincroniza com o ERP".
- `src/components/pipeline/operational/MoveStageDialog.tsx` — confirma movimentação + motivo opcional.

### 2.3. Página
- `src/pages/OperationalPipeline.tsx` — rota `/operacional` (ou similar).
- Registrar rota em `src/App.tsx`.
- Adicionar item no `AppSidebar.tsx` **somente** para usuários com acesso à entidade Qualyvac (`useLegalEntities` filtrando `0379445a…`).

### 2.4. Settings — novo toggle (somente admin/dev)
- Em `src/pages/Settings.tsx` (ou subcomponente de pipelines), adicionar coluna/toggle "Operacional" para pipelines.
- UI bloqueia o toggle em `Vendas` e em pipelines `pipeline_mode = 'sales'` que não estejam em Qualyvac (mensagem explicativa).
- Trigger do banco é a fonte da verdade — UI é defesa em profundidade.

### 2.5. Não mexer em
- `usePipelineData`, `usePipelines`, `Pipeline.tsx` (Kanban comercial atual) — intactos.
- `useSalesFunnelData`, `useDashboardData`, `useTodayData` — intactos.
- `process-order-sync`, mappers ERP — intactos.

---

## 3. Estratégia de migrations

Migration única, idempotente, em ordem:
1. `ALTER TABLE pipelines ADD COLUMN is_operational ...`
2. Backfill dos 3 pipelines Qualyvac.
3. Função + trigger `pipelines_operational_guard`.
4. `ALTER TABLE orders ADD COLUMN operational_pipeline_id`, `operational_stage_id` + FKs.
5. Função + trigger `orders_operational_pipeline_guard`.
6. `CREATE TABLE order_operational_stage_history` + índices + RLS.
7. Função + trigger `orders_log_operational_stage_change`.

Cada bloco com `IF NOT EXISTS` / `DROP TRIGGER IF EXISTS` para rerun seguro.

---

## 4. Estratégia de rollback

Rollback puramente aditivo (zero destrutivo no que já existe):
1. `DROP TRIGGER` orders_log_operational_stage_change, orders_operational_pipeline_guard, pipelines_operational_guard.
2. `DROP TABLE order_operational_stage_history`.
3. `ALTER TABLE orders DROP COLUMN operational_pipeline_id, operational_stage_id`.
4. `ALTER TABLE pipelines DROP COLUMN is_operational`.
5. Remover rota `/operacional`, item de menu e arquivos novos. Nenhum código antigo modificado → reverter é limpo.

---

## 5. Sequência recomendada de implementação

1. **Migration de schema + triggers + RLS** (aprovação do usuário).
2. Após aprovação, gerar tipos e implementar:
   - hooks novos;
   - componentes do board;
   - página + rota + item de menu condicional;
   - banner + disclaimer.
3. Toggle "Operacional" na tela de Settings (com guard de UI).
4. QA manual:
   - Vendas continua funcionando exatamente igual;
   - pipelines não-Qualyvac inalterados;
   - tentar marcar Vendas como operacional → bloqueado;
   - mover pedido entre etapas → grava histórico;
   - pedido sem `legal_entity_id` Qualyvac → bloqueado pelo trigger.

---

## 6. Impactos esperados

- **Schema:** +1 coluna em `pipelines`, +2 colunas em `orders`, +1 tabela nova, +3 triggers. Sem alteração de comportamento atual.
- **Frontend:** +1 rota, +1 item de menu (condicional Qualyvac), +1 toggle em Settings. Zero alteração nas telas existentes.
- **Edge functions / ERP:** zero.
- **Realtime:** novo canal isolado para `orders` (filtrando por `operational_pipeline_id`). Não interfere nos canais existentes.

---

## 7. Riscos identificados

| Risco | Mitigação |
|---|---|
| Trigger bloqueia update legítimo de `orders` por entidade Qualyvac sem vínculo correto | Backfill validado antes de ativar trigger; trigger só dispara quando `operational_pipeline_id IS NOT NULL` |
| Usuário marca pipeline comercial como operacional via SQL direto | Trigger no banco bloqueia (fonte da verdade), não só UI |
| Histórico cresce rápido | Índice em `(order_id, moved_at desc)`; sem retenção nesta fase |
| Confusão entre Kanban comercial e operacional | Banner permanente + nomenclatura clara + rota separada |
| `QUALYVAC - PCP` está com `pipeline_mode = 'sales'` | Trigger faz exceção explícita pelos 3 IDs Qualyvac no backfill inicial; em fase futura, normalizar `pipeline_mode` |

---

## 8. Dependências

- Estrutura `pipeline_legal_entities` já existente e populada para os 3 pipelines Qualyvac. ✅
- `user_legal_entities` para visibilidade no menu. ✅
- Sem dependências externas / sem novos secrets / sem novos packages.

---

## 9. Fora do escopo desta Fase 1

- Limpeza de `controls_order_status`, `pipeline_stage_order_status_map`, RPC `apply_pipeline_stage_to_order`.
- Renomear `orders.status` para `erp_dispatch_status`.
- Categorias de etapa (PCP / Qualidade / Logística) com agrupamento visual.
- Permissões granulares por etapa (quem pode mover de onde para onde).
- Automações, SLA, notificações, dashboards operacionais.
- Cancelamento manual de pedido refletindo no Kanban.
- Auto-entrada do pedido no pipeline operacional ao sincronizar.

Tudo isso entra em Fases 2+.
