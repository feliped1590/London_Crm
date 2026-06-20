# Fase 09 — Edge Functions e Secrets no Supabase Staging

## 1) Objetivo da fase

Realizar o inventário técnico das Edge Functions do projeto, classificar por domínio funcional e preparar um plano seguro de deploy futuro em staging, sem executar funções, sem publicar deploy e sem configurar secrets reais nesta etapa.

## 2) Premissas

- Fase 06 concluída: migrations aplicadas no Supabase Staging.
- Fase 07 concluída: schema validado.
- Fase 08 concluída: Storage e buckets documentados.
- Esta fase é somente inventário, classificação e planejamento.
- Não haverá deploy de Edge Functions nesta fase.
- Não haverá configuração de secrets reais nesta fase.
- Não haverá alteração de código, `config.toml` ou `.env`.

## 3) Inventário das Edge Functions em `supabase/functions`

Total identificado: **50 Edge Functions** (pastas com `index.ts`).

1. `ai-assistant`
2. `analyze-whatsapp-conversation`
3. `calcular-tributacao`
4. `create-user`
5. `credit-analysis`
6. `delete-user`
7. `enrich-companies-batch`
8. `enrich-company-single`
9. `erp-import-companies`
10. `erp-import-contacts`
11. `erp-import-orders`
12. `erp-import-products`
13. `erp-import-products-staging`
14. `erp-promote-products`
15. `execute-automation`
16. `generate-order-pdf`
17. `generate-proposal-pdf`
18. `generate-quick-quote-pdf`
19. `generate-report-pdf`
20. `generate-signed-url-secure`
21. `google-calendar-oauth`
22. `google-calendar-sync`
23. `google-calendar-webhook`
24. `import-companies-bulk`
25. `import-companies-from-file`
26. `import-ncm-tipi`
27. `import-products-csv`
28. `lookup-cnpj`
29. `lookup-ncm-online`
30. `process-attribute-sync`
31. `process-company-sync`
32. `process-order-sync`
33. `process-product-sync`
34. `process-scheduled-emails`
35. `process-task-reminders`
36. `proposal-approve`
37. `proposal-public-view`
38. `prospecting-save-lead`
39. `prospecting-search`
40. `send-bulk-email`
41. `send-email`
42. `update-user`
43. `validate-company-sync`
44. `validate-ncm-semantic`
45. `validate-order-sync`
46. `validate-product-sync`
47. `zapi-get-qrcode`
48. `zapi-instance-status`
49. `zapi-send-message`
50. `zapi-webhook`

## 4) Classificação por categoria

### ERP / Projedata / Iniflex

- `erp-import-companies`
- `erp-import-contacts`
- `erp-import-orders`
- `erp-import-products`
- `erp-import-products-staging`
- `erp-promote-products`
- `process-company-sync`
- `process-product-sync`
- `process-order-sync`
- `process-attribute-sync`
- `validate-company-sync`
- `validate-product-sync`
- `validate-order-sync`

### PDFs

- `generate-proposal-pdf`
- `generate-order-pdf`
- `generate-quick-quote-pdf`
- `generate-report-pdf`

### IA / Lovable AI

- `ai-assistant`
- `analyze-whatsapp-conversation`
- `validate-ncm-semantic`
- `lookup-ncm-online`

### E-mail / Resend

- `send-email`
- `send-bulk-email`
- `process-scheduled-emails`
- `process-task-reminders`

### WhatsApp / Z-API

- `zapi-send-message`
- `zapi-webhook`
- `zapi-instance-status`
- `zapi-get-qrcode`
- `execute-automation` (usa token Z-API em automações)

### Google Calendar

- `google-calendar-oauth`
- `google-calendar-sync`
- `google-calendar-webhook`

### Auth / usuários

- `create-user`
- `update-user`
- `delete-user`

### BI / relatórios

- `generate-report-pdf`
- `credit-analysis`

### Jobs / filas / agendamentos

- `process-scheduled-emails`
- `process-task-reminders`
- `execute-automation`
- `process-company-sync`
- `process-product-sync`
- `process-order-sync`
- `process-attribute-sync`

### Outros

- `generate-signed-url-secure`
- `proposal-public-view`
- `proposal-approve`
- `prospecting-search`
- `prospecting-save-lead`
- `lookup-cnpj`
- `import-products-csv`
- `import-companies-bulk`
- `import-companies-from-file`
- `import-ncm-tipi`
- `enrich-company-single`
- `enrich-companies-batch`
- `calcular-tributacao`

## 5) Lista de secrets necessárias por função

Observação: lista baseada em leitura estática (`Deno.env.get`) e uso inferido por integração.

### Núcleo Supabase (base comum)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Mapeamento por função (agrupado)

