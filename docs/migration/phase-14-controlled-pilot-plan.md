# Fase 14 - Planejamento do piloto controlado de migracao/reconciliacao

## 1. Objetivo

Planejar um piloto controlado de migracao/reconciliacao com dataset representativo, sem executar migracao nesta fase, para reduzir risco antes de qualquer decisao de cutover.

## 2. Contexto das Fases 12 e 13

- Fase 12: trilha de backup/restore concluida com evidencia auditavel e restore test em ambiente isolado; resultado consolidado `APROVADO COM RESSALVA`.
- Fase 13: plano tecnico de migracao/reconciliacao concluido com inventario read-only; resultado `NO-GO` para migracao real de producao neste momento devido a baixa representatividade de dados no staging.

## 3. Ambientes envolvidos

- Origem staging atual: `crm-qualyvac-staging` (`cansbrrwrprcycjvgvqm`) - conhecido, porem pouco representativo para piloto final.
- Destino isolado para testes: `crm-qualyvac-restore-test` (`nsnmlleplpzsefzkuxlb`) - descartavel, apto para piloto tecnico.
- Fonte alternativa (sob autorizacao): recorte real controlado de producao/Lovable para piloto de alta representatividade.

## 4. Restricoes de seguranca

- Sem deploy, sem migracao executada, sem restore nesta fase.
- Sem escrita em banco (insert/update/delete/truncate).
- Sem alteracao de codigo funcional, schema, migrations, RLS/policies, UI ou Edge Functions.
- Sem versionamento de dumps, manifestos sensiveis, tokens, secrets ou dados pessoais.
- Planejamento e documentacao apenas.

## 5. Opcoes de estrategia para o piloto

### Opcao A - Origem no staging atual

- Vantagem: ambiente conhecido e acessivel.
- Desvantagem: baixo volume e baixa representatividade nos dominios criticos.
- Uso recomendado: validar mecanica tecnica (pipeline de carga/reconciliacao), nao validar readiness de producao.

### Opcao B - Popular staging com dataset sintetico/controlado representativo

- Vantagem: exercita FKs, RLS, regras de permissao e reconciliacao sem expor dado real sensivel.
- Desvantagem: nao replica integralmente comportamento de producao.
- Uso recomendado: piloto tecnico principal no curto prazo.

### Opcao C - Recorte real autorizado de producao/Lovable

- Vantagem: maior representatividade para decisao pre-cutover.
- Desvantagem: exige governanca forte (autorizacao formal, backup, controles de acesso, mascaramento/anonimizacao quando aplicavel).
- Uso recomendado: piloto final de confianca antes de GO de cutover, condicionado a aprovacoes.

## 6. Dataset minimo representativo

Minimos sugeridos para considerar o piloto valido:

### 6.1 Nucleo

- >= 1 tenant ativo.
- >= 2 legal entities.
- >= 3 usuarios/perfis.
- >= 2 perfis de permissao distintos (ex.: admin/comercial).
- Vinculos `user_tenants` e `user_roles` completos.

### 6.2 Cadastros

- 20 a 50 `companies`.
- 20 a 50 `contacts`.
- 20 a 50 `products`.
- Cadastros auxiliares relacionados (classes/tipos/familias/grupos/subgrupos).
- `carriers` configuradas quando aplicavel.

### 6.3 Comercial

- 10 a 20 `deals` distribuidos em estagios.
- `proposals` em status variados + `proposal_items`.
- `orders` em status variados + `order_items`.
- `sales_reps` e vinculos de carteira quando aplicavel.

### 6.4 Operacional

- `tasks` e `notifications` com volume minimo funcional.
- Logs/filas com escopo controlado (somente os necessarios para validar integridade).

### 6.5 Integracoes

- >= 1 caso funcional por trilha relevante (ERP/PDF/CNPJ), sem disparo de integracoes reais sem autorizacao.

### 6.6 Storage

- Buckets esperados + subconjunto controlado de objetos/anexos.
- Vínculo de metadata com entidades de negocio quando aplicavel.

## 7. Escopo proposto do piloto

- Validar capacidade fim-a-fim de migrar e reconciliar dados de negocio core.
- Validar seguranca de acesso (RLS/RBAC) e integridade referencial.
- Validar aderencia funcional minima em fluxos comerciais.
- Nao validar nesta fase: cutover definitivo, virada de producao, operacao completa de integracoes externas em modo real.

