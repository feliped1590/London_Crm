# Fase 16 - Especificacao operacional do script/seed do dataset piloto

## 1. Objetivo

Definir a especificacao operacional para construcao e execucao futura do script/seed do dataset piloto sintetico/controlado, com controles de seguranca, hard-stop e criterios de validacao, sem executar seed nesta fase.

## 2. Contexto

- Fase 13: planejamento de migracao/reconciliacao indicou `NO-GO` para migracao real de producao.
- Fase 14: piloto controlado definido como caminho recomendado (Opcao B no curto prazo).
- Fase 15: dataset sintetico/controlado detalhado e aprovado para preparacao de script/seed, com ressalvas operacionais.
- Cutover real permanece fora de escopo.

## 3. Ambientes

- Origem de referencia estrutural (read-only): `crm-qualyvac-staging` (`cansbrrwrprcycjvgvqm`)
- Alvo futuro de execucao do piloto: `crm-qualyvac-restore-test` (`nsnmlleplpzsefzkuxlb`)
- Producao: proibida para execucao do seed piloto.

## 4. Restricoes de seguranca

- Sem deploy, sem migracao, sem restore, sem escrita em banco nesta fase.
- Sem alteracao de codigo funcional, schema, migrations, RLS/policies, UI ou Edge Functions.
- Sem versionamento de dados sensiveis, dumps, manifestos sensiveis, secrets ou tokens.
- Sem uso de `.env` para armazenar credenciais em arquivos versionados.

## 5. Escopo do seed piloto

### Incluidos no seed piloto (fase de execucao futura)

- `tenants`
- `legal_entities`
- `profiles`
- `user_tenants`
- `user_roles`
- `system_modules` (reuso controlado quando aplicavel)
- `role_module_permissions`
- `companies`
- `contacts`
- `products`
- `product_groups`
- `product_subgroups`
- `product_types`
- `carriers`
- `sales_reps`
- `deals`
- `proposals`
- `proposal_items`
- `orders`
- `order_items`
- `tasks`
- `notifications`

### Controlados/condicionais

- Storage metadata
- Objetos de storage sinteticos
- Simulacao de integracoes
- Logs sinteticos minimos, somente se necessario e com politica explicita

### Excluidos

- `roles` (nao identificado como base `public` atual)
- `product_versions` (nao identificado como base `public` atual)
- `portfolios` (nao identificado como base `public` atual)
- BI/facts/snapshots
- logs reais e filas reais
- secrets/tokens/chaves
- carga manual direta de schemas de sistema `auth` e `storage` fora da trilha dedicada
- qualquer endpoint externo real

## 6. Arquitetura futura dos scripts

Estrutura recomendada para a proxima fase (Fase 17):

- `scripts/pilot-seed/README.md`
- `scripts/pilot-seed/seed-pilot-dataset.sql`
- `scripts/pilot-seed/validate-pilot-dataset.sql`
- `scripts/pilot-seed/cleanup-pilot-dataset.sql`
- `scripts/pilot-seed/reconcile-pilot-dataset.sql`

Observacao:

- Nesta Fase 16, apenas a especificacao foi definida. Criacao/execucao de scripts fica para a Fase 17, apos hard-stop formal.

## 7. Hard-stop obrigatorio

Toda execucao futura do seed deve abortar imediatamente se qualquer condicao abaixo falhar:

- project ref alvo diferente de `nsnmlleplpzsefzkuxlb`
- nome do ambiente alvo diferente de `crm-qualyvac-restore-test`
- deteccao do ref proibido `cansbrrwrprcycjvgvqm` (staging)
- qualquer indicio de conexao com producao
- ausencia de autorizacao explicita para execucao do piloto
- conexao sem identificacao inequívoca do alvo
- output contendo secrets/tokens
- integracoes externas habilitadas sem modo seguro de simulacao

Validacoes explicitas exigidas no inicio da execucao futura:

- `ref_esperado = nsnmlleplpzsefzkuxlb`
- `ref_proibido = cansbrrwrprcycjvgvqm`
- `nome_esperado = crm-qualyvac-restore-test`

## 8. Padrao de idempotencia/namespace

Estrategia recomendada:

- Usar namespace/prefixo piloto em todos os registros sinteticos (ex.: `PILOTO_MIGRACAO_20260621`).
- Utilizar chaves de controle/flags para reexecucao segura quando possivel.
- Evitar qualquer colisao com dados nao-piloto.
- Permitir limpeza por marcador/prefixo.
- Proibir dados reais (clientes reais, emails reais corporativos, CNPJs reais, documentos reais).