- **`ai-assistant`:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `ZAPI_CLIENT_TOKEN`
- **`analyze-whatsapp-conversation`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`
- **`validate-ncm-semantic`:** `LOVABLE_API_KEY`
- **`lookup-ncm-online`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`
- **`send-email`, `send-bulk-email`, `process-scheduled-emails`, `process-task-reminders`:** `RESEND_API_KEY`, `SUPABASE_URL`, (`SUPABASE_ANON_KEY` em parte do fluxo), `SUPABASE_SERVICE_ROLE_KEY`
- **`zapi-send-message`, `zapi-instance-status`, `zapi-get-qrcode`, `execute-automation`:** `ZAPI_CLIENT_TOKEN` + chaves Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` conforme fluxo)
- **`google-calendar-oauth`, `google-calendar-sync`, `google-calendar-webhook`:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **`process-company-sync`, `process-product-sync`, `process-attribute-sync`:** `PROJEDATA_API_URL`, `PROJEDATA_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (e `SUPABASE_ANON_KEY` em fluxos de leitura auxiliar)
- **`erp-import-products-staging`:** `INIFLEX_API_URL`, `INIFLEX_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **`erp-import-companies`, `erp-import-contacts`, `erp-import-orders`, `erp-import-products`, `erp-promote-products`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (com dependência indireta de secrets ERP no ecossistema `_shared`)
- **`create-user`, `update-user`, `delete-user`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- **`generate-proposal-pdf`, `generate-quick-quote-pdf`, `proposal-approve`, `proposal-public-view`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **`generate-order-pdf`, `generate-report-pdf`, `generate-signed-url-secure`, `calcular-tributacao`, `credit-analysis`:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **`enrich-company-single`, `enrich-companies-batch`, `prospecting-save-lead`, `import-products-csv`, `import-companies-bulk`, `import-companies-from-file`, `import-ncm-tipi`, `validate-product-sync`, `process-order-sync`:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **`validate-company-sync`, `validate-order-sync`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **`lookup-cnpj`:** sem secret explícito no `index.ts`; usa providers compartilhados com secrets em `_shared`, incluindo `CNPJ_WS_TOKEN` e parâmetros de cache como `CNPJ_CACHE_TTL_DAYS`
- **`prospecting-search`:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## 6) Funções que provavelmente exigem `SUPABASE_SERVICE_ROLE_KEY`

Critério: escrita administrativa, bypass de RLS, operações em lote, automações, ou integração entre sistemas.

- **Alta probabilidade (críticas):**
  - `create-user`, `update-user`, `delete-user`
  - `execute-automation`
  - `process-company-sync`, `process-product-sync`, `process-order-sync`, `process-attribute-sync`
  - `erp-import-companies`, `erp-import-contacts`, `erp-import-orders`, `erp-import-products`, `erp-import-products-staging`, `erp-promote-products`
  - `send-email`, `send-bulk-email`, `process-scheduled-emails`, `process-task-reminders`
  - `generate-order-pdf`, `generate-report-pdf`, `generate-proposal-pdf`, `generate-quick-quote-pdf`
  - `proposal-approve`, `proposal-public-view`
  - `zapi-webhook`, `zapi-instance-status`, `zapi-get-qrcode`
  - `validate-company-sync`, `validate-order-sync`, `validate-product-sync`

- **Média probabilidade (dependendo da política RLS):**
  - `enrich-company-single`, `enrich-companies-batch`, `prospecting-save-lead`, `import-products-csv`, `import-companies-bulk`, `import-companies-from-file`, `import-ncm-tipi`

## 7) Funções que dependem diretamente de `ai.gateway.lovable.dev`

- `ai-assistant`
- `analyze-whatsapp-conversation`
- `validate-ncm-semantic`
- `lookup-ncm-online`

## 8) Funções que geram links `.lovable.app`

- `process-task-reminders` (constrói URL substituindo domínio `*.supabase.co` para `.lovable.app`)

## 9) Funções com `verify_jwt = false` no `supabase/config.toml`

### Configuradas explicitamente como públicas (JWT desabilitado)

- `zapi-webhook`
- `zapi-send-message`
- `zapi-instance-status`
- `create-user`
- `delete-user`
- `send-email`
- `send-bulk-email`
- `process-scheduled-emails`
- `generate-proposal-pdf`
- `execute-automation`
- `generate-report-pdf`
- `update-user`
- `process-task-reminders`
- `proposal-public-view`
- `proposal-approve`
- `ai-assistant`
- `analyze-whatsapp-conversation`
- `zapi-get-qrcode`
- `lookup-cnpj`
- `validate-ncm-semantic`
- `erp-import-companies`
- `erp-import-products`
- `erp-import-orders`
- `import-ncm-tipi`
- `lookup-ncm-online`
- `erp-import-products-staging`
- `erp-promote-products`
- `process-company-sync`

### Entradas no `config.toml` sem pasta correspondente em `supabase/functions` (drift de configuração)

- `iniflex-sync-contact`
- `iniflex-sync-company`
- `iniflex-list-correntistas`
- `iniflex-import-correntista`
- `iniflex-customer-lookup`
- `iniflex-sandbox-test`
- `sync-iniflex-clients`
- `sync-iniflex-products`
- `sync-iniflex-orders`
- `ai-copilot`

## 10) Riscos de segurança por função pública

- Endpoints com `verify_jwt=false` e potencial de escrita (`create-user`, `delete-user`, `execute-automation`) ampliam risco de abuso se não houver validação interna forte.
- Funções públicas com integrações externas (Resend, Z-API, ERP, Google) podem gerar custo indevido, spam, chamadas não autorizadas e vazamento operacional.
- Fluxos públicos com `SUPABASE_SERVICE_ROLE_KEY` elevam impacto de uma exploração (bypass de RLS e acesso privilegiado).
- Funções de IA públicas podem expor dados sensíveis em prompts/respostas e gerar custo elevado por uso indevido.
- Divergência entre `config.toml` e funções reais aumenta risco operacional (falsa sensação de cobertura de segurança).

## 11) Funções que podem ser testadas em staging sem risco

Priorizar testes com dados sintéticos e integrações desligadas/mockadas.

- **Leitura/consulta interna (baixo impacto):**
  - `generate-signed-url-secure` (com arquivos de teste)
  - `proposal-public-view` (com propostas de teste)
  - `prospecting-search` (somente massa sintética)
  - `lookup-cnpj` (preferencialmente com throttling e sem volume)
- **Validação sem efeito externo:**
  - `validate-company-sync`
  - `validate-product-sync`
  - `validate-order-sync`
  - `validate-ncm-semantic` (somente se chave de IA de sandbox estiver disponível e custo controlado)

## 12) Funções que NÃO devem ser testadas ainda

Até existir sandbox isolado para integrações e dados controlados:

- **Envio real de e-mail:** `send-email`, `send-bulk-email`, `process-scheduled-emails`, `process-task-reminders`
- **WhatsApp real:** `zapi-send-message`, `zapi-instance-status`, `zapi-get-qrcode`, `zapi-webhook`, `execute-automation`
- **Google Calendar real:** `google-calendar-oauth`, `google-calendar-sync`, `google-calendar-webhook`
- **IA / Lovable AI real:** `ai-assistant`, `analyze-whatsapp-conversation`, `validate-ncm-semantic`, `lookup-ncm-online`
- **ERP real (Projedata/Iniflex):** `process-company-sync`, `process-product-sync`, `process-order-sync`, `process-attribute-sync`, `erp-import-*`, `erp-promote-products`
- **Geração de pedido real / efeitos comerciais:** `proposal-approve`, automações com escrita (`execute-automation`)
- **Sincronização Projedata:** todos os fluxos `process-*sync` e `erp-*`
- **Jobs automáticos:** `process-scheduled-emails`, `process-task-reminders` e qualquer trigger/cron associado

## 13) Plano seguro para deploy posterior das Edge Functions no staging

1. **Congelar baseline**
   - Confirmar branch e hash de referência.
   - Validar que `supabase/config.toml` reflete apenas funções existentes.

2. **Definir matriz de secrets por ambiente**
   - Criar secrets de staging (nunca produção).
   - Substituir integrações reais por credenciais de sandbox/mock quando possível.

3. **Deploy por ondas (menor risco -> maior risco)**
   - Onda A: funções de leitura interna/validação.
   - Onda B: funções com escrita interna sem integração externa.
   - Onda C: funções com integrações externas em sandbox.
   - Onda D: jobs e automações agendadas (por último).

4. **Checklist mínimo por função antes de publicar**
   - Entrada validada (schema/params).
   - Autorização explícita (mesmo se `verify_jwt=false`, exigir token interno ou assinatura HMAC/webhook secret quando aplicável).
   - Observabilidade (logs com correlação e sem dados sensíveis).
   - Timeout e retry controlados.
   - Idempotência para chamadas repetidas.

5. **Validação pós-deploy por onda**
   - Smoke tests com payloads sintéticos.
   - Verificação de escrita no banco (somente tabelas de teste).
   - Auditoria de custo e taxa de erro.
   - Rollback rápido (despublicar função da onda, revogar secret de staging, bloquear origem).

## 14) Critérios de aceite

- Inventário completo das funções em `supabase/functions` concluído.
- Classificação por categoria concluída.
- Mapa de secrets por função/grupo funcional documentado sem expor valores.
- Lista de funções que exigem `SUPABASE_SERVICE_ROLE_KEY` documentada.
- Dependências de `ai.gateway.lovable.dev` e geração de `.lovable.app` identificadas.
- Funções com `verify_jwt=false` listadas, incluindo drift de configuração.
- Riscos de segurança por função pública documentados.
- Lista de funções seguras para teste e funções bloqueadas para teste definida.
- Plano seguro de deploy posterior em staging definido.

## 15) Próximos passos recomendados

1. Revisar e aprovar este inventário (Produto + Engenharia + Segurança).
2. Criar matriz de secrets de staging (somente nomes e responsáveis, sem valores em documento).
3. Corrigir drift de `config.toml` vs funções reais antes do primeiro deploy.
4. Definir política mínima de autenticação para funções públicas (token interno/webhook secret/rate limit).
5. Preparar roteiros de smoke test sintético por onda de deploy.
6. Iniciar Fase 10 com deploy controlado em ondas, começando pelas funções de menor risco.

