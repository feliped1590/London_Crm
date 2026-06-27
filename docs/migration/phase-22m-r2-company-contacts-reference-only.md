# Fase 22M-R2 — Ajuste explicito de `company_contacts` como reference-only no preflight

## 1. Objetivo

Ajustar o preflight da baseline 22K-R2 para tratar `company_contacts` como entidade de referencia de input (legada/derivada), sem habilitar escrita funcional.

## 2. Escopo

- pre-check de repositorio e alinhamento de branch;
- leitura dos documentos 22H, 22I, 22J, 22K, 22L e do input real `latest.json`;
- ajuste do executor `scripts/migration/phase-22k-r2-baseline-write.mjs`;
- reexecucao do preflight com o mesmo input real;
- registro da evidencia e decisao desta fase.

## 3. Restricoes absolutas

Mantidas integralmente nesta fase:

- sem SQL de escrita;
- sem escrita em banco;
- sem migration;
- sem seed/cleanup/rollback;
- sem deploy/push;
- sem alteracao de staging/producao;
- sem ERP/API/webhook/n8n;
- sem processamento de filas;
- sem habilitar modo write funcional.

## 4. Motivo do NO-GO anterior

Na 22L-R2 o preflight retornou `NO-GO` porque `company_contacts` aparecia no input real em `baseline_entities` e era tratada como entidade bloqueada absoluta no executor.

## 5. Decisao tecnica adotada

Foi implementada separacao explicita entre:

- whitelist de futura escrita (`ALLOWED_ENTITIES`);
- blacklist absoluta (`BLOCKED_ENTITIES`);
- entidades aceitas somente como referencia de input (`INPUT_REFERENCE_ONLY_ENTITIES`), com:

```js
const INPUT_REFERENCE_ONLY_ENTITIES = new Set([
  "company_contacts",
]);
```

Regras aplicadas:

- `company_contacts` nao entra na whitelist de escrita;
- `company_contacts` nao e liberada para insert/update/upsert/delete;
- vinculo operacional permanece por `contacts.company_id`;
- presenca de `company_contacts` em metadados do input gera `PARCIAL` (lacuna/aviso), nao `NO-GO` automatico;
- se `company_contacts` aparecer em campos de plano de escrita, gera `NO-GO`.

## 6. Diferenca entre entidade permitida, proibida e reference-only

- **permitida para futura escrita**: entidade da whitelist (`ALLOWED_ENTITIES`);
- **proibida absoluta**: entidade da blacklist (`BLOCKED_ENTITIES`), sempre `NO-GO`;
- **reference-only**: entidade aceitavel apenas como metadado/diagnostico de input (`INPUT_REFERENCE_ONLY_ENTITIES`), sempre nao gravavel.

## 7. Tratamento de `company_contacts`

No executor 22K-R2:

- `company_contacts` e classificada em `referenceOnlyEntitiesFound`;
- `company_contacts` entra em `notWritableEntities`;
- `companyContactsWritable` e fixado em `false`;
- `companyContactsLinkStrategy` e fixado em `"contacts.company_id"`;
- foi adicionada verificacao de campos de plano de escrita (`writePlan`, `operations`, `inserts`, `upserts`, `deletes`, `sql`, `mutations`, `tablesToWrite`, `entitiesToWrite`);
- se qualquer um desses campos trouxer `company_contacts`, a decisao vira `NO-GO`.

## 8. Comando executado

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs --expected-target nsnmlleplpzsefzkuxlb --batch baseline_22f_r2_restore_test_qualyvac --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json --write
```

## 9. Resultado do novo preflight

- decisao: `PARCIAL`;
- target: validado;
- batch: validado;
- autorizacao: validada;
- input real: valido e parseado;
- entidades bloqueadas absolutas encontradas: nenhuma;
- `company_contacts` encontrada apenas como reference-only;
- nenhum plano de escrita para `company_contacts` detectado;
- write funcional permanece desabilitado.

## 10. Evidencia JSON gerada

- `artifacts/migration/phase-22k-r2-baseline-write/preflight-20260626-222729.json`

Campos adicionados/validados na evidencia:

- `referenceOnlyEntitiesFound`;
- `notWritableEntities`;
- `companyContactsHandling`;
- `companyContactsWritable: false`;
- `companyContactsLinkStrategy: "contacts.company_id"`;
- `decision` e `reasons`.

## 11. Lacunas restantes

- presenca de entidade reference-only no payload continua sendo lacuna nao critica;
- ainda nao existe write funcional (intencional nesta trilha);
- politica de input segue dependente de metadados do dry-run e de validacoes defensivas por chave conhecida.

## 12. Decisao final GO/PARCIAL/NO-GO

**PARCIAL**

Justificativa:

- conflito 22L-R2 foi resolvido com tratamento seguro de `company_contacts` como reference-only;
- nao houve indicio de plano de escrita para `company_contacts`;
- write permaneceu desabilitado;
- persiste lacuna nao critica por haver entidade nao gravavel no payload informativo.

## 13. Recomendacao da proxima fase

Fase 22N-R2 (sem escrita):

- consolidar checklist final de liberacao para futura fase de write controlado;
- manter `company_contacts` exclusivamente como reference-only;
- formalizar criterio objetivo para promover `PARCIAL` para `GO` quando o input vier sem entidades reference-only ou com sinalizacao de compatibilidade explicita.

## 14. Confirmacoes negativas obrigatorias

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
- modo write funcional adicionado: nao
- insert/update/upsert/delete implementado: nao
- executor executou escrita: nao
