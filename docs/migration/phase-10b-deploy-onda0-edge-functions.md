# Fase 10B — Deploy Controlado da Onda 0 (Edge Functions)

## 1) Objetivo da fase

Executar deploy controlado das funcoes candidatas da Onda 0 no Supabase Staging, sem executar chamadas HTTP das funcoes e sem ativar integracoes externas bloqueadas.

## 2) Escopo e restricoes aplicadas

- Deploy considerado apenas para funcoes candidatas da Onda 0:
  - `generate-signed-url-secure`
  - `proposal-public-view`
- Integracoes externas continuam bloqueadas:
  - WhatsApp / Z-API
  - Resend / e-mail real
  - Google Calendar
  - IA / Lovable AI
  - ERP / Projedata / Iniflex real
- Nao houve alteracao de codigo, `supabase/config.toml`, migrations ou `.env`.
- Nao houve execucao funcional via HTTP apos deploy.

## 3) Analise pre-deploy das funcoes candidatas

### 3.1 `generate-signed-url-secure`

- Chama API externa: **nao**
- Envia e-mail / WhatsApp: **nao**
- Chama ERP / Google / IA: **nao**
- Dispara jobs automaticos: **nao**
- Autenticacao:
  - valida `Authorization: Bearer ...` com `SUPABASE_ANON_KEY` e `auth.getUser()`
  - usa `SUPABASE_SERVICE_ROLE_KEY` para operacoes de storage e auditoria
- Dependencia de secrets externos (fora Supabase): **nao**
- Risco: **baixo a medio** (usa service role, mas com gate de autenticacao e autorizacao)
- Decisao: **aprovada para deploy na Onda 0**

### 3.2 `proposal-public-view`

- Chama API externa: **nao**
- Envia e-mail / WhatsApp: **nao**
- Chama ERP / Google / IA: **nao**
- Dispara jobs automaticos: **nao**
- Autenticacao:
  - endpoint publico por token
  - usa `SUPABASE_SERVICE_ROLE_KEY`
  - em `supabase/config.toml`: `verify_jwt = false`
- Dependencia de secrets externos (fora Supabase): **nao**
- Risco: **alto para Onda 0** (exposicao publica + service role, mesmo com rate limit e token)
- Decisao: **bloqueada nesta execucao**

## 4) Verificacao de configuracao em `supabase/config.toml`

- `proposal-public-view`: possui bloco explicito com `verify_jwt = false`.
- `generate-signed-url-secure`: nao possui bloco explicito no arquivo, portanto segue comportamento padrao (nao marcado como `verify_jwt=false` neste `config.toml`).

## 5) Comandos executados

1. `git status --short --branch`
2. `git branch --show-current`
3. `git checkout -b phase-10b-deploy-onda0-edge-functions`
4. `npx supabase functions list`
5. `npx supabase functions deploy generate-signed-url-secure`

## 6) Resultado dos comandos de deploy

### 6.1 `npx supabase functions list`

- Execucao concluida sem erro.
- Lista retornada sem funcoes exibidas no output.

### 6.2 `npx supabase functions deploy generate-signed-url-secure`

- Execucao concluida com sucesso.
- Mensagem de resultado:
  - `Deployed Functions on project cansbrrwrprcycjvgvqm: generate-signed-url-secure`
- Aviso observado:
  - `WARNING: Docker is not running` (nao bloqueou deploy via CLI remoto).

### 6.3 Deploy **nao executado**

- `proposal-public-view` **nao foi deployada** por classificacao de risco alto para Onda 0.

## 7) Funcoes deployadas e nao deployadas

- **Deployada:**
  - `generate-signed-url-secure`

- **Nao deployada (bloqueada):**
  - `proposal-public-view`

## 8) Riscos e pendencias identificadas

- `proposal-public-view` permanece com perfil sensivel para Onda 0:
  - `verify_jwt=false` + uso de `SUPABASE_SERVICE_ROLE_KEY`.
- Necessario confirmar formalmente se o projeto alvo `cansbrrwrprcycjvgvqm` corresponde ao staging esperado desta migracao.
- Necessario definir controles adicionais para qualquer futura liberacao de endpoint publico com service role:
  - hardening de rate limit,
  - monitoramento/auditoria,
  - validacao de token/expiracao e politica de revogacao.

## 9) Proximos passos recomendados

1. Validar se o projeto Supabase alvo do deploy e o staging oficial desta fase.
2. Abrir subfase de hardening para `proposal-public-view` antes de deploy:
   - revisar modelo de autenticacao publica,
   - revisar superficie de dados retornados,
   - revisar controles anti-abuso.
3. Seguir com Onda 0 apenas com funcoes de baixo risco aprovadas.
4. Atualizar o plano da Fase 10 com evidencias desta execucao (deploy parcial da Onda 0).

