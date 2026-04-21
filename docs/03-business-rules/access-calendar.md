# Regra de negócio — Janela de acesso por empresa (tenant)

**Owner:** @felipe
**Última revisão:** 2026-04-21
**ADR relacionado:** [0001 — Controle de acesso por calendário](../02-decisions/0001-access-control-calendar.md)

## Resumo

Cada **tenant** (empresa cliente do CRM) pode definir uma janela de acesso
semanal. Usuários comuns só conseguem usar o sistema dentro dessa janela.

## ⚠️ REGRA CRÍTICA

Esta regra é aplicada em **3 camadas no banco** e **1 camada em Edge Functions**.
NÃO pode ser burlada pelo frontend.

- **Login** — `create_app_session` bloqueia.
- **Sessão ativa** — `validate_app_session` invalida em até 60s.
- **Banco (defesa real)** — RLS RESTRICTIVE em `deals` e `orders`.
- **Edge Functions sensíveis** — helper `_shared/accessControl.ts`.

Qualquer alteração em `is_within_access_window` exige revisão completa
do fluxo de sessão e da RLS de `deals`/`orders`.

## Modelo de dados

### `tenant_access_schedules`
Regras semanais. Vários intervalos por dia são suportados.

| Campo        | Tipo     | Notas                                |
| ------------ | -------- | ------------------------------------ |
| `tenant_id`  | uuid     | FK tenants                           |
| `weekday`    | smallint | 0=domingo … 6=sábado                 |
| `start_time` | time     | inclusive                            |
| `end_time`   | time     | exclusivo (`end_time > start_time`)  |
| `is_active`  | bool     | desativar regra sem deletar          |

### `tenant_access_exceptions`
Datas pontuais que sobrescrevem o calendário semanal (feriado bloqueia,
liberação extraordinária permite).

| Campo            | Tipo    | Notas              |
| ---------------- | ------- | ------------------ |
| `tenant_id`      | uuid    |                    |
| `exception_date` | date    | único por tenant   |
| `is_allowed`     | bool    | true = libera dia inteiro |
| `description`    | text    | ex: "Feriado nacional" |

## Quem é imune

- Role `admin`
- Role `desenvolvedor`

## Fail-safe

| Cenário | Comportamento |
| --- | --- |
| Usuário sem `active_tenant_id` resolvível | Permite |
| Tenant sem nenhuma regra ativa | Permite (24/7) |
| RPC falha em Edge Function | Permite (warn no log) |
| Exceção `is_allowed=true` no dia | Permite o dia todo |
| Exceção `is_allowed=false` no dia | Bloqueia o dia todo |

## Timezone

`tenants.settings.timezone` (default `'UTC'`). Helper:
`get_tenant_timezone(tenant_id)`.

A comparação de horário é feita **em horário local do tenant** (`now() AT TIME ZONE tz`).

## Logging

Tabela `access_violation_log`, `action='outside_allowed_hours'`,
`details.context` ∈ `'login'` | `'session_validation'`.

Consulta útil:
```sql
SELECT user_id, attempted_at, details
FROM access_violation_log
WHERE action = 'outside_allowed_hours'
ORDER BY attempted_at DESC
LIMIT 50;
```

## Como cadastrar (provisório, via SQL — UI pendente)

```sql
-- Seg-Sex, 08:00 às 18:00 para um tenant
INSERT INTO tenant_access_schedules (tenant_id, weekday, start_time, end_time)
SELECT '<tenant_id>', d, '08:00', '18:00'
FROM generate_series(1,5) AS d;

-- Bloquear feriado
INSERT INTO tenant_access_exceptions (tenant_id, exception_date, is_allowed, description)
VALUES ('<tenant_id>', '2026-04-21', false, 'Tiradentes');
```

## Próximos passos

1. UI de gestão (CRUD de regras + exceções) em Settings → Acesso.
2. Expandir RLS RESTRICTIVE para `companies`, `contacts`, `proposals` em
   ondas controladas.
3. Aplicar `checkAccessWindow` nas edge functions `erp-*` e `process-*-sync`.
