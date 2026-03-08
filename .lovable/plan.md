
## Diagnóstico

O erro ocorre porque o trigger de banco de dados `check_deal_owner_consistency` verifica apenas o papel `admin` para bypass, mas o seu usuário (Felipe Duarte) possui o papel `desenvolvedor`. A UI trata `desenvolvedor` como admin (mostra o modal de intervenção corretamente), mas ao executar o INSERT no banco, o trigger bloqueia porque não reconhece `desenvolvedor` como perfil autorizado.

O mesmo problema existe no trigger `check_order_owner_consistency` (pedidos).

## Solução

**Migração SQL** — Atualizar as funções `check_deal_owner_consistency` e `check_order_owner_consistency` para aceitar tanto `admin` quanto `desenvolvedor`:

```sql
-- Trocar:
v_is_admin := public.has_role(auth.uid(), 'admin');

-- Por:
v_is_admin := public.has_role(auth.uid(), 'admin') 
           OR public.has_role(auth.uid(), 'desenvolvedor');
```

Isso alinha o comportamento do banco de dados com a lógica da UI, onde `desenvolvedor` tem autoridade equivalente a `admin`.

## Arquivos Impactados
- Nova migração SQL (única alteração necessária)
