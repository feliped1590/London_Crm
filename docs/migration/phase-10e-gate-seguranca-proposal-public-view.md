# Fase 10E — Gate de Seguranca da `proposal-public-view`

## 1) Objetivo

Realizar revisao estatica de seguranca da funcao `proposal-public-view` apos o hardening da Fase 10D, sem deploy e sem alteracao funcional, para decidir liberacao para futura Fase 10F.

## 2) Escopo revisado

- `supabase/functions/proposal-public-view/index.ts`
- `supabase/config.toml`
- `docs/migration/phase-10c-hardening-proposal-public-view.md`
- `docs/migration/phase-10d-hardening-proposal-public-view-code.md`

## 3) Verificacoes estaticas executadas

1. `git diff main...HEAD`
   - Resultado: sem diferenca (branch de gate criada a partir do estado atual da `main`).
2. `npx supabase functions list`
   - Resultado: funcao ativa listada no projeto linkado: `generate-signed-url-secure`.
3. `deno check supabase/functions/proposal-public-view/index.ts`
   - Resultado: nao executado por indisponibilidade local do binario `deno` (comando nao encontrado).

## 4) Checklist de seguranca (pos-hardening)

### 4.1 Itens aprovados

- [x] Aceita apenas `POST` e `OPTIONS`.
- [x] Rejeita metodos indevidos (`405` + header `Allow`).
- [x] Valida token antes de consultar o banco.
- [x] Valida tamanho minimo e maximo do token.
- [x] Valida formato do token (regex).
- [x] Nao loga token completo (usa token mascarado/prefixo curto).
- [x] Retorna erro generico para token invalido/inexistente/expirado (`Link inválido ou expirado`).
- [x] Valida `approval_token_expires_at`.
- [x] Reduziu payload publico em relacao ao estado anterior.
- [x] Nao retorna stack trace no response.
- [x] Mantem CORS controlado para `POST`/`OPTIONS`.
- [x] Mantem rate limit basico (10 falhas/h por IP).
- [x] Nao chama API externa.
- [x] Nao envia e-mail.
- [x] Nao chama WhatsApp.
- [x] Nao chama ERP.
- [x] Nao chama Google Calendar.
- [x] Nao chama IA/Lovable AI.

### 4.2 Itens reprovados / condicionais

- [ ] Endpoint ainda publico com `verify_jwt=false` (risco residual relevante).
- [ ] Funcao ainda usa `SUPABASE_SERVICE_ROLE_KEY` para leitura (aceitavel apenas temporariamente, com gate forte).
- [ ] Rate limit continua basico; ainda sem controles avancados de abuso (ex.: backoff/fingerprint).

## 5) Avaliacao de `SUPABASE_SERVICE_ROLE_KEY`

- **Status:** uso mantido e restrito ao fluxo da funcao.
- **Leitura de seguranca:** aceitavel somente de forma temporaria no contexto atual, dado que:
  - a funcao e publica;
  - existe validacao de token + expiracao + anti-enumeracao + payload reduzido.
- **Risco remanescente:** se token valido vazar, o service role amplia impacto potencial.

## 6) Avaliacao do payload publico

- **Status:** significativamente mais restrito que antes.
- **Campos sensiveis removidos:** CNPJ, e-mail, telefone, endereco, IDs secundarios e metadados internos que nao eram essenciais.
- **Veredito do gate:** payload atual esta **aceitavel para avancar com deploy controlado**, desde que o gate operacional da Fase 10F seja seguido.

## 7) Analise de abuso (enumeracao, brute force, scraping)

- Enumeracao evidente: **nao identificada** (mensagem generica + validacao previa + rate limit).
- Brute force: **parcialmente mitigado** por rate limit por IP.
- Abuso residual: **existe** devido a natureza publica do endpoint e ausencia de controles avancados no edge.

## 8) Riscos remanescentes

1. Endpoint publico com `verify_jwt=false`.
2. Dependencia de `SUPABASE_SERVICE_ROLE_KEY`.
3. Rate limit basico sem camada adicional de protecao global.
4. Necessidade de monitoramento continuo de `proposal_access_logs`.

## 9) Decisao final do gate (Fase 10E)

- **Sem risco critico identificado nesta revisao estatica.**
- **Decisao:** liberar para **Fase 10F de deploy controlado**, com condicoes obrigatorias.

## 10) Criterios obrigatorios para deploy (Fase 10F)

1. Deploy exclusivo da `proposal-public-view` (sem bundle de outras funcoes).
2. Janela controlada e monitorada (log/auditoria ativa durante e apos deploy).
3. Verificacao imediata de telemetria de erro e taxa de `invalid_token`/`rate_limited`.
4. Rollback pronto (comando e responsavel definidos previamente).
5. Sem alteracao de `config.toml`, sem novos secrets e sem testes com dados reais sensiveis.

## 11) Recomendacao

- Prosseguir para Fase 10F com deploy controlado e checklist operacional estrito.
- Tratar em fase posterior:
  - endurecimento adicional anti-abuso,
  - avaliacao de migracao para modelo com menor privilegio (reduzir dependencia de service role).

