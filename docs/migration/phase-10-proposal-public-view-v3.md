# Fase 10 — proposal-public-view v3

## 1) Contexto

A entrega da Fase 10 consolida a evolucao da funcao publica `proposal-public-view` com foco em:

- seguranca da superficie publica;
- preservacao de anti-enumeracao;
- payload publico minimo e sem vazamento de dados internos;
- validacao correta do limite de acesso por link publico.

Ambiente de referencia:

- Project ref staging: `cansbrrwrprcycjvgvqm`.

## 2) Linha do tempo resumida (10P a 10Y)

### 10P — teste positivo sintetico inicial

- Fluxo positivo com dados sinteticos validado.
- Token valido retornou `200`.
- Payload publico permaneceu seguro.
- Massa sintetica criada e limpa.

### 10Q — validacao de estados do link

- Cenarios validados com erro generico:
  - revogado;
  - expirado;
  - status nao ativo;
  - limite atingido;
  - token inexistente.
- Anti-enumeracao preservada.
- Ressalva encontrada: `access_count` nao incrementava em acesso valido.

### 10R — correcao do incremento

- Correcao aplicada na funcao.
- Incremento basico validado (`0 -> 1`).
- Links invalidos nao incrementam.
- Payload publico preservado.

### 10S — bloqueio por rate limit no teste sequencial

- Teste sequencial completo foi bloqueado por `429`.
- Criterio confirmado:
  - janela de 1 hora;
  - bloqueio em `>= 10` falhas por IP;
  - rate limit executa antes da validacao de token.

### 10T — validacao sequencial de `max_access_count=3`

- Limpeza seletiva e rastreavel de logs sinteticos falhos no staging.
- Sequencia confirmada:
  - 1a chamada: `200`, contador `0 -> 1`;
  - 2a chamada: `200`, contador `1 -> 2`;
  - 3a chamada: `200`, contador `2 -> 3`;
  - 4a chamada: `404` generico, contador `3 -> 3`.
- Semantica confirmada: `max_access_count=3` permite exatamente 3 acessos validos.

### 10U — revisao de diff e commit controlado

- Diff aprovado.
- Commit realizado:
  - `5350606d fix: increment proposal public link access count`.

### 10V — push da branch de feature

- Push da branch de feature realizado com sucesso para `origin`.

### 10W — auditoria final do PR

- Auditoria local aprovada.
- Ressalva operacional registrada por falta de autenticacao do `gh` no ambiente do agente.

### 10X — merge

- Tentativa de merge via CLI bloqueada por falta de auth.
- Merge executado manualmente no GitHub UI.

### 10Y — pos-merge local

- `main` local sincronizada com `origin/main`.
- Confirmada presenca do merge commit e do commit funcional:
  - `4fda0045` (merge do PR `#37`);
  - `5350606d`.

## 3) Correcao implementada na v3

Ajustes aplicados em `supabase/functions/proposal-public-view/index.ts`:

- incremento de `proposal_public_links.access_count` apenas em acesso valido;
- atualizacao de `last_accessed_at` apenas no sucesso;
- update condicional por `id + access_count` (padrao otimista);
- retry curto em disputa concorrente;
- bloqueio generico quando o limite e atingido durante a reserva;
- payload publico mantido sem alteracao de contrato externo.

## 4) Seguranca confirmada

Foi confirmado que o payload publico nao expoe:

- `tenant_id`;
- `user_id`;
- `access_count`;
- `max_access_count`;
- logs internos;
- stack trace;
- auth info;
- dados de outras propostas.

Tambem foi confirmado:

- anti-enumeracao preservada;
- mensagens publicas genericas preservadas;
- rate limit nao relaxado;
- nenhum bypass de seguranca introduzido;
- nenhuma alteracao de RLS/policies;
- nenhuma alteracao de schema/migrations;
- nenhuma alteracao de UI.

## 5) Evidencias principais

- Funcao: `proposal-public-view` em `ACTIVE` `VERSION=3`.
- PR integrado: `#37`.
- Merge commit em `main`: `4fda0045`.
- Commit funcional integrado: `5350606d`.
- Arquivo alterado na entrega:
  - `supabase/functions/proposal-public-view/index.ts`.
- Massa sintetica removida ao fim das fases de validacao.
- `main` e `origin/main` sincronizadas no encerramento.

## 6) Estado final

- `git status` limpo.
- Branch remota de origem mantida:
  - `origin/phase-10p-teste-positivo-sintetico-proposal-public-view-v2`.
- Sem deploy na fase 10Y.
- Sem operacao em banco na fase 10Y.

## 7) Pendencias e recomendacoes

1. Decidir se a branch de feature remota sera removida apos o encerramento formal.
2. Decidir se havera deploy controlado adicional a partir da `main`, caso o processo interno exija redeploy formal.
3. Manter monitoramento de `proposal_access_logs` apos uso real.
4. Considerar evolucao futura para RPC transacional se houver necessidade de concorrencia mais forte no controle de acesso.

