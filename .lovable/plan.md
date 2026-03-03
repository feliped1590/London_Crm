
## Diagnóstico: Empresa "BRASIL ATACADISTA" não aparece no seletor do Pipeline

### Causa Raiz

Quando um novo usuário é criado, o trigger `handle_new_user` cria o perfil e o papel (`user_roles`), mas **não insere o registro na tabela `user_tenants`**. Como todas as tabelas principais (companies, deals, contacts, orders) possuem uma política RLS de isolamento por tenant que exige:

```
tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
```

...qualquer usuário sem registro em `user_tenants` simplesmente **não enxerga nenhum dado**. Isso afeta 7 usuários atualmente.

A empresa BRASIL ATACADISTA foi cadastrada corretamente, mas como a dona (FERNANDA CAVAGNARI) e possivelmente você estão entre os afetados, ela não aparece nas buscas.

### Plano de Correção (2 partes)

**1. Corrigir o trigger `handle_new_user`** para incluir a inserção automática em `user_tenants` usando o tenant padrão do sistema. Isso garante que todos os usuários futuros já nasçam vinculados ao tenant correto.

**2. Inserir os 7 usuários órfãos** na tabela `user_tenants` via migration, vinculando-os ao tenant `00000000-0000-0000-0000-000000000001`.

### Detalhes Técnicos

Migration SQL:
- `ALTER FUNCTION handle_new_user` para incluir `INSERT INTO user_tenants (user_id, tenant_id)` usando o tenant padrão (primeiro tenant existente ou o fixo).
- `INSERT INTO user_tenants` para os 7 user_ids que estão faltando (`c3532c95...`, `ddc6bbef...`, `b0c32fb7...`, `a84c1670...`, `d0c61da0...`, `592f60c7...`, `13dcab7c...`).

Nenhuma alteração de frontend é necessária. O `create-user` edge function também precisa ser atualizado para inserir em `user_tenants` após criar o usuário.
