

# Correção das Roles de Usuário

## Situação Atual (Incorreta)

| E-mail | Nome | Role Atual |
|--------|------|------------|
| felipeduarte1590@hotmail.com | Felipe Duarte (Você) | admin |
| bianca.mello@qualyvac.com.br | Bianca | admin |
| felipe.duarte.univest@gmail.com | Jonatan | vendedor |
| fdkdigital2@gmail.com | José | desenvolvedor ❌ |

---

## Correções Necessárias

### Operação 1: Reverter José para atendente

```sql
UPDATE public.user_roles 
SET role = 'atendente' 
WHERE user_id = 'a3d2d266-1d82-437f-b05c-4136fe9441a6';
```

### Operação 2: Alterar você para desenvolvedor

```sql
UPDATE public.user_roles 
SET role = 'desenvolvedor' 
WHERE user_id = '84652ee7-a841-4702-880d-a75952b22aeb';
```

---

## Resultado Final Esperado

| E-mail | Nome | Role |
|--------|------|------|
| bianca.mello@qualyvac.com.br | Bianca | admin |
| fdkdigital2@gmail.com | José | atendente |
| felipe.duarte.univest@gmail.com | Jonatan | vendedor |
| felipeduarte1590@hotmail.com | Felipe Duarte | desenvolvedor |

---

## Efeitos para Você (Felipe Duarte)

Após a correção:
- Você não aparecerá mais na lista de usuários em Configurações
- Você não será contabilizado no limite de licenças (4 para 3 usuários)
- Você manterá todas as permissões de administrador (o role desenvolvedor tem acesso total)

---

## Detalhes Técnicos

A alteração será feita via migração SQL que executará ambos os UPDATEs em uma única transação, garantindo que as mudanças sejam atômicas.

