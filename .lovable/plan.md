## Diagnóstico

Hoje existem **duas fontes diferentes** de "atividade do vendedor" no sistema:

### 1) Vendedor 360 — bloco "Atividades / Uso do CRM"
- Hook: `useQuery` → RPC `report_atividades_vendedor`
- Conta apenas: tarefas (criadas/concluídas/atrasadas/próximas 7d), interações na `activities`, negócios parados 14/30d, propostas sem retorno, clientes sem próxima ação.
- Filtra tarefas/atividades por vínculo em `user_sales_reps` OU por empresas com `sales_rep_id`. Se o vendedor não tem usuário linkado e nenhuma empresa atribuída, vem tudo zero.

### 2) Relatório de Produtividade (Reports → "Detalhamento por Tipo de Interação")
- Hook: `useSellerProductivity` → RPCs `get_sales_rep_productivity` / `get_seller_productivity`
- Conta com riqueza maior: `activities, tasks_created, tasks_completed, stage_changes, proposals, orders, notes, emails, deal_updates` + `interaction_score`, `participation_percent`, `efficiency_rate`, `proposal_conversion_rate`, `pipeline_conversion_rate`, ranking, meta.
- É a fonte que mostra Fernanda Massi com 77 mudanças de etapa, 17 pedidos, 15 atualizações de negócio e score 348.

**Por isso o 360 da Fernanda aparece zerado** enquanto a produtividade mostra atividade real: as duas RPCs olham coisas diferentes e com regras de vínculo diferentes.

## Proposta

Alinhar o bloco "Atividades / Uso do CRM" do Vendedor 360 para consumir a **mesma fonte da produtividade** (`get_sales_rep_productivity`), garantindo paridade de números entre os dois relatórios e aproveitando KPIs que hoje só existem na produtividade (score, eficiência, conversões, ranking).

### Mudanças

1. **`SellerActivitySection.tsx`** (`src/components/bi/composite/`)
   - Substituir a chamada de `report_atividades_vendedor` por `get_sales_rep_productivity` filtrada pelo `sellerId` selecionado e pelo período do filtro do 360.
   - Manter o card "Atividades / Uso do CRM" como container, mas re-mapear os KPIs para os campos reais que o vendedor faz no CRM:
     - **Atividades** (`activities`)
     - **Tarefas criadas / concluídas** (`tasks_created`, `tasks_completed`)
     - **Mudanças de etapa** (`stage_changes`)
     - **Propostas emitidas** (`proposals`)
     - **Pedidos** (`orders`)
     - **Atualizações de negócio** (`deal_updates`)
     - **E-mails / Observações** (`emails`, `notes`)
     - **Score de produtividade** (`interaction_score`)
     - **Eficiência %**, **Conv. Proposta %**, **Conv. Pipeline %**, **Posição no ranking**
   - Manter "Última atividade registrada" usando `MAX(activities.created_at)` (consulta auxiliar leve) — a RPC de produtividade não devolve esse campo.

2. **`report_atividades_vendedor`** (RPC SQL)
   - Manter apenas para retrocompatibilidade ou descontinuar. Proposta: **manter**, sem mudanças, e parar de chamá-la pelo 360. Pode virar fonte para um sub-card "Pendências" (tarefas atrasadas, propostas sem retorno, clientes sem próxima ação) que **não existem** na RPC de produtividade — esses indicadores são úteis e não conflitam com a alinhamento de números.

3. **Layout do bloco**
   - Reorganizar `ExecutiveKpiGrid` em dois grupos:
     - **Produção** (vindos de `get_sales_rep_productivity`): Atividades, Tarefas criadas, Tarefas concluídas, Mudanças de etapa, Propostas, Pedidos, Atualiz. negócios, E-mails, Observações, **Score**.
     - **Performance** (mesma RPC): Eficiência %, Conv. Proposta %, Conv. Pipeline %, Posição (`rank_position`), Participação % do time.
     - **Pendências** (vindas de `report_atividades_vendedor`, opcional): Tarefas atrasadas, Próximas 7d, Negócios parados 14/30d, Propostas sem retorno 7d, Clientes sem próxima ação.

### Impacto

- Números do bloco "Atividades / Uso do CRM" no Vendedor 360 passam a **bater 100% com o relatório de Produtividade** (mesma RPC).
- Vendedores sem vínculo em `user_sales_reps` (Fernanda Massi) passam a aparecer com seus números reais.
- Nenhuma mudança em pipelines/orders/proposals — apenas no consumo de dados do 360.
- Sem migration obrigatória (`report_atividades_vendedor` mantida intacta como fonte de "pendências").

## Pergunta antes de implementar

Manter o sub-bloco "Pendências" (tarefas atrasadas, propostas sem retorno, clientes sem próxima ação) consumindo a RPC antiga, ou simplifico mostrando apenas os números da produtividade?

## Arquivos alterados
- `src/components/bi/composite/SellerActivitySection.tsx` — troca de fonte, re-mapeamento de KPIs, novo layout em grupos.
- (Opcional) `src/components/bi/composite/Seller360Report.tsx` — se precisar passar mais filtros (já tem `sellerId`, `startDate`, `endDate`, `legalEntityId`).

## Validação
1. Abrir `/bi?r=vendedor_360`, selecionar Fernanda Massi.
2. Confirmar que "Mudanças de etapa = 77", "Pedidos = 17", "Atualiz. negócios = 15", "Score = 348" — mesmos números do print da produtividade.
3. Conferir 2-3 outros vendedores com perfis distintos (com e sem `user_sales_reps`).
