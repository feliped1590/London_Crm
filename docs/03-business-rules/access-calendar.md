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

- **Login** — `create_app_session` bloqueia (fail-closed).
- **Sessão ativa** — `validate_app_session` invalida em até 60s.
- **Banco (defesa real)** — RLS RESTRICTIVE em `deals` e `orders`,
  **apenas em escrita** (INSERT/UPDATE/DELETE). Leitura permanece livre
  para não quebrar dashboards e telas de histórico fora do expediente.
- **Edge Functions sensíveis** — helper `_shared/accessControl.ts` com
  modos `strict` (ERP/financeiro = fail-closed) e `lenient`
  (telemetria/IA leitura = fail-open).

Qualquer alteração em `is_within_access_window` exige revisão completa
do fluxo de sessão e da RLS de `deals`/`orders`.

### Imunidade auditada
Admin e desenvolvedor passam sempre, MAS quando estão fora da janela
um registro `action='admin_bypass'` é gravado em `access_violation_log`
para auditoria. Consulta:

```sql
SELECT user_id, attempted_at, details
FROM access_violation_log
WHERE action = 'admin_bypass'
ORDER BY attempted_at DESC LIMIT 50;
```

### Limitação conhecida (multi-tenant)
A função usa `profiles.active_tenant_id` e cai em
`user_tenants … LIMIT 1` se for nulo. Para usuários multi-tenant, isso
pode validar contra o tenant errado. Mitigação atual: `active_tenant_id`
é setado no login. Mitigação definitiva: tornar `active_tenant_id`
NOT NULL — ver KI-0003.

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

## Como cadastrar

### Via UI (recomendado)
**Configurações → Usuários e Permissões → Janela de Acesso** (visível para
`admin` e `desenvolvedor`):

- Selecione o **CNPJ** no topo.
- Monte a **grade semanal** (vários intervalos por dia, ativar/desativar
  individualmente) ou clique em **"Aplicar Seg–Sex 08:00–18:00"**.
- Adicione **exceções** pontuais (feriado bloqueia, liberação extraordinária
  permite).
- O badge **"Acesso PERMITIDO/FORA agora"** confirma que a regra está
  surtindo efeito.

### Resolução da regra (ordem de precedência)
1. **CNPJ ativo do usuário** (`profiles.active_legal_entity_id`):
   - Se houver exceção para hoje → vale a exceção.
   - Senão, se houver `legal_entity_access_schedules` cadastrado para esse
     CNPJ → avalia contra a grade do CNPJ.
2. **Fallback para o tenant** (regra antiga `tenant_access_schedules` /
   `tenant_access_exceptions`) — só usado se o CNPJ não tiver regra própria.
3. Sem nada cadastrado → fail-safe libera 24/7.

### Via SQL (provisório/manual)

```sql
-- Por CNPJ (preferido):
INSERT INTO legal_entity_access_schedules (tenant_id, legal_entity_id, weekday, start_time, end_time)
SELECT tenant_id, id, d, '08:00', '18:00'
FROM legal_entities, generate_series(1,5) AS d
WHERE id = '<legal_entity_id>';

-- Bloquear feriado por CNPJ:
INSERT INTO legal_entity_access_exceptions (tenant_id, legal_entity_id, exception_date, is_allowed, description)
SELECT tenant_id, id, '2026-04-21', false, 'Tiradentes'
FROM legal_entities WHERE id = '<legal_entity_id>';

-- Por TENANT (fallback global, se nenhum CNPJ tiver regra):
INSERT INTO tenant_access_schedules (tenant_id, weekday, start_time, end_time)
SELECT '<tenant_id>', d, '08:00', '18:00'
FROM generate_series(1,5) AS d;
```

## Próximos passos

1. ~~UI de gestão (CRUD de regras + exceções) em Settings → Acesso.~~ ✅ Feito
   em **Configurações → Usuários e Permissões → Janela de Acesso**.
2. Expandir RLS RESTRICTIVE para `companies`, `contacts`, `proposals` em
   ondas controladas.
3. Aplicar `checkAccessWindow` nas edge functions `erp-*` e `process-*-sync`.
