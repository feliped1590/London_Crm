# Fase 10C — Hardening da Edge Function `proposal-public-view`

## 1) Objetivo da fase

Documentar a avaliacao tecnica de seguranca e hardening da funcao `proposal-public-view`, sem alterar codigo e sem executar deploy, para decidir criterios de liberacao futura em staging.

## 2) Escopo da analise (somente leitura)

- Arquivo analisado: `supabase/functions/proposal-public-view/index.ts`
- Configuracao analisada: `supabase/config.toml`
- Sem execucao HTTP da funcao.
- Sem alteracao de codigo, secrets, config ou banco.

## 3) Confirmacoes tecnicas solicitadas

### 3.1 `verify_jwt=false`

- Confirmado em `supabase/config.toml`:
  - `[functions.proposal-public-view]`
  - `verify_jwt = false`

### 3.2 Uso de `SUPABASE_SERVICE_ROLE_KEY`

- Confirmado no codigo:
  - `const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;`
  - cliente Supabase criado com service role para todas as consultas da funcao.

### 3.3 Tabelas acessadas

- `proposal_access_logs` (insert e consultas para rate limit)
- `proposals` (busca por `approval_token`)
- `proposal_items` (itens da proposta)
- Tabelas relacionadas via join na consulta de `proposals`:
  - `companies`
  - `sales_reps`
  - `contacts`
  - `legal_entities`
  - `products` (via join de `proposal_items`)

### 3.4 Parametros recebidos

- Body JSON com parametro principal:
  - `token`

### 3.5 Tipo de validacao do identificador publico

- Usa token publico (`approval_token`) em texto recebido no body.
- Nao ha validacao de formato (UUID, hash, comprimento minimo, charset).
- A protecao principal e:
  - consulta por igualdade de token,
  - validacao de expiracao (`approval_token_expires_at`),
  - rate limit por IP para falhas.

### 3.6 Escopo por tenant/legal_entity/proposal_id

- Escopo de leitura e definido pelo token da proposta.
- Nao ha verificacao adicional explicita de tenant no endpoint.
- O retorno inclui `legal_entity_id` e dados de `legal_entities`.

### 3.7 Possivel vazamento de dados sensiveis

- Retorna dados amplos da proposta e entidades relacionadas:
  - empresa (`cnpj`, `address`, `email`, `phone`)
  - contato (`email`, `phone`)
  - entidade legal (`cnpj`, `address`, `email`, `phone`, `logo_url`)
  - itens e valores comerciais detalhados
- Como endpoint e publico (`verify_jwt=false`), o token vira o unico gate.

### 3.8 Protecao contra enumeracao

- Ha mitigacao parcial:
  - rate limit por IP (10 falhas/hora)
  - mensagens de erro semelhantes para token invalido/nao encontrado
- Limites atuais:
  - sem backoff progressivo
  - sem bloqueio por fingerprint adicional alem de IP
  - sem limite explicito para sucesso por token

### 3.9 Logs e auditoria

- Existe auditoria funcional em `proposal_access_logs`.
- Logs de console incluem prefixo de token (`token.substring(0, 8)`), o que reduz exposicao do token completo.
- Nao ha evidencia de mascaramento adicional para outros campos em logs de erro.

### 3.10 Rate limit ou protecao equivalente

- Sim, implementado por IP:
  - janela: 1 hora
  - limite: 10 falhas
- Considerado basico, mas positivo como controle inicial.

### 3.11 Retorno excessivo de dados ao publico

- Sim, potencialmente acima do minimo necessario para visualizacao publica.
- O uso de service role + payload amplo aumenta impacto em caso de abuso de token.

## 4) Classificacao de risco atual

- **Risco atual: ALTO** (nao classificado como critico nesta leitura estatica).

Justificativa:
- endpoint publico (`verify_jwt=false`);
- uso de `SUPABASE_SERVICE_ROLE_KEY`;
- superficie de dados relativamente ampla no retorno;
- controle de acesso centrado em token publico sem validacao estrutural adicional.

## 5) Opcoes de hardening recomendadas

### 5.1 Manter publica com token assinado (recomendado)

- Substituir token opaco simples por token assinado com:
  - `proposal_id`,
  - `exp` curto,
  - `aud` especifica,
  - assinatura verificavel.
- Beneficio: reduz risco de token forjado/manipulado e melhora governanca de expiracao.

### 5.2 Usar URL assinada com expiracao curta

- Distribuir link de acesso com exp curta e revogacao clara.
- Beneficio: janela de exposicao menor.

### 5.3 Separar funcao publica de funcao administrativa

- Funcao publica: apenas leitura minima para aprovacao.
- Fluxos administrativos: endpoint separado, autenticado com JWT interno.

### 5.4 Reduzir dependencia de service role

- Avaliar uso de chave anon + RLS orientada a token aprovado, quando possivel.
- Onde service role for inevitavel, restringir campos e operacoes.

### 5.5 Validacao adicional de escopo

- Amarrar token a `proposal_id` + `legal_entity_id` + estado esperado.
- Rejeitar combinacoes inconsistentes e tokens com formato invalido.

### 5.6 Limitar campos retornados

- Retornar somente campos necessarios para visualizacao/aprovacao publica.
- Evitar dados pessoais e comerciais nao essenciais.

### 5.7 Endurecer expiracao e revogacao

- Definir TTL estrito para token/link.
- Garantir revogacao imediata apos uso (quando aplicavel).

### 5.8 Auditoria minima obrigatoria

- Manter `proposal_access_logs` com:
  - timestamp,
  - acao,
  - status,
  - ip/fingerprint,
  - proposta alvo.
- Garantir retencao e monitoramento de eventos anormais.

### 5.9 Evoluir rate limiting

- Adicionar backoff progressivo, janela deslizante e limite por token + IP.
- Considerar protecao adicional no edge/gateway (WAF/rate-limit global).

## 6) Criterios para permitir deploy futuro

1. Revisao de seguranca aprovada para endpoint publico.
2. Reducao comprovada de campos retornados ao minimo necessario.
3. Estrategia de token assinada/expiravel aprovada.
4. Politica de expiracao/revogacao definida e documentada.
5. Rate limit reforcado alem do baseline atual.
6. Auditoria e observabilidade validadas.
7. Evidencia de que nao ha dependencia de integracoes externas bloqueadas.

## 7) Criterios de bloqueio

- Manter `verify_jwt=false` + service role sem hardening adicional.
- Persistir retorno amplo de PII/dados comerciais.
- Nao existir politica clara de expiracao/revogacao de token.
- Nao haver controles anti-enumeracao suficientes.
- Ausencia de trilha de auditoria minima operacional.

## 8) Recomendacao final

- **Nao liberar deploy da `proposal-public-view` ate implementar hardening minimo recomendado.**
- Prioridade imediata:
  1. minimizar payload publico,
  2. endurecer modelo de token/expiracao,
  3. revisar necessidade de service role no endpoint publico.

Com a postura atual (publica + service role + retorno amplo), a funcao deve permanecer bloqueada para as proximas ondas.

