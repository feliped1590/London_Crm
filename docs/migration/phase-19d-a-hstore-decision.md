# Fase 19D-A - Decisao tecnica sobre dependencia `hstore`

## 1) Contexto

Esta fase define a decisao tecnica para tratar a dependencia de `hstore` antes de nova tentativa do seed piloto.  
Escopo: analise e documentacao, sem executar seed/validate/reconcile/cleanup.

## 2) Resultado da Fase 19B

- Hard-stop e target estavam corretos.
- Seed falhou com `function hstore(text, text) does not exist`.
- Reconcile falhou por enum invalido (`proposal_status = 'draft'` na epoca).
- Filas de integracao permaneceram zeradas.
- Contagens do namespace piloto permaneceram em zero.
- Nao houve cleanup, deploy ou efeito colateral identificado.

## 3) Ajustes da Fase 19C

- Seed atualizado com hard-stop tecnico para abortar quando `hstore` estiver ausente.
- Seed, validate, reconcile e cleanup ajustados para compatibilidade com enums reais e padroes uppercase.
- README atualizado com licoes da Fase 19B e requisitos para nova tentativa.

## 4) Dependencia tecnica identificada

- Funcao: `public.enforce_uppercase_text()`.
- Dependencia: operador com `hstore(...)` no corpo da funcao.
- Resultado: qualquer insert/update em tabelas com trigger dessa funcao falha sem extensao `hstore`.

## 5) Tabelas impactadas pelo trigger

- `carriers`
- `companies`
- `contacts`
- `deals`
- `order_items`
- `orders`
- `pipelines`
- `products`
- `tasks`

## 6) Opcao A - Habilitar `hstore` somente no target isolado

Escopo permitido:

- Ambiente isolado de restore test:
  - nome: `crm-qualyvac-restore-test`
  - ref: `nsnmlleplpzsefzkuxlb`

Acao proposta:

- Executar `create extension if not exists hstore;` **somente** no target isolado.

Proibicoes:

- Nao executar em `cansbrrwrprcycjvgvqm` (staging).
- Nao executar em producao.
- Nao executar em qualquer ref diferente de `nsnmlleplpzsefzkuxlb`.

Vantagem:

- Preserva comportamento real esperado do schema/triggers para validar fluxo piloto completo.

Risco:

- Introduz alteracao de extensao no banco alvo (mesmo sendo ambiente descartavel/isolado).

## 7) Opcao B - Nao habilitar `hstore` e reduzir escopo

Acao:

- Nao criar extensao.
- Excluir do seed tabelas afetadas por `enforce_uppercase_text()`.

Consequencia tecnica:

- Piloto perde cobertura dos fluxos principais (`companies`, `contacts`, `products`, `deals`, `orders`, `order_items`, `tasks` etc.).

Vantagem:

- Zero alteracao de extensao no ambiente.

Risco:

- Baixa representatividade do teste; valida pouco do fluxo real de migracao.

## 8) Comparativo de riscos

- **Opcao A:** risco operacional controlavel (alteracao pontual em ambiente isolado), alta cobertura funcional.
- **Opcao B:** risco operacional menor imediato, porem risco elevado de falsa confianca por baixa cobertura.

## 9) Recomendacao tecnica

**Recomendada: Opcao A**, condicionada a aprovacao explicita de Felipe Duarte para habilitar `hstore` no target isolado.

## 10) Condicoes obrigatorias para seguir

Antes de qualquer execucao da opcao A:

1. Confirmar ref alvo `nsnmlleplpzsefzkuxlb`.
2. Confirmar nome alvo `crm-qualyvac-restore-test`.
3. Confirmar branch/repo limpo.
4. Confirmar que staging/producao nao serao usados.
5. Confirmar aprovacao explicita de Felipe Duarte.
6. Confirmar que cleanup automatico continua proibido.

## 11) Comando proposto (sem secrets), se opcao A for aprovada

```sql
create extension if not exists hstore;
```

## 12) Hard-stop obrigatorio

- Executar somente no ref `nsnmlleplpzsefzkuxlb`.
- Abortar imediatamente se ref for `cansbrrwrprcycjvgvqm`.
- Abortar imediatamente se houver indicio de producao.

## 13) Evidencias exigidas se opcao A for executada

- Comprovacao do target (ref + nome) antes da execucao.
- Comando executado sem secrets.
- Resultado da execucao do `create extension`.
- Consulta read-only confirmando `hstore` instalada.
- Confirmacao de que staging/producao nao foram tocados.
- Registro explicito de que cleanup nao foi executado.

## 14) Decisao

**Opcao A recomendada**, porem **pendente de aprovacao explicita de Felipe Duarte**.

## 15) Proximo passo

- **Fase 19D-B**: somente apos aprovacao explicita para habilitar `hstore` no target isolado.
- **Fase 19D-C**: reexecucao controlada do seed apenas depois da 19D-B concluida com sucesso.
