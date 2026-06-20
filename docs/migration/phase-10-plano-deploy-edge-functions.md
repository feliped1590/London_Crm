# Fase 10 — Plano de Deploy Controlado de Edge Functions (Staging)

## 1) Objetivo da fase

Definir um plano seguro de deploy em ondas para as Edge Functions no Supabase Staging, com critérios objetivos de liberação/bloqueio, sem executar deploy nesta etapa.

## 2) Premissas

- Fase 06 concluída (migrations aplicadas em staging).
- Fase 07 concluída (schema validado).
- Fase 08 concluída (storage/buckets documentados).
- Fase 09 concluída (inventário e mapeamento de secrets/risco).
- Ambiente atual é de planejamento; nenhum deploy será executado agora.
- Não haverá alteração de código, `supabase/config.toml`, migrations ou `.env`.

## 3) Decisões de escopo

- Esta fase cobre apenas planejamento técnico e classificação de risco para deploy futuro.
- O rollout será incremental por ondas, com validação entre ondas.
- Funções com integração externa crítica ficam bloqueadas nesta fase.
- Toda função classificada como alto risco exige revisão manual antes de qualquer liberação.

## 4) O que permanece bloqueado

- WhatsApp / Z-API.
- Resend / envio real de e-mail.
- Google Calendar.
- IA / Lovable AI.
- ERP / Projedata / Iniflex real.

## 5) Classificação das Edge Functions por ondas de deploy

### Onda 0 — candidatas a validação técnica sem chamada externa

- `generate-signed-url-secure` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: baixo | recomendacao: liberar para deploy staging
- `proposal-public-view` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: sim | chama API externa: nao | risco: medio | recomendacao: revisar antes

### Onda 1 — funcoes internas com Supabase/Auth/Storage, sem API externa

- `calcular-tributacao` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `credit-analysis` — categoria: BI/relatorios | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `enrich-company-single` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `enrich-companies-batch` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `import-products-csv` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `import-companies-bulk` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `import-companies-from-file` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `import-ncm-tipi` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: sim | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `prospecting-save-lead` — categoria: Outros | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes

### Onda 2 — funcoes de PDF (sem chamada externa)

- `generate-proposal-pdf` — categoria: PDFs | usa service_role: sim | usa secret externo: nao | verify_jwt=false: sim | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `generate-order-pdf` — categoria: PDFs | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `generate-quick-quote-pdf` — categoria: PDFs | usa service_role: sim | usa secret externo: nao | verify_jwt=false: nao | chama API externa: nao | risco: medio | recomendacao: revisar antes
- `generate-report-pdf` — categoria: PDFs/BI | usa service_role: sim | usa secret externo: nao | verify_jwt=false: sim | chama API externa: nao | risco: medio | recomendacao: revisar antes

### Onda 3 — funcoes administrativas de maior risco

- `create-user` — categoria: Auth/usuarios | usa service_role: sim | usa secret externo: nao | verify_jwt=false: sim | chama API externa: nao | risco: alto | recomendacao: revisar antes
- `update-user` — categoria: Auth/usuarios | usa service_role: sim | usa secret externo: nao | verify_jwt=false: sim | chama API externa: nao | risco: alto | recomendacao: revisar antes
- `delete-user` — categoria: Auth/usuarios | usa service_role: sim | usa secret externo: nao | verify_jwt=false: sim | chama API externa: nao | risco: alto | recomendacao: revisar antes
- `proposal-approve` — categoria: Outros/comercial | usa service_role: sim | usa secret externo: nao | verify_jwt=false: sim | chama API externa: nao | risco: alto | recomendacao: revisar antes
- `lookup-cnpj` — categoria: Outros | usa service_role: indireto (via shared) | usa secret externo: sim (`CNPJ_WS_TOKEN`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: revisar antes
- `prospecting-search` — categoria: Outros | usa service_role: nao (anon key) | usa secret externo: nao | verify_jwt=false: nao | chama API externa: sim (consulta CNPJ) | risco: medio | recomendacao: revisar antes

### Bloqueadas nesta fase (sem deploy)

#### ERP / Projedata / Iniflex (bloquear)

- `erp-import-companies` — categoria: ERP | usa service_role: sim | usa secret externo: sim | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `erp-import-contacts` — categoria: ERP | usa service_role: sim | usa secret externo: sim | verify_jwt=false: nao | chama API externa: sim | risco: alto | recomendacao: bloquear
- `erp-import-orders` — categoria: ERP | usa service_role: sim | usa secret externo: sim | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `erp-import-products` — categoria: ERP | usa service_role: sim | usa secret externo: sim | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `erp-import-products-staging` — categoria: ERP | usa service_role: sim | usa secret externo: sim (`INIFLEX_*`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `erp-promote-products` — categoria: ERP | usa service_role: sim | usa secret externo: sim | verify_jwt=false: sim | chama API externa: indireta | risco: alto | recomendacao: bloquear
- `process-company-sync` — categoria: ERP/jobs | usa service_role: sim | usa secret externo: sim | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `process-product-sync` — categoria: ERP/jobs | usa service_role: sim | usa secret externo: sim | verify_jwt=false: nao | chama API externa: sim | risco: alto | recomendacao: bloquear
- `process-order-sync` — categoria: ERP/jobs | usa service_role: sim | usa secret externo: sim | verify_jwt=false: nao | chama API externa: sim | risco: alto | recomendacao: bloquear
- `process-attribute-sync` — categoria: ERP/jobs | usa service_role: sim | usa secret externo: sim | verify_jwt=false: nao | chama API externa: sim | risco: alto | recomendacao: bloquear
- `validate-company-sync` — categoria: ERP/validacao | usa service_role: sim | usa secret externo: potencial | verify_jwt=false: nao | chama API externa: potencial | risco: alto | recomendacao: bloquear
- `validate-product-sync` — categoria: ERP/validacao | usa service_role: sim | usa secret externo: potencial | verify_jwt=false: nao | chama API externa: potencial | risco: alto | recomendacao: bloquear
- `validate-order-sync` — categoria: ERP/validacao | usa service_role: sim | usa secret externo: potencial | verify_jwt=false: nao | chama API externa: potencial | risco: alto | recomendacao: bloquear

#### WhatsApp / Z-API (bloquear)

- `zapi-send-message` — categoria: WhatsApp | usa service_role: parcial | usa secret externo: sim (`ZAPI_CLIENT_TOKEN`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `zapi-webhook` — categoria: WhatsApp | usa service_role: sim | usa secret externo: potencial | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `zapi-instance-status` — categoria: WhatsApp | usa service_role: sim | usa secret externo: sim (`ZAPI_CLIENT_TOKEN`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `zapi-get-qrcode` — categoria: WhatsApp | usa service_role: sim | usa secret externo: sim (`ZAPI_CLIENT_TOKEN`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `execute-automation` — categoria: Jobs/automacao | usa service_role: sim | usa secret externo: sim (`ZAPI_CLIENT_TOKEN`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear

#### E-mail / Resend (bloquear)

- `send-email` — categoria: E-mail | usa service_role: sim | usa secret externo: sim (`RESEND_API_KEY`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `send-bulk-email` — categoria: E-mail | usa service_role: sim | usa secret externo: sim (`RESEND_API_KEY`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `process-scheduled-emails` — categoria: E-mail/jobs | usa service_role: sim | usa secret externo: sim (`RESEND_API_KEY`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear
- `process-task-reminders` — categoria: E-mail/jobs | usa service_role: sim | usa secret externo: sim (`RESEND_API_KEY`) | verify_jwt=false: sim | chama API externa: sim | risco: alto | recomendacao: bloquear

#### Google Calendar (bloquear)

- `google-calendar-oauth` — categoria: Google Calendar | usa service_role: sim | usa secret externo: sim (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | verify_jwt=false: nao | chama API externa: sim | risco: alto | recomendacao: bloquear
- `google-calendar-sync` — categoria: Google Calendar | usa service_role: sim | usa secret externo: sim (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | verify_jwt=false: nao | chama API externa: sim | risco: alto | recomendacao: bloquear
- `google-calendar-webhook` — categoria: Google Calendar | usa service_role: sim | usa secret externo: sim (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | verify_jwt=false: nao | chama API externa: sim | risco: alto | recomendacao: bloquear

#### IA / Lovable AI (bloquear)

- `ai-assistant` — categoria: IA/Lovable AI | usa service_role: sim | usa secret externo: sim (`LOVABLE_API_KEY`) | verify_jwt=false: sim | chama API externa: sim (`ai.gateway.lovable.dev`) | risco: alto | recomendacao: bloquear
- `analyze-whatsapp-conversation` — categoria: IA/Lovable AI | usa service_role: sim | usa secret externo: sim (`LOVABLE_API_KEY`) | verify_jwt=false: sim | chama API externa: sim (`ai.gateway.lovable.dev`) | risco: alto | recomendacao: bloquear
- `validate-ncm-semantic` — categoria: IA/Lovable AI | usa service_role: nao | usa secret externo: sim (`LOVABLE_API_KEY`) | verify_jwt=false: sim | chama API externa: sim (`ai.gateway.lovable.dev`) | risco: alto | recomendacao: bloquear
- `lookup-ncm-online` — categoria: IA/Lovable AI | usa service_role: sim | usa secret externo: sim (`LOVABLE_API_KEY`) | verify_jwt=false: sim | chama API externa: sim (`ai.gateway.lovable.dev`) | risco: alto | recomendacao: bloquear

## 6) Matriz resumo por funcao (controle rapido)

- Total de funcoes inventariadas: **50**
- Candidatas Onda 0: **2**
- Onda 1: **9**
- Onda 2: **4**
- Onda 3: **6**
- Bloqueadas nesta fase: **29**

## 7) Criterios para permitir deploy em staging

- Funcao classificada como `liberar para deploy staging` ou `revisar antes` com aprovacao formal.
- Sem dependencia de integracao externa bloqueada nesta fase.
- Sem uso de secret real de producao.
- Teste com payload sintetico e massa de dados de staging.
- Logs habilitados sem exposicao de dados sensiveis.
- Idempotencia validada para funcoes com escrita.
- Plano de rollback definido por funcao.

## 8) Criterios de bloqueio

- Chama integracao externa bloqueada (ERP, Z-API, Resend, Google Calendar, IA).
- Exige secret real ainda nao provisionado em ambiente seguro.
- Possui `verify_jwt=false` e efeito destrutivo sem controle adicional de autenticacao.
- Impacto comercial direto sem massa sintetica (ex.: aprovacao/comunicacao real).
- Classificacao de risco alto sem mitigacao documentada.

## 9) Checklist antes de deploy

1. Confirmar branch e commit de referencia.
2. Revisar classificacao de risco da funcao alvo.
3. Confirmar que a funcao nao esta na lista bloqueada.
4. Confirmar secrets de staging (nao producao) previamente provisionados.
5. Confirmar politica de autenticacao/autorizacao.
6. Definir criterio de sucesso e criterio de rollback.
7. Preparar payload de smoke test sintetico.
8. Validar observabilidade (logs/metricas minimas).
9. Executar deploy apenas da funcao da onda atual (quando fase de execucao iniciar).
10. Registrar resultado no diario de migracao.

## 10) Comandos para uso futuro (nao executar agora)

- `npx supabase functions list`
- `npx supabase functions deploy <nome-da-funcao>`
- `npx supabase secrets list`

## 11) Plano de rollback para Edge Functions

- Rollback tatico por funcao:
  1. interromper novas chamadas no gateway/cliente;
  2. fazer redeploy da versao anterior estavel;
  3. revogar/rotacionar secret de staging envolvido se houver suspeita;
  4. revisar logs e eventos para confirmar estabilizacao.
- Rollback por onda:
  1. congelar deploy da onda seguinte;
  2. reverter todas as funcoes da onda corrente para versao anterior;
  3. reclassificar risco e atualizar plano antes de nova tentativa.

## 12) Proximos passos recomendados

1. Aprovar este plano de ondas (Engenharia + Produto + Seguranca).
2. Definir quais funcoes da Onda 0 entram no primeiro piloto.
3. Preparar checklist operacional por funcao (runbook curto).
4. Abrir Fase 10B para execucao controlada da Onda 0 (sem integrar blocos externos).
5. Reavaliar liberacao de ondas seguintes somente apos evidencias da Onda 0.

