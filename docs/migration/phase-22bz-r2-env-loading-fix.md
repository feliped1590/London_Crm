# Fase 22BZ-R2 — Env loading fix do runner

## Motivo

Diagnosticar por que o runner read-only nao enxergava `INIFLEX_API_TOKEN` mesmo com endpoint presente.

Padronizacao operacional desta frente:

- usar somente `INIFLEX_API_URL` e `INIFLEX_API_TOKEN`;
- nao considerar `PROJEDATA_*` como alternativa operacional.

## Diagnostico

- PowerShell (sessao atual): `INIFLEX_API_URL=true`, `INIFLEX_API_TOKEN=false`.
- Node (sessao atual): `INIFLEX_API_URL=true`, `INIFLEX_API_TOKEN=false`.
- runner 22BX antes do fix: lia apenas `process.env` e nao carregava `.env.local`.
- `.env.local` existe, mas nesta maquina/sessao nao foi detectada chave `INIFLEX_API_TOKEN` (nem `INIFLEX_API_URL`) no formato esperado.

## Alteracao aplicada

Arquivo alterado:

- `scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs`

Ajuste:

- adicionado fallback seguro para carregar `.env.local` e `.env` no inicio da execucao;
- fallback nao sobrescreve variaveis ja exportadas no ambiente;
- nenhum segredo e logado.

## Validacao apos fix

- `node -e` continuou reportando `INIFLEX_API_TOKEN=false` na sessao atual;
- reexecucao `companies` com `--no-write`: `PARCIAL` por `config_status_missing`;
- reexecucao `products` com `--no-write`: `PARCIAL` por `config_status_missing`.

## Confirmacoes de seguranca

- nenhum token foi impresso;
- `.env.local` segue ignorado;
- nenhum segredo foi versionado;
- nenhum comando `IMP_*` foi executado;
- nenhuma escrita em banco ocorreu;
- executor de escrita `phase-22k-r2-baseline-write.mjs` nao foi alterado.

## Artefato de evidencia

- `artifacts/migration/phase-22bz-r2-env-loading-fix/env-loading-fix-20260628-123405.json`

## Decisao

**PARCIAL** — causa principal confirmada: token nao disponivel ao processo Node na sessao atual.
# Fase 22BZ-R2 — Env loading fix do runner

## Motivo

Diagnosticar por que o runner read-only nao enxergava `INIFLEX_API_TOKEN` mesmo com endpoint presente.

## Diagnostico

- PowerShell (sessao atual): `INIFLEX_API_URL=true`, `INIFLEX_API_TOKEN=false`.
- Node (sessao atual): `INIFLEX_API_URL=true`, `INIFLEX_API_TOKEN=false`.
- runner 22BX antes do fix: lia apenas `process.env` e nao carregava `.env.local`.
- `.env.local` existe, mas nesta maquina/sessao nao foi detectada chave `INIFLEX_API_TOKEN` (nem `INIFLEX_API_URL`) no formato esperado.

## Alteracao aplicada

Arquivo alterado:

- `scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs`

Ajuste:

- adicionado fallback seguro para carregar `.env.local` e `.env` no inicio da execucao;
- fallback nao sobrescreve variaveis ja exportadas no ambiente;
- nenhum segredo e logado.

## Validacao apos fix

- `node -e` continuou reportando `INIFLEX_API_TOKEN=false` na sessao atual;
- reexecucao `companies` com `--no-write`: `PARCIAL` por `config_status_missing`;
- reexecucao `products` com `--no-write`: `PARCIAL` por `config_status_missing`.

## Confirmacoes de seguranca

- nenhum token foi impresso;
- `.env.local` segue ignorado;
- nenhum segredo foi versionado;
- nenhum comando `IMP_*` foi executado;
- nenhuma escrita em banco ocorreu;
- executor de escrita `phase-22k-r2-baseline-write.mjs` nao foi alterado.

## Artefato de evidencia

- `artifacts/migration/phase-22bz-r2-env-loading-fix/env-loading-fix-20260628-123405.json`

## Decisao

**PARCIAL** — causa principal confirmada: token nao disponivel ao processo Node na sessao atual.
