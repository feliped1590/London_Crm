

## Diagnóstico

**Erro**: `invalid input syntax for type uuid: ""`

**Causa raiz**: No `EditUserForm` (Settings.tsx, linha 127), ao vincular um CNPJ, o código faz:

```typescript
tenant_id: profile?.active_tenant_id || ''
```

Quando o usuário sendo editado não tem `active_tenant_id` definido no perfil, o fallback é uma **string vazia `''`**, que é inválida para uma coluna UUID NOT NULL.

## Correção

Em `src/pages/Settings.tsx`, linha ~115-128, na `addLinkMutation`:

1. Buscar o `tenant_id` de forma confiável — usar o tenant da `legal_entity` selecionada como fallback, ou o tenant padrão do sistema.
2. Impedir o insert se não houver `tenant_id` válido, exibindo um toast de erro ao invés de enviar `''`.

**Alteração concreta**: Substituir a lógica do `mutationFn` para:
- Obter o `tenant_id` da entidade jurídica selecionada (`legal_entities.tenant_id`) como fonte primária, já que a entidade já pertence a um tenant.
- Remover o fallback para string vazia.
- Validar antes do insert.

```typescript
mutationFn: async (entityId: string) => {
  if (!userProfile) throw new Error('Profile not found');
  // Get tenant_id from the legal entity itself (reliable source)
  const { data: entity } = await supabase
    .from('legal_entities')
    .select('tenant_id')
    .eq('id', entityId)
    .single();
  if (!entity?.tenant_id) throw new Error('Não foi possível determinar o tenant da entidade');
  const { error } = await supabase.from('user_legal_entities').insert({
    user_id: userProfile.id,
    legal_entity_id: entityId,
    role: 'member',
    tenant_id: entity.tenant_id,
  });
  if (error) throw error;
},
```

Esta abordagem é mais robusta porque usa o `tenant_id` diretamente da entidade jurídica sendo vinculada, eliminando a dependência do `active_tenant_id` do perfil (que pode ser null para usuários recém-criados).

