# Fase 19D-B - Plano operacional para habilitacao controlada de `hstore`

## 1. Objetivo

Definir o procedimento operacional seguro para eventual habilitacao de `hstore` no ambiente isolado de restore test, sem executar alteracoes nesta fase.

## 2. Contexto

- Fase 19B: tentativa controlada do seed falhou por dependencia de `hstore`.
- Fase 19C: scripts foram endurecidos e passaram a abortar tecnicamente sem `hstore`.
- Fase 19D-A: decisao tecnica documentada recomendando opcao A (habilitar `hstore` apenas no alvo isolado), pendente de aprovacao explicita.

## 3. Resultado da Fase 19B

- Erro principal: `function hstore(text, text) does not exist`.
- Contexto: trigger/função `public.enforce_uppercase_text()`.
- Hard-stop e target corretos; sem uso de staging/producao.
- Filas permaneceram zeradas.
- Contagens do namespace piloto permaneceram em zero.

## 4. Resultado da Fase 19C

- Seed, validate, reconcile e cleanup atualizados estaticamente.
- Enums ajustados para valores reais.
- Hard-stop tecnico adicionado para abortar quando `hstore` estiver ausente.
- Nenhuma alteracao de schema/migration foi aplicada.

## 5. Decisao documentada na Fase 19D-A

- Opcao recomendada: habilitar `hstore` somente no target isolado.
- Execucao permanece bloqueada ate aprovacao explicita de Felipe Duarte.

## 6. Ambiente autorizado

- Nome: `crm-qualyvac-restore-test`
- Project ref: `nsnmlleplpzsefzkuxlb`

## 7. Ambientes proibidos

- Staging: `cansbrrwrprcycjvgvqm`
- Producao: qualquer ref/ambiente diferente do autorizado

## 8. Hard-stop externo obrigatorio

Antes de qualquer execucao futura:

1. Confirmar target ref `nsnmlleplpzsefzkuxlb`.
2. Confirmar nome do projeto `crm-qualyvac-restore-test`.
3. Confirmar repo limpo e branch correta.
4. Confirmar staging/producao fora do escopo.
5. Confirmar aprovacao explicita de Felipe Duarte para executar.
6. Confirmar que nao sera executado seed/cleanup no mesmo passo.

Se qualquer item falhar: **abortar**.

## 9. Pre-checks read-only obrigatorios

Antes da eventual habilitacao:

- verificar `hstore_installed` (esperado atual: `false`);
- confirmar existencia de `public.enforce_uppercase_text()`;
- confirmar dependencia da funcao em `hstore`;
- confirmar triggers nas tabelas impactadas:
  - `carriers`, `companies`, `contacts`, `deals`, `order_items`, `orders`, `pipelines`, `products`, `tasks`;
- confirmar contagens piloto em zero;
- confirmar filas principais em zero:
  - `order_sync_queue`, `product_sync_queue`, `company_sync_queue`.

## 10. Comando proposto (sem secrets)

```sql
create extension if not exists hstore;
```

## 11. Forma segura de execucao futura

- Somente no target `nsnmlleplpzsefzkuxlb`.
- Somente apos aprovacao explicita de Felipe Duarte.
- Executar preferencialmente por arquivo SQL temporario fora do repositorio.
- Nao salvar secrets/tokens.
- Nao versionar artefatos temporarios.
- Nao combinar esta acao com seed/cleanup no mesmo comando.

## 12. Criterios de abort

Abortar se houver:

- target divergente;
- target igual a staging;
- qualquer sinal de producao;
- repositorio sujo;
- ausencia de aprovacao explicita;
- comando diferente do planejado;
- tentativa de executar seed junto;
- tentativa de cleanup.

## 13. Pos-checks read-only apos eventual execucao

Se opcao A for executada em fase futura:

1. Confirmar `hstore_installed = true`.
2. Confirmar que dependencia da funcao `enforce_uppercase_text()` passa a ser resolvivel com `hstore`.
3. Confirmar que nao houve alteracao de dados de negocio.
4. Confirmar filas de integracao ainda zeradas.
5. Confirmar staging/producao nao tocados.

## 14. Evidencias exigidas

- branch e `git status`;
- target ref e nome do projeto;
- comando executado (sem secrets);
- resultado antes/depois;
- relatorio externo fora do repositorio.

## 15. Riscos

- alteracao de extensao no target isolado;
- possivel diferenca entre restore-test e staging/producao;
- necessidade posterior de decidir se `hstore` deve integrar baseline tecnico formal do projeto.

## 16. Limites desta fase

- nao autoriza executar seed;
- nao autoriza alterar staging;
- nao autoriza alterar producao;
- nao autoriza criar migration;
- nao autoriza cleanup.

## 17. Decisao

Plano operacional pronto.  
Execucao permanece **pendente de autorizacao explicita de Felipe Duarte**.

## 18. Proximo passo

- Fase 19D-C somente se Felipe autorizar explicitamente a habilitacao de `hstore` no target isolado.
- Fase 19D-D para reexecucao controlada do seed somente apos confirmacao de `hstore`.
