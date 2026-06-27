# Fase 22I-R2 — Revisao Tecnica dos Guard Rails Antes do Modo Write

## 1. Objetivo da fase

Revisar tecnicamente os guard rails existentes no repositorio antes de qualquer implementacao de modo write para a baseline cadastral no restore-test.

Esta fase e somente analise e documentacao. Nao executa escrita.

## 2. Escopo

- Verificacao do estado local do repositorio.
- Leitura do gate documental da 22H-R2.
- Inventario de scripts/documentos de migracao e seed relacionados.
- Analise de protecoes tecnicas existentes e lacunas.
- Recomendacao de decisao para fase seguinte.

## 3. Restricoes absolutas

Nesta fase, foi mantido:

- sem SQL de escrita;
- sem escrita em banco;
- sem seed/cleanup/rollback executados;
- sem migrations;
- sem deploy;
- sem chamadas ERP/API/webhook/n8n;
- sem processamento de filas;
- sem push;
- sem alteracao de staging/producao;
- sem adicao de modo write.

## 4. Pre-checks executados

- Branch atual: `main`.
- `main` alinhada com `origin/main` (`0 0` em `origin/main...main`).
- Working tree no inicio da fase: apenas `docs/migration/phase-22h-r2-controlled-write-gate.md` pendente.
- Sem `.env`, dumps, backups sensiveis ou temporarios pendentes no Git.

Validacao adicional de target local (read-only):

- `project-ref` local: `nsnmlleplpzsefzkuxlb`.
- `linked-project.name`: `crm-qualyvac-restore-test`.

## 5. Scripts/documentos analisados

### 5.1 Documentacao

- `docs/migration/phase-22h-r2-controlled-write-gate.md`
- `docs/migration/phase-22g-r2-baseline-dry-run.md`
- `docs/migration/phase-22f-r2-baseline-exact-data-spec.md`
- `docs/migration/phase-22e-r2-minimal-cadastral-baseline-plan.md`
- `docs/migration/phase-22d-r2-restore-test-erp-keys-and-linkage-readiness.md`

