

# Correção: Atribuir Roles Corretamente

## Estado Atual (Incorreto)

| E-mail | Nome | Role Atual | Role Correto |
|--------|------|------------|--------------|
| fdkdigital2@gmail.com | José | desenvolvedor ❌ | atendente |
| felipeduarte1590@hotmail.com | Felipe Duarte (Você) | admin | desenvolvedor |

---

## Operações Necessárias

### 1. Reverter José para atendente

```sql
UPDATE public.user_roles 
SET role = 'atendente' 
WHERE user_id = 'a3d2d266-1d82-437f-b05c-4136fe9441a6';
```

### 2. Alterar você para desenvolvedor

```sql
UPDATE public.user_roles 
SET role = 'desenvolvedor' 
WHERE user_id = '84652ee7-a841-4702-880d-a75952b22aeb';
```

---

## Resultado Final

| E-mail | Nome | Role |
|--------|------|------|
| bianca.mello@qualyvac.com.br | Bianca | admin |
| fdkdigital2@gmail.com | José | atendente |
| felipe.duarte.univest@gmail.com | Jonatan | vendedor |
| felipeduarte1590@hotmail.com | Felipe Duarte | desenvolvedor |

**Efeitos para você (Felipe Duarte):**
- Não aparecerá mais na lista de usuários em Configurações
- Não será contabilizado no limite de licenças (4 → 3 usuários contados)
- Manterá todas as permissões de administrador