## 9. Dados sinteticos recomendados

Exemplos referenciais (nao executar nesta fase):

- Tenant: `Tenant Piloto Migracao`
- Legal entities: `Empresa Piloto A`, `Empresa Piloto B`
- Companies: `Cliente Piloto 001`, `Cliente Piloto 002`, ...
- Produtos: `Produto Piloto 001`, `Produto Piloto 002`, ...
- Usuarios sinteticos:
  - `admin.piloto@example.test`
  - `vendedor.piloto@example.test`
  - `assistente.piloto@example.test`

## 10. Politica de integracoes

O seed futuro deve:

- nao disparar ERP real;
- nao disparar PDF real fora de ambiente controlado;
- nao acionar CNPJ real;
- nao enviar email real;
- nao disparar webhooks reais;
- nao acionar n8n real;
- marcar registros como teste quando houver campo apropriado;
- manter filas desativadas/em estado seguro;
- usar simulacao/mock quando necessario.

## 11. Politica de rollback logico/limpeza

Diretrizes de limpeza futura:

- Limpeza por namespace/prefixo do piloto.
- Ordem inversa de dependencia FK.
- Sem `truncate`.
- Sem apagar registros fora do namespace piloto.
- Validar contagens pos-limpeza.
- Gerar relatorio de limpeza e abortar se encontrar registros fora do padrao piloto.

Ordem sugerida de limpeza:

1. `notifications`, `tasks`
2. `order_items`
3. `orders`
4. `proposal_items`
5. `proposals`
6. `deals`
7. `contacts`
8. `products`
9. `companies`
10. `sales_reps`
11. `carriers`
12. `user_roles`, `user_tenants`, `profiles`
13. `legal_entities`
14. `tenants` (tenant piloto)
15. storage piloto (quando aplicavel)

## 12. Reconciliacao automatizavel

Validacoes futuras de alto nivel:

- Contagem por tabela no escopo.
- Contagem por namespace/prefixo piloto.
- Verificacao de FKs orfas.
- Verificacao de vinculos tenant/legal entity.
- Verificacao de usuarios/perfis/permissoes.
- Verificacao de status em `deals`, `proposals`, `orders`.
- Verificacao de totais basicos em itens.
- Verificacao de ausencia de integracoes externas disparadas.
- Verificacao de RLS por perfil (quando testavel no piloto).
- Verificacao de storage (bucket/objetos/metadata), se no escopo.

## 13. Criterios de aprovacao

- Seed executado somente em `nsnmlleplpzsefzkuxlb`.
- 100% dos registros piloto obrigatorios criados.
- Reconciliacao sem divergencia critica.
- Zero FK orfa critica.
- Zero integracao externa real disparada.
- Zero dado sensivel real.
- RLS validado nos fluxos principais.
- Processo de cleanup testavel/documentado.

## 14. Criterios de reprovacao

- Execucao no ambiente errado.
- Divergencia critica sem explicacao.
- FK orfa critica.
- Disparo de integracao real.
- Exposicao de dado real/sensivel.
- Falha de RLS com acesso indevido.
- Impossibilidade de limpar o dataset piloto com seguranca.

## 15. Riscos e bloqueios

- Decisoes pendentes sobre logs/filas/auditoria.
- Pendencia de inventario operacional de secrets (`secrets list`).
- Risco de efeito colateral se integracoes nao forem devidamente simuladas.
- Ausencia de algumas tabelas esperadas no `public` atual (`roles`, `product_versions`, `portfolios`) requer tratamento de escopo.
- Dataset sintetico pode nao refletir 100% dos cenarios reais (mitigado com piloto final autorizado de alta representatividade).

## 16. Recomendacao

**GO para criar scripts do seed piloto** (com hard-stop obrigatorio e controles descritos neste documento).

Condicoes:

- manter execucao exclusivamente no ambiente isolado;
- resolver itens dependentes de decisao antes da execucao;
- manter `NO-GO` para cutover real ate validacao completa das fases subsequentes.

## 17. Proximo passo recomendado

Iniciar a Fase 17 para:

1. criar os arquivos de script/validacao/cleanup/reconciliacao;
2. implementar hard-stop tecnico nos scripts;
3. preparar checklist operacional de execucao controlada;
4. executar somente apos aprovacao explicita da janela do piloto.
