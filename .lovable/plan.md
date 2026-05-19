## Diagnóstico

A Fernanda Graziela está recebendo o erro:

> `null value in column "to_user_id" of relation "portfolio_transfers" violates not-null constraint`

ao tentar aprovar solicitações de transferência (vistas no vídeo enviado).

### Causa raiz

A função `public.approve_transfer_request` insere um registro em `portfolio_transfers` usando `resolve_user_for_sales_rep(to_sales_rep_id)` para preencher `to_user_id`. Quando o **vendedor destino não tem usuário vinculado** em `user_sales_reps`, esse resolver retorna `NULL`, e o INSERT falha porque a coluna `portfolio_transfers.to_user_id` é `NOT NULL`.

Confirmado no banco: há 6 solicitações pendentes cujo destino é **SHELI AKEMI MORITA**, que **não possui nenhum vínculo** em `user_sales_reps`. Qualquer admin tentando aprovar essas solicitações vê esse erro — incluindo a Fernanda.

```text
pending requests com to_user_id resolvendo NULL:
- 6 solicitações -> SHELI AKEMI MORITA (sem user vinculado)
```

A coluna irmã `from_user_id` já é `NULL`-able. Manter `to_user_id NOT NULL` é incoerente com a regra de ownership do projeto (memória `ownership-standardization-strategy`): **`sales_rep_id` é a fonte verdadeira de ownership; `owner_id`/`*_user_id` são fallback/auditoria.** O destino real da transferência (`to_sales_rep_id`) já está gravado e não é nulo.

## Correção proposta

Migração única tornando `portfolio_transfers.to_user_id` nullable, espelhando o comportamento de `from_user_id`.

```sql
ALTER TABLE public.portfolio_transfers
  ALTER COLUMN to_user_id DROP NOT NULL;
```

- Idempotente (DROP NOT NULL é seguro de reexecutar).
- Não altera RLS, contratos de API ou comportamento funcional.
- A função `approve_transfer_request` continua igual: grava `to_user_id` quando o vendedor destino tem usuário vinculado, e `NULL` quando não tem. O `sales_rep_id` da empresa é atualizado normalmente — a transferência funciona em ambos os casos.
- Front-end (`TransferApprovalsManager`, `CompanyAuditHistory`, `PortfolioManager`) já trata `to_user_id` ausente exibindo `'—'`.

## Validação pós-migração

1. Aprovar uma das 6 solicitações destinadas a SHELI AKEMI MORITA e confirmar que:
   - A `companies.sales_rep_id` muda para o destino.
   - O registro em `portfolio_transfers` é criado com `to_user_id = NULL` e `to_sales_rep_id` preenchido.
   - A solicitação aparece como **Aprovada** na lista.
2. Conferir que aprovações com destino normal (com user vinculado) continuam gravando `to_user_id` corretamente.

## Fora do escopo

- Não vincular a SHELI a um usuário automaticamente — isso é decisão administrativa.
- Não alterar regras de RLS, owner_id ou a função `approve_transfer_request`.