# Fase 18 - Checklist de execucao controlada do piloto (sem execucao)

## 1. Objetivo

Definir um checklist operacional completo para a futura execucao controlada do piloto de migracao/reconciliacao (Fase 19), sem executar scripts nesta fase.

## 2. Contexto

- Fase 17A concluida e publicada em `origin/main`.
- Commit de referencia: `14368910` (`chore: add pilot seed scripts with safety gates`).
- Nesta fase nao houve execucao de SQL, deploy ou qualquer operacao em banco.

## 3. Scripts envolvidos

- `scripts/pilot-seed/seed-pilot-dataset.sql`
- `scripts/pilot-seed/validate-pilot-dataset.sql`
- `scripts/pilot-seed/reconcile-pilot-dataset.sql`
- `scripts/pilot-seed/cleanup-pilot-dataset.sql`
- `scripts/pilot-seed/README.md`

## 4. Ambiente autorizado

- Nome esperado: `crm-qualyvac-restore-test`
- Project ref esperado: `nsnmlleplpzsefzkuxlb`

## 5. Ambientes proibidos

- Staging (proibido): `cansbrrwrprcycjvgvqm`
- Producao: qualquer ambiente/ref nao explicitamente autorizado

## 6. Regras de seguranca

- Nao executar scripts fora da janela aprovada por Felipe Duarte.
- Nao executar scripts em staging/producao.
- Nao usar `service_role` nesta trilha.
- Nao inserir dados reais ou dados pessoais reais.
- Nao disparar integracoes reais (ERP/PDF/CNPJ/n8n/webhooks).
- Nao alterar migrations, schema, RLS/policies, Edge Functions ou UI.
- Nao versionar dumps, manifests sensiveis, `.env`, tokens, secrets ou chaves.

## 7. Settings obrigatorias (mesma sessao)

Antes de qualquer execucao futura do seed:

```sql
set app.pilot_target_ref = 'nsnmlleplpzsefzkuxlb';
set app.pilot_target_name = 'crm-qualyvac-restore-test';
set app.pilot_execution_approved = 'YES';
```

Para cleanup, exigir adicionalmente:

```sql
set app.pilot_cleanup_execute = 'YES';
```

Regras de abort por setting:

- abortar se qualquer setting estiver ausente ou nula;
- abortar se `app.pilot_target_ref` divergir do valor esperado;
- abortar se `app.pilot_target_ref = 'cansbrrwrprcycjvgvqm'`;
- abortar se `app.pilot_target_name` divergir do esperado;
- abortar se `app.pilot_execution_approved <> 'YES'`;
- no cleanup, manter preview quando `app.pilot_cleanup_execute <> 'YES'`.

## 8. Hard-stop externo antes de qualquer SQL

Antes da Fase 19, validar obrigatoriamente:

1. project ref conectado e confirmado como `nsnmlleplpzsefzkuxlb`;
2. nome do projeto confirmado como `crm-qualyvac-restore-test`;
3. branch/repo limpo e alinhado;
4. conexao nao aponta para staging (`cansbrrwrprcycjvgvqm`);
5. conexao nao aponta para producao;
6. aprovacao explicita de Felipe Duarte para a janela;
7. nenhum deploy em paralelo;
8. integracoes reais desabilitadas/mitigadas para o piloto.

Se qualquer item falhar: **ABORTAR**.

## 9. Ordem futura de execucao (Fase 19)

1. Confirmar hard-stop externo.
2. Configurar settings obrigatorias na mesma sessao.
3. Executar `seed-pilot-dataset.sql`.
4. Executar `validate-pilot-dataset.sql`.
5. Executar `reconcile-pilot-dataset.sql`.
6. Avaliar resultados e divergencias.
7. Executar `cleanup-pilot-dataset.sql` somente se aprovado explicitamente por Felipe Duarte ou se houver necessidade de limpeza.
8. Registrar evidencias finais.

Observacoes:

- cleanup nao e automatico;
- cleanup exige aprovacao explicita e setting adicional.

