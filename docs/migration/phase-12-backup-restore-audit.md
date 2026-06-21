# Fase 12 - Backup e restauracao auditavel

## Objetivo da fase

Criar evidencia auditavel de backup e teste de restauracao do CRM sem alterar codigo funcional, sem deploy, sem operacao destrutiva e sem expor dados sensiveis.

## Ambientes avaliados

- **Workspace local:** branch `main`, repo `qualyvac-migration`.
- **Projeto linkado na CLI (staging):** `cansbrrwrprcycjvgvqm` (`crm-qualyvac-staging`).
- **Outros projetos visiveis:** `nwhnbfwetditllokjiht`, `zbaudpblhqujyoxnrqcz`, `nazymjfzjadfgovcfivs`, `nsnmlleplpzsefzkuxlb`.
- **Origem historica em config local:** `lusyhkizwoihixcvcgap` (em `supabase/config.toml`), sem confirmacao operacional nesta fase.
- **Ambiente alvo de restore test (recomendado):** projeto Supabase separado, exclusivo para restauracao (`crm-qualyvac-restore-test-<data>`).

## Evidencias encontradas

- `SUPABASE_SCHEMA_COMPLETO.sql` (referencia historica de schema).
- `docs/migration/phase-04-plano-supabase-proprio.md`
- `docs/migration/phase-05-criacao-supabase-staging.md`
- `docs/migration/phase-06-migrations-staging.md`
- `docs/migration/phase-07-validacao-schema-staging.md`
- `docs/migration/phase-08-storage-buckets.md`
- `docs/migration/phase-09-edge-functions-secrets.md`
- `docs/migration/phase-10-proposal-public-view-v3.md`

## Classificacao das evidencias atuais (GO/PARCIAL/NO-GO)

| Item minimo | Status | Evidencia atual | Lacuna |
|---|---|---|---|
| Backup de schema | PARCIAL | `SUPABASE_SCHEMA_COMPLETO.sql` + docs de schema | Falta dump recente/datado da origem oficial |
| Backup de dados | NO-GO | Nao encontrado artefato de dump de dados atual | Falta backup auditavel de dados |
| Backup/listagem de storage | PARCIAL | `phase-08-storage-buckets.md` | Falta inventario operacional datado por bucket/objeto |
| Auth/usuarios | NO-GO | Nao ha export/listagem auditavel atual | Falta procedimento e evidencia de export |
| Secrets/variaveis (nomes) | PARCIAL | `phase-09-edge-functions-secrets.md` | Falta listagem operacional atual por ambiente |
| Teste de restauracao | NO-GO | Sem evidencia de restore test executado | Falta execucao controlada e relatorio de validacao |
| Local externo seguro | NO-GO | Sem evidencia de cofre externo definido | Falta destino criptografado fora do repo |
| Plano de rollback | PARCIAL | Diretrizes distribuidas em docs | Falta playbook unico com gatilhos e aprovadores |
| Responsavel por autorizacao de rollback | PARCIAL | Responsaveis parciais citados em fases anteriores | Falta matriz formal de autorizacao |

## Lacunas criticas

- Origem oficial do backup de producao nao formalmente confirmada nesta fase.
- Ausencia de backup de dados auditavel e recente.
- Ausencia de restore test em ambiente isolado.
- Ausencia de evidencias de armazenamento externo seguro para artefatos.
- Ausencia de matriz formal de aprovacao para rollback.

## Plano de backup seguro (proposto, nao executado)

### Premissas

- Nao versionar dumps reais no Git.
- Nao gravar dumps dentro do repositorio.
- Nao expor valores de secrets.
- Criptografar os artefatos em repouso.

### Metodos disponiveis

- `npx supabase db dump` (disponivel na CLI atual).
- `pg_dump` direto nao disponivel no host atual.
- `npx supabase storage ls` para inventario de objetos.
- `npx supabase secrets list` apenas para nomes (sem valores).

### Padrao de nomes

- `crm_<env>_schema_<YYYYMMDDTHHMMSSZ>.sql`
- `crm_<env>_data_<YYYYMMDDTHHMMSSZ>.sql`
- `crm_<env>_roles_<YYYYMMDDTHHMMSSZ>.sql`
- `crm_<env>_storage_inventory_<YYYYMMDDTHHMMSSZ>.json`
- `crm_<env>_auth_inventory_<YYYYMMDDTHHMMSSZ>.csv`
- `crm_<env>_manifest_<YYYYMMDDTHHMMSSZ>.json`

### Sequencia sugerida

1. Exportar schema:
   - `npx supabase db dump --linked --schema public,auth,storage --file "<backup_dir>/crm_<env>_schema_<ts>.sql"`
2. Exportar dados:
   - `npx supabase db dump --linked --data-only --use-copy --file "<backup_dir>/crm_<env>_data_<ts>.sql"`
3. Exportar roles (quando aplicavel):
   - `npx supabase db dump --linked --role-only --file "<backup_dir>/crm_<env>_roles_<ts>.sql"`
4. Gerar inventario de storage (buckets/objetos) com `supabase storage ls`.
5. Gerar inventario de secrets (somente nomes) com `npx supabase secrets list`.
6. Registrar hashes SHA-256, tamanhos e timestamp em manifesto.

### Validacao do backup

- Todos os arquivos existem e possuem tamanho maior que zero.
- Manifesto registra origem (project ref), operador, data UTC e versao da CLI.
- Hash SHA-256 calculado para cada artefato e conferido no manifesto.

## Plano de restore test (proposto, nao executado)

### Ambiente alvo

- Projeto Supabase dedicado e isolado para restore test.
- Proibido restaurar em producao.

### Ordem de restauracao

1. Restaurar schema.
2. Restaurar roles/grants (se aplicavel).
3. Restaurar dados.
4. Revalidar/inventariar storage (quando coberto pelo teste).

### Validacoes pos-restore

- Contagem de tabelas por schema comparada ao baseline.
- Validacao de objetos SQL criticos: funcoes, triggers, policies.
- Validacao minima de RLS: existencia de policies em tabelas sensiveis.
- Validacao de funcoes/RPCs criticas (listagem e assinatura).
- Validacao de buckets/storage esperados (quando aplicavel).
- Emissao de relatorio com divergencias e status final.

## Criterios de aprovacao da fase

- Origem oficial do backup confirmada (project ref e responsavel).
- Procedimento de backup aprovado e executavel sem operacao destrutiva.
- Destino externo seguro definido e validado.
- Restore test planejado em ambiente isolado com checklist de validacao.
- Responsaveis de aprovacao/rollback definidos nominalmente.

## Criterios de bloqueio (NO-GO)

- Sem acesso/credenciais para origem e ambiente de restore test.
- Sem destino seguro externo para armazenar artefatos.
- Sem evidencias minimas de backup de dados.
- Sem definicao de aprovacao de rollback.
- Qualquer tentativa de executar restore em ambiente real.

## Proximos passos recomendados

1. Confirmar oficialmente o project ref de origem de backup de producao.
2. Provisionar ambiente exclusivo para restore test.
3. Executar janela controlada de backup (fora do repositorio) com manifesto/hash.
4. Executar restore test nesse ambiente isolado e registrar relatorio.
5. Atualizar este documento com evidencias anexas (sem dados sensiveis).
6. Reavaliar status GO/NO-GO da Fase 12 apos evidencias operacionais.

## Alerta obrigatorio de seguranca

**Dumps reais (schema/data/auth/storage) nao devem ser versionados no repositorio Git.**

**Arquivos contendo dados reais, tokens, chaves ou qualquer informacao sensivel devem permanecer somente em armazenamento externo seguro e controlado.**