## 8. Tabelas/dominios incluidos

- Nucleo: `tenants`, `legal_entities`, `profiles`, `user_tenants`, `user_roles`.
- Cadastros: `companies`, `contacts`, `products`, `carriers` e cadastros de apoio relevantes.
- Comercial: `deals`, `proposals`, `proposal_items`, `orders`, `order_items`, `sales_reps`.
- Operacional minimo: `tasks`, `notifications`.
- Storage metadata necessario ao escopo do piloto.
- `proposal_access_logs` apenas como caso controlado de auditoria, nao como criterio principal de negocio.

## 9. Tabelas/dominios excluidos

- Dumps/copias diretas de schemas de sistema (`auth`, `storage`) via carga manual sem trilha dedicada.
- Objetos de segredo/configuracao sensivel (secrets/tokens/chaves).
- Tabelas de BI/facts/snapshots para decisao de cutover (preferir recomputacao/estrategia propria).
- Filas/logs historicos extensos nao necessarios para validar regra de negocio.

## 10. Itens dependentes de decisao

- Politica para logs/filas/auditoria: migrar parcial, reiniciar ou excluir por ambiente.
- Estrategia de auth users (sincronizacao e reconciliacao com `profiles`).
- Politica de storage: escopo de objetos a migrar no piloto.
- Uso de dados reais (Opcao C): depende de autorizacao formal e controles de LGPD.
- Resolucao da pendencia de inventario de secrets (`secrets list`).

## 11. Criterios de reconciliacao

Por grupo incluido no piloto:

- Contagem origem x destino por tabela critica.
- Amostra de IDs e registros chave por dominio.
- Verificacao de FKs orfas (zero em entidades comerciais criticas).
- Verificacao de RLS ativo e politicas esperadas.
- Verificacao de RBAC/permissoes por perfil.
- Verificacao de `auth`/`profiles`/vinculos de tenant.
- Verificacao de buckets/objetos de storage do escopo.
- Verificacao funcional minima (abrir cliente, produto, proposta, pedido).
- Verificacao de logs/filas conforme politica definida.

## 12. Criterios de aprovacao

- 100% das tabelas obrigatorias do escopo carregadas.
- 100% das contagens reconciliadas nas tabelas criticas (ou divergencia explicada e aprovada).
- Zero FK orfa critica.
- Zero falha critica de RLS/RBAC nos fluxos homologados.
- Fluxos funcionais minimos aprovados (cliente/produto/proposta/pedido).
- Nenhum vazamento de dado sensivel e nenhum efeito colateral fora do ambiente piloto.

## 13. Criterios de reprovacao

- Divergencia sem explicacao em tabela critica.
- FK orfa em entidade comercial.
- Erro de permissao/RLS que permita acesso indevido.
- Quebra funcional em proposta/pedido/cliente/produto.
- Storage ou vinculos de anexo inconsistentes no escopo definido.
- Dependencia critica de secrets/integracoes sem mapeamento.
- Qualquer impacto em staging/producao.

## 14. Riscos e bloqueios

- Dataset atual de staging insuficiente para validar migracao real.
- Dependencias circulares e ordem de carga complexa em dominio comercial.
- Incerteza sobre politica de logs/filas/auditoria.
- Pendencia de inventario operacional de secrets.
- Integracoes externas ainda nao homologadas ponta a ponta.
- Ausencia de runbook final de cutover/rollback aprovado.

## 15. Recomendacao final

**PARCIAL - GO para montar dataset piloto (controlado), NO-GO para cutover real.**

Interpretacao:

- Pode avancar para construcao e execucao de piloto tecnico controlado.
- Nao pode avancar para migracao real de producao enquanto criterios de representatividade e homologacao completa nao forem atendidos.

## 16. Proximo passo recomendado

1. Escolher e formalizar estrategia do piloto (recomendado: Opcao B imediata; Opcao C como pre-cutover sob autorizacao).
2. Definir politica de logs/filas/auditoria para o piloto.
3. Montar dataset minimo representativo conforme este plano.
4. Executar piloto no ambiente isolado com checklist de reconciliacao.
5. Consolidar resultado em relatorio de aprovacao/reprovacao para gate seguinte do Go/No-Go.