## 10. Estrategia de sessao/settings

Risco tecnico conhecido:

- `supabase db query --file` pode abrir sessao nova a cada arquivo;
- settings locais podem nao persistir entre execucoes.

Estrategia recomendada para Fase 19:

- garantir que os `SET app.*` e a execucao de cada script ocorram no mesmo contexto de sessao;
- se necessario, usar wrapper SQL temporario por etapa (sem secret) contendo `SET ...` + `\i script.sql` equivalente do fluxo adotado;
- nao contornar esse risco com execucao ad hoc sem evidencias.

## 11. Comandos modelo sem secrets

Comandos de referencia (alto nivel):

- `supabase link --workdir <temp> --project-ref nsnmlleplpzsefzkuxlb`
- `supabase db query --workdir <temp> --linked --file scripts/pilot-seed/seed-pilot-dataset.sql`
- `supabase db query --workdir <temp> --linked --file scripts/pilot-seed/validate-pilot-dataset.sql`
- `supabase db query --workdir <temp> --linked --file scripts/pilot-seed/reconcile-pilot-dataset.sql`
- `supabase db query --workdir <temp> --linked --file scripts/pilot-seed/cleanup-pilot-dataset.sql`

Observacao: executar somente na Fase 19, dentro da janela aprovada, com hard-stop externo e settings garantidas.

## 12. Evidencias a coletar na Fase 19

- branch e commit local antes da execucao;
- `git status` antes e depois;
- project ref e nome do projeto alvo confirmados;
- comandos executados (sem expor secrets);
- resultado do seed;
- resultado do validate;
- resultado do reconcile;
- contagens por tabela principal;
- divergencias identificadas e classificadas;
- confirmacao de zero integracao externa disparada;
- confirmacao de zero dado real;
- confirmacao de staging/producao nao afetados;
- relatorio externo/manifesto fora do repositorio, se aplicavel.

## 13. Criterios de aprovacao (GO para executar Fase 19)

- scripts revisados e sem pendencias criticas;
- target unico e confirmado (`nsnmlleplpzsefzkuxlb`);
- estrategia de settings/sessao definida e verificavel;
- aprovacao explicita de Felipe Duarte registrada;
- conexao segura e ambiente isolado confirmados;
- cleanup controlado disponivel;
- sem risco ativo de integracao real.

## 14. Criterios de abort/reprovacao (NO-GO)

- target ambiguo ou nao confirmado;
- impossibilidade de garantir settings na mesma sessao;
- risco de atingir staging/producao;
- risco de disparar integracao real;
- divergencia estrutural entre scripts e ambiente;
- vazamento de secret/token em output/log;
- incerteza sobre cleanup seguro.

## 15. Cleanup controlado

- executar somente mediante aprovacao explicita;
- exigir `app.pilot_cleanup_execute = 'YES'`;
- executar preview e revisar contagens antes de deletar;
- confirmar que deletes estao restritos ao namespace/padroes do piloto;
- registrar evidencias do cleanup (quando aplicavel).

## 16. Riscos remanescentes

- dependencia de usuarios sinteticos preexistentes em `auth.users` para parte de `profiles/user_tenants`;
- `user_roles` fora de escopo nesta trilha (RBAC definitivo pendente);
- risco operacional se sessao/settings nao forem garantidas corretamente;
- necessidade de manter integracoes reais bloqueadas durante toda a janela.

## 17. Decisao da Fase 18

**PARCIAL**.

Justificativa:

- checklist operacional e hard-stops estao definidos;
- scripts estao prontos para execucao controlada;
- execucao da Fase 19 permanece condicionada a aprovacao explicita, validacao de sessao/settings e confirmacao final do ambiente.

## 18. Proximo passo recomendado

Abrir a Fase 19 como janela controlada de execucao, iniciando por:

1. hard-stop externo documentado;
2. prova de settings na mesma sessao;
3. seed -> validate -> reconcile;
4. cleanup apenas se aprovado explicitamente por Felipe Duarte.
