Plano de correção definitiva do menu lateral

Diagnóstico

O menu não está “sumindo” por problema visual de CSS. Ele está sendo esvaziado por uma combinação de regra de permissões e estado de carregamento.

O que foi confirmado:
- O usuário atual tem apenas o papel `desenvolvedor`.
- A chamada de permissões do menu (`get_user_module_permissions`) está retornando lista vazia para esse usuário.
- O `AppSidebar` primeiro mostra uma lista provisória enquanto as permissões carregam, mas quando a resposta vazia chega, ele filtra tudo por `canAccess(...)` e não sobra nenhum item de navegação.
- O perfil `desenvolvedor` é tratado como privilegiado no frontend, mas a função de permissões no backend ainda depende de linhas em `role_module_permissions`; como não há permissões configuradas para esse papel, o resultado final fica vazio.

Por isso o comportamento é intermitente:
- ao recarregar/navegar, aparece temporariamente enquanto está carregando;
- quando a validação de permissões termina e volta vazia, os menus desaparecem.

Correção definitiva proposta

1. Corrigir a regra de permissão no frontend
- Ajustar `useModulePermissions` para tratar `admin` e `desenvolvedor` como perfis privilegiados de forma consistente.
- Quando o usuário for privilegiado, `canAccess` deve permitir módulos ativos conhecidos sem depender de permissões granulares retornadas vazias.
- O menu lateral não deve renderizar lista vazia para usuário privilegiado só porque a RPC retornou `[]`.

2. Corrigir a montagem do menu lateral
- Atualizar `AppSidebar` para:
  - usar fallback seguro para perfis privilegiados;
  - nunca apagar todos os menus em uma revalidação transitória;
  - mostrar itens `devOnly` apenas para `desenvolvedor`;
  - preservar comportamento atual para vendedor/atendente/financeiro/etc.

3. Corrigir o prefetch inconsistente
- Em `AppInitializer`, trocar o prefetch antigo de `get_user_modules` para o contrato atual `get_user_module_permissions`.
- Isso evita cache divergente entre a inicialização do app e o hook real usado pelo menu/proteção de rotas.

4. Corrigir a regra no backend para produção
- Criar migração para ajustar `get_user_module_permissions`:
  - `admin` e `desenvolvedor` devem receber todos os módulos ativos como acesso total, sem depender de registros em `role_module_permissions`.
  - demais papéis continuam usando permissões granulares configuradas por perfil.
- Opcionalmente, garantir permissão explícita do módulo `integrations` para `desenvolvedor`, mas a solução principal deve ser pela regra privilegiada, não por remendo de dado.

5. Manter segurança das rotas
- Validar `ProtectedRoute` para garantir que perfis privilegiados não sejam redirecionados indevidamente quando a lista de permissões vier vazia.
- Garantir que usuários comuns continuem bloqueados quando não tiverem permissão real.

6. Validação final
- Executar checagem TypeScript.
- Confirmar via consulta que `get_user_module_permissions` retorna módulos para o usuário desenvolvedor.
- Confirmar que o menu mantém itens após navegação Pipeline -> Cliente -> Pipeline ou Cliente -> outro menu -> Cliente.
- Confirmar que o menu não “pisca” para lista vazia durante revalidações.

Arquivos previstos
- `src/hooks/useModulePermissions.ts`
- `src/components/layout/AppSidebar.tsx`
- `src/components/AppInitializer.tsx`
- `src/components/ProtectedRoute.tsx` se necessário
- Nova migração em `supabase/migrations/...`

Resultado esperado
- O menu lateral não desaparece mais.
- Usuário `desenvolvedor` mantém acesso aos módulos corretamente.
- Usuários comuns continuam respeitando permissões por perfil.
- A causa raiz fica resolvida no frontend e no backend, evitando recorrência em novas navegações ou novas sessões.