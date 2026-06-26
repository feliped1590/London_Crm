# Plano de Migração em Ondas — Fase 22B

## 1. Resumo executivo

Estado atual da prontidão:

- Base auditada na 22A com 73 tabelas base em `public`, 616 registros no snapshot e 45 tabelas com dados.
- Integridade relacional adequada no recorte auditado (0 órfãos nas FKs verificadas).
- Sem duplicidade nas chaves de negócio testadas no snapshot.
- Riscos críticos de prontidão ainda abertos para cutover total:
  - `orders.erp_code` com 0% preenchido;
  - `products.erp_code` com 0% preenchido;
  - `companies.cnpj` com 0% (uso de `document` no estado atual);
  - `profiles.employee_code` com 25% de cobertura;
  - `deals` sem `company_id` em 6/8 (75%);
  - inconsistência em campos denormalizados de `deals` (`company` texto e `owner_name`);
  - alertas relevantes de security/performance advisors.

Decisão executiva:

- **Carga real pequena:** **PARCIAL / GO condicional**.
- **Cutover completo:** **NO-GO** até saneamento dos riscos estruturais.

Justificativa:

- O modelo tem coerência referencial no snapshot, porém faltam chaves operacionais (especialmente ERP) e há lacunas comerciais em entidades de alto acoplamento (`orders`, `sales_proposals`, `products`, `deals`) que podem comprometer reconciliação, rastreabilidade e sincronização.

Evidências-base da 22A:

- Canvas executivo: `canvases/auditoria-migracao-crm.canvas.tsx`.
- Evidências JSON da sessão 22A (MCP Supabase):
  - `.cursor/projects/c-Users-Felipe-Duarte-Desktop-CRM-Qualyvac-Migration-qualyvac-migration/agent-tools/19f2bf44-95a0-46e1-bb96-650b7a06408f.txt` (inventário de tabelas);
  - `.cursor/projects/c-Users-Felipe-Duarte-Desktop-CRM-Qualyvac-Migration-qualyvac-migration/agent-tools/2c7772bc-b801-469d-bcf7-c24c1df7c7f1.txt` (security advisors);
  - `.cursor/projects/c-Users-Felipe-Duarte-Desktop-CRM-Qualyvac-Migration-qualyvac-migration/agent-tools/af0ddba6-777d-4e7c-885c-ac1df9da45ca.txt` (performance advisors).

## 2. Premissas

- Migração controlada por ondas, com escopo funcional delimitado.
- Sem alteração direta em produção sem aprovação explícita.
- Chaves ERP são critério obrigatório para transacionais (`products`, `orders`) antes de sincronização real.
- `document` pode ser usado temporariamente onde `cnpj` estiver vazio, desde que normalizado/validado e com regra de fallback formalizada.
- Nenhuma fila deve ser processada automaticamente durante carga.
- Todas as ondas exigem **pré-check** e **pós-check** com evidência.
- Cargas iniciais devem ocorrer em ambiente autorizado de teste/restauração controlada.

## 3. Mapa de dependências

Ordem lógica recomendada:

1. Tenants/legal_entities
2. Perfis/usuários/vendedores/permissões
3. Companies/clientes
4. Contatos
5. Produtos e auxiliares
6. Deals/pipeline
7. Propostas e itens
8. Pedidos e itens
9. Tarefas/atividades/notifications
10. Filas/integradores

Notas de acoplamento (22A):

- Raízes críticas: `companies`, `legal_entities`.
- Alto acoplamento: `orders`, `sales_proposals`, `products`, `deals`.
- Dependência operacional: propostas e pedidos requerem entidades comerciais saneadas e identificadores consistentes.

## 4. Ondas propostas

### Onda 0 — Preparação e saneamento

Objetivo:

- Corrigir e formalizar mapeamento de chaves e vínculos antes da primeira carga real.

Itens:

- Mapear e validar `products.erp_code`.
- Mapear e validar `orders.erp_code`.
- Confirmar regra `companies.document` vs `companies.cnpj` (normalização, fallback e unicidade).
- Corrigir/montar vínculo `deals.company_id`.
- Revisar coerência entre `owner_name` e responsável real (`owner_id`/vendedor).
- Definir IDs de vendedores/usuários canônicos por tenant/legal entity.
- Revisar e classificar advisors críticos de segurança (bloqueadores de cutover).

Critério de saída:

- Sem bloqueadores para a carga pequena recomendada (onda piloto real).

### Onda 1 — Cadastros raiz

Entidades:

- `tenants`
- `legal_entities`
- `profiles`
- `permission_templates` / `permission_template_grants`
- `sales_reps`
- `user_tenants`
- `user_legal_entities`
- `user_sales_reps`

Validações:

- Todos os registros com tenant correto.
- `legal_entities` com código ERP válido e único.
- Usuários com vínculos corretos por tenant/legal entity.
- Vendedores com mapeamento consistente código/usuário.

### Onda 2 — Clientes e contatos

Entidades:

- `companies`
- `company_contacts` / `contacts`
- carteira básica (se aplicável)

Validações:

- Sem duplicidade por `document`/CNPJ normalizado.
- Sem cliente sem `document`/CNPJ equivalente.
- `owner`/`sales_rep` preenchido onde obrigatório por regra de negócio.
- Contatos sem órfãos e com empresa válida.

### Onda 3 — Produtos e auxiliares

Entidades:

- `product_types`
- `product_groups`
- `product_subgroups`
- `product_families` / `product_classes`
- `products`

Validações:

- `erp_code` obrigatório antes de sync real.
- SKU único no escopo definido.
- Unicidade técnica sem duplicidade funcional.
- NCM e dimensões críticas preenchidas conforme regra mínima.
- `product_sync_queue` sem processamento automático.

### Onda 4 — Pipeline/deals

Entidades:

- `pipelines` / `pipeline_stages` (se necessário)
- `deals`
- `deal_stage_history`

Validações:

- Deals com `company_id` obrigatório no lote.
- `owner`/`sales_rep` coerente com cadastro de usuários.
- Stage válido e pertencente ao pipeline correto.
- Histórico coerente com o estado atual do deal.

### Onda 5 — Propostas

Entidades:

- `sales_proposals` / `proposals`
- `sales_proposal_items` / `proposal_items`

Validações:

- Proposta vinculada a empresa/deal conforme regra.
- Número de proposta único no escopo.
- Itens válidos e referenciando produtos válidos.
- Status em domínio permitido.

### Onda 6 — Pedidos

Entidades:

- `orders`
- `order_items`

Validações:

- Pedido com empresa e vendedor válidos.
- Itens válidos e consistentes com produto/preço/regra tributária mínima.
- `erp_code`/número ERP conforme regra aprovada.
- Sem fila processada automaticamente.
- `order_sync_queue` sob controle manual.

### Onda 7 — Atividades, tarefas e notificações

Entidades:

- `tasks`
- `interactions` / `activities`
- `notifications`

Validações:

- Tarefas sem órfãos.
- `owner`/`assigned_to` coerente com usuários ativos.
- Sem violação de carteira/alçada.
- `notifications` podem ser opcionais se dependentes de perfis ainda não ativos.

## 5. Primeira carga real pequena recomendada

Escopo recomendado (piloto real controlado):

- 1 tenant / 1 legal_entity
- 2 a 5 usuários/vendedores
- 10 clientes
- 10 contatos
- 10 produtos
- 3 deals
- 2 propostas
- 2 pedidos com itens

Regras operacionais:

- Não processar filas durante o piloto.
- Não chamar ERP.
- Não usar produção.
- Executar em restore-test/staging controlado.
- Definir lote com identificador único (`migration_batch_id`) para rastreio e eventual rollback.

Objetivo da carga pequena:

- Validar fluxo ponta a ponta de cadastro, vínculo e reconciliação sem expor operação completa.

## 6. Checklists por onda

Padrão obrigatório para cada onda:

### Pré-check

- Escopo do lote aprovado (entidades + volume + tenant/legal entity).
- Chaves obrigatórias e regras de unicidade validadas.
- Dependências da onda anterior concluídas.
- Filas automáticas e integrações externas explicitamente desativadas/isoladas.

### Carga

- Execução por lote versionado e rastreável.
- Ordem de carga respeitando dependências.
- Registro de evidência de início/fim, volume tentado e volume efetivo.

### Pós-check

- Integridade referencial no lote.
- Cobertura de campos obrigatórios por entidade.
- Contagem reconciliada origem vs destino no escopo da onda.

### Reconciliação

- Amostragem funcional por entidade (campos críticos e vínculos).
- Divergências classificadas por severidade (bloqueador, alto, médio, baixo).
- Plano de correção documentado para cada divergência.

### Rollback

- Critério de acionamento pré-definido.
- Remoção/estorno por identificador de lote no ambiente autorizado.
- Evidência de retorno ao estado pré-carga.

### Evidência

- Registro de aprovação GO/NO-GO da onda.
- Artefatos versionados (checklist, relatórios, logs de reconciliação).
- Ata de decisão para avanço de onda.

## 7. Critérios GO/NO-GO

Classificação de decisão:

- **GO (carga pequena):** critérios mínimos atendidos no escopo piloto.
- **PARCIAL:** operação possível com restrição de escopo e controles adicionais.
- **NO-GO:** presença de bloqueadores estruturais para o escopo proposto.

Critérios mínimos:

- 0 órfãos no lote migrado.
- 0 duplicidade crítica nas chaves de negócio do lote.
- Chaves ERP obrigatórias preenchidas conforme entidade (especialmente transacionais).
- Filas sob controle manual (sem processamento automático).
- Sem vazamento entre tenant/legal_entity.
- RLS/security sem blocker crítico para o tipo de operação autorizada.

Aplicação ao estado atual (22A -> 22B):

- **Carga pequena:** GO condicional (PARCIAL), desde que Onda 0 conclua saneamentos mínimos.
- **Cutover completo:** NO-GO.

## 8. Rollback

Diretrizes:

- Backup/snapshot obrigatório antes de cada carga.
- Namespace/lote de migração obrigatório para rastreio.
- Scripts/procedimentos de cleanup por lote previamente homologados.
- Evidência antes/depois arquivada por onda.
- Rollback somente em ambiente target autorizado e com aprovação formal.

Condições para acionar rollback:

- Violação de integridade relacional no lote.
- Divergência crítica de reconciliação sem correção imediata segura.
- Vazamento de tenant/legal_entity.
- Inconsistência em chaves obrigatórias que impeça continuidade da onda.

## 9. Pendências antes do cutover completo

- Preencher e validar ERP codes (`products`, `orders`) com cobertura operacional.
- Resolver deals sem `company_id`.
- Resolver alertas críticos de segurança (e revisar impacto de performance advisors prioritários).
- Decidir e formalizar o recorte de histórico comercial a migrar.
- Validar performance/RLS para volume real de operação.
- Definir freeze operacional e plano detalhado de cutover.

## 10. Recomendação final

- **Carga pequena:** **GO condicional** (escopo reduzido, controles estritos e Onda 0 concluída).
- **Carga completa:** **NO-GO** até saneamento dos pontos críticos.
- **Próxima fase recomendada:** **22C — especificação da primeira carga real pequena**, com:
  - contrato de lote (entidades, filtros, limites);
  - critérios de aceitação por entidade;
  - playbook operacional (janela, responsáveis, evidências, decisão de avanço).
