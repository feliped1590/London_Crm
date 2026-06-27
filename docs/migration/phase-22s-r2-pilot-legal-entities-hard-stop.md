# Fase 22S-R2 — Preparar modo piloto `legal_entities` com hard stop final

## 1. Objetivo

Preparar o executor para reconhecer modo piloto em `legal_entities`, validar autorizacoes e compatibilidade do write plan, e manter bloqueio absoluto de mutacao real.

## 2. Escopo

- adicionar suporte operacional as flags piloto;
- validar `legal_entities` como unica entidade piloto permitida;
- montar operacao piloto somente em memoria;
- gerar evidencia local da fase 22S-R2;
- acionar hard stop final obrigatorio.

## 3. Restricoes absolutas

- sem SQL de escrita;
- sem insert/update/upsert/delete;
- sem RPC de escrita;
- sem escrita em banco;
- sem migration;
- sem seed/cleanup/rollback;
- sem deploy/push;
- sem alteracao de staging/producao;
- sem ERP/API/webhook/n8n;
- sem processamento de filas;
- sem bypass (`--force`, `--skip-guards`, `--tables`, `--all`);
- sem incluir `profiles` na primeira rodada;
- sem incluir `company_contacts` como executavel.

## 4. Alteracoes feitas no executor

Arquivo alterado:

- `scripts/migration/phase-22k-r2-baseline-write.mjs`

Alteracoes principais:

- adicionadas constantes de piloto (`EXPECTED_PILOT_ENTITY` e `EXPECTED_PILOT_AUTHORIZATION`);
- adicionadas flags permitidas `--pilot-entity`, `--pilot-authorization`, `--execute-pilot-write`;
- adicionada validacao estrita da entidade piloto e da frase exata de autorizacao piloto;
- adicionada validacao de compatibilidade da entidade piloto com write plan e primeira rodada futura;
- adicionada montagem da operacao piloto em memoria (`upsert_pilot_planned`);
- adicionada geracao de evidencia local da fase 22S-R2;
- adicionada funcao `executePilotWrite()` com abort hard stop final;
- mantidos integralmente os guard rails anteriores (target, batch, autorizacao geral, whitelist/blacklist, `company_contacts` reference-only, `profiles` fora da primeira rodada, write real bloqueado).

## 5. Flags piloto adicionadas

- `--pilot-entity`: aceita somente `legal_entities`.
- `--pilot-authorization`: exige frase exata da 22R-R2.
- `--execute-pilot-write`: arma o fluxo piloto, mas nao executa mutacao real.

## 6. Autorizacoes exigidas

Autorizacao geral obrigatoria:

`AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

Autorizacao piloto obrigatoria:

`AUTORIZO A PRIMEIRA ESCRITA PILOTO DA BASELINE 22R-R2 SOMENTE EM legal_entities NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 7. Validacao da entidade piloto

Validacoes implementadas:

- `legal_entities` deve existir em `eligibleEntitiesForWrite` no write plan;
- `legal_entities` deve existir em `executableEntitiesRoundOne22Q` (primeira rodada futura);
- `profiles` deve permanecer fora da rodada executavel;
- `company_contacts` deve permanecer fora da rodada executavel;
- `legal_entities` nao pode estar na blacklist;
- write plan deve manter coerencia de ordem (sem dependencia indevida de `profiles`);
- contagem planejada de `legal_entities` e coletada quando disponivel;
- disponibilidade de rastreabilidade por batch/chaves temporarias e capturada na evidencia.

Falha em qualquer validacao critica gera `NO-GO`.

## 8. Operacao piloto montada em memoria

Estrutura adicionada:

```js
const pilotOperation = {
  entity: "legal_entities",
  action: "upsert_pilot_planned",
  executableIn22S: false,
  realExecutionBlocked: true,
  reason: "Hard stop final active; no database mutation allowed in 22S-R2",
};
```

Nenhuma chamada real de escrita foi adicionada.

## 9. Evidencia piloto gerada

Diretorio:

- `artifacts/migration/phase-22s-r2-pilot-legal-entities/`

Arquivo:

- `pilot-legal-entities-YYYYMMDD-HHMMSS.json`

Conteudo inclui:

- fase, timestamp, target, project name, batch, input, write plan;
- status da autorizacao geral e da autorizacao piloto;
- entidade piloto e status de validacao;
- contagem planejada de `legal_entities` e pista de chave temporaria quando disponivel;
- operacao piloto em memoria;
- confirmacoes de exclusao de `profiles` e `company_contacts`;
- confirmacoes de zero transacional, zero filas e zero chamadas externas;
- `realExecutionBlocked=true` e `noMutationExecuted=true`;
- decisao final de piloto e motivos.

## 10. Hard stop final

Hard stop obrigatorio configurado:

`EXECUÇÃO PILOTO REAL BLOQUEADA NA FASE 22S-R2. legal_entities validada como piloto, mas nenhuma mutação foi executada.`

## 11. Resultado do teste

O teste seguro da fase deve:

- executar preflight;
- validar write plan;
- validar `legal_entities` como piloto unico;
- montar operacao piloto somente em memoria;
- gerar evidencia 22S-R2;
- acionar hard stop final;
- manter zero mutacao em banco.

## 12. Lacunas restantes

- `preflight_decision` pode permanecer `PARCIAL` enquanto `company_contacts` existir apenas como reference-only no input;
- escrita real continua bloqueada por desenho;
- `profiles` segue fora da primeira rodada piloto.

## 13. Decisao final GO/PARCIAL/NO-GO

Critica de decisao desta fase:

- **GO**: flags piloto validadas, autorizacao piloto valida, piloto unico `legal_entities`, write plan valido, operacao em memoria, evidencia gerada, hard stop acionado, sem escrita.
- **PARCIAL**: lacuna nao critica de metadata sem impacto na seguranca, mantendo hard stop e sem escrita.
- **NO-GO**: qualquer mutacao real, bypass, entidade piloto invalida, falha de autorizacao piloto, quebra de hard stop, `profiles`/`company_contacts` executaveis.

## 14. Recomendacao da proxima fase

Avancar para fase de gate final de execucao real apenas com dupla confirmacao humana, mantendo validacoes estritas e escopo inicial exclusivamente em `legal_entities`.

## 15. Confirmacoes negativas obrigatorias

- SQL de escrita executado: nao
- escrita em banco: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- push: nao
- staging/prod alterados: nao
- modo write funcional executado: nao
- insert/update/upsert/delete executado: nao
- RPC de escrita executada: nao
- executor executou escrita: nao