### 5.2 Dry-run

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`

### 5.3 Seed/Write (fora do fluxo baseline 22*, mas presentes no repositorio)

- `scripts/pilot-seed/seed-pilot-dataset.sql`

### 5.4 Rollback/Cleanup

- `scripts/pilot-seed/cleanup-pilot-dataset.sql`

### 5.5 Validacao/Reconcile

- `scripts/pilot-seed/validate-pilot-dataset.sql`
- `scripts/pilot-seed/reconcile-pilot-dataset.sql`
- `scripts/qa/access-window-tests.sql`
- `scripts/qa/access-window-parity-tests.sql`

### 5.6 Utilitarios/guia operacional

- `scripts/pilot-seed/README.md`

## 6. Guard rails existentes

### 6.1 No script de baseline dry-run (`phase-22g-r2-baseline-dry-run.mjs`)

- Exige `--dry-run` (hard abort sem flag).
- Exige `--expected-target` com valor fixo `nsnmlleplpzsefzkuxlb`.
- Valida `supabase/.temp/project-ref`.
- Valida nome do projeto `crm-qualyvac-restore-test`.
- Bloqueia targets proibidos (`cansbrrwrprcycjvgvqm`, `nazymjfzjadfgovcfivs`).
- Restringe consultas a SQL read-only (`SELECT`/`WITH`) e bloqueia comandos destrutivos por regex.
- Mantem `BLOCKED_ENTITIES` com transacionais e filas.
- Nao possui caminho de escrita; gera apenas evidencia externa JSON.
- Valida dependencia de contato com fallback seguro (`contacts.company_id`) quando `company_contacts` nao existe.

### 6.2 No gate documental 22H-R2

- Define whitelist de entidades permitidas para futura escrita.
- Define blacklist explicita de entidades proibidas/transacionais.
- Define ordem obrigatoria futura de escrita.
- Define pre-checks, pos-checks e rollback por batch/chaves temporarias.
- Define frase exata obrigatoria de autorizacao humana.
- Bloqueia explicitamente staging/producao/target invalidado.

### 6.3 Nos scripts `pilot-seed` (escopo legado/piloto)

- `seed-pilot-dataset.sql` e `cleanup-pilot-dataset.sql` possuem hard-stop por target ref/nome e gate de aprovacao (`app.pilot_execution_approved`).
- `cleanup-pilot-dataset.sql` exige `app.pilot_cleanup_execute=YES` para executar deletes (preview por padrao).
- `validate`/`reconcile` sao read-only.

## 7. Guard rails ausentes ou frageis

Lacunas para habilitar um futuro write seguro da baseline 22*:

1. **Sem modo write controlado da baseline**
   - O script 22G-R2 e apenas dry-run; ainda nao existe fluxo write com as mesmas protecoes.

2. **Sem enforce de autorizacao humana em codigo para write baseline**
   - A frase exata de autorizacao esta no documento 22H-R2, mas nao e validada por nenhum script write (ainda inexistente).

3. **Sem enforce tecnico de whitelist/blacklist em operacao de escrita real**
   - A whitelist/blacklist existe no plano/documentos e no dry-run simulado, mas nao ha executor de escrita com bloqueio hard por tabela.

4. **Sem validacao hard de batch em fluxo de escrita real**
   - O batch esta documentado e presente no dry-run, mas nao existe script write que recuse escrita fora do batch.

5. **Scripts `pilot-seed` escrevem entidades transacionais**
   - Embora tenham gates, eles escrevem `deals`, `proposals`, `orders` etc., que sao proibidos no fluxo baseline 22*.
   - Risco operacional: uso indevido por operador que execute script errado.

6. **Rollback baseline ainda e plano, nao rotina operacional dedicada**
   - Ha diretriz de rollback por batch, mas nao existe mecanismo write/rollback baseline pareado e validado nesta trilha.

## 8. Riscos identificados

- **Risco de confusao operacional entre trilhas**: scripts `pilot-seed` coexistem com baseline 22* e podem gerar escrita transacional indevida se usados fora de contexto.
- **Risco de write sem gate humano em codigo**: sem executor write 22* ainda nao ha ponto tecnico para validar frase exata de autorizacao.
- **Risco de escrita parcial sem batch enforcement**: ate existir write controlado, a rastreabilidade por batch depende de disciplina processual/documental.
- **Risco mitigado de target**: no dry-run 22G, as validacoes de target/ref/nome estao fortes.

## 9. Recomendacao tecnica

Antes de qualquer modo write:

1. criar executor write dedicado da baseline 22* (separado de `pilot-seed`);
2. portar para esse executor todos os gates do dry-run (target ref, project name, targets proibidos, SQL guard, blacklist);
3. exigir validacao tecnica da frase exata de autorizacao humana como pre-condicao obrigatoria;
4. aplicar whitelist de tabelas permitidas e blacklist hard de transacionais/filas;
5. impor batch id obrigatorio em toda operacao de escrita e em evidencias before/after;
6. incluir `--write` desabilitado por padrao e abortar sem dupla confirmacao;
7. preparar rollback baseline dedicado por batch/chaves temporarias, tambem com dry-run previo.

## 10. Criterio de decisao para proxima fase

**Decisao desta fase: PARCIAL**

Justificativa:

- documentacao e guard rails de dry-run estao robustos;
- target isolado e bloqueios de staging/prod estao bem cobertos;
- porem, ainda faltam guard rails operacionais em um executor write real (autorizacao humana enforce em codigo, whitelist/blacklist hard de escrita, batch enforcement e rollback baseline dedicado).

Criterio para **GO da Fase 22J-R2**:

- implementar/adaptar executor tecnico com os guard rails acima sem escrever;
- validar que o modo write continua impossivel sem autorizacao explicita;
- provar que tabelas transacionais nao entram em nenhum caminho write da baseline.

## 11. Confirmacoes negativas obrigatorias

- SQL executado: nao
- escrita em banco: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- push: nao
- staging/prod alterados: nao
- modo write adicionado: nao
