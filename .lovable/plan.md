Plano de correção

1. Corrigir o sumiço dos menus da lateral
- Ajustar o `AppSidebar` para não renderizar a navegação como lista vazia enquanto permissões/papéis ainda estão recarregando.
- Usar o estado `isFullyLoaded` do controle de permissões como barreira de renderização da lista.
- Manter um comportamento seguro: enquanto carrega, exibir o menu com placeholder/estado de carregamento ou manter os itens previamente permitidos, em vez de simplesmente remover todos os menus.
- Revisar a consulta duplicada de papel desenvolvedor no menu lateral para evitar corrida entre `isDeveloper`, permissões e renderização.

2. Corrigir atualização de status dentro do detalhe do negócio
- Padronizar a alteração de etapa feita pelo campo de seleção para usar a mesma lógica do arrastar card.
- Hoje o arrasto envia principalmente `pipeline_stage_id` e só atualiza `stage` quando existe um código legado válido. Já o formulário pode gravar um UUID no campo legado `stage` quando a etapa não possui código legado, causando erro/fragilidade.
- Ajustar o `DealFormDialog`/submit para:
  - salvar sempre `pipeline_stage_id` como identidade real da etapa;
  - manter `stage` somente com valor legado válido quando existir;
  - nunca gravar UUID no campo `stage`;
  - evitar envio de campos desnecessários quando só a etapa foi alterada.

3. Preservar regras de negócio do pipeline
- Manter validações já existentes: permissão de etapa, etapa perdida, checklist, SLA e histórico.
- Garantir que o update pelo select registre histórico e automações da mesma forma que o drag-and-drop.
- Revisar os casos de etapas novas/dinâmicas, onde `pipeline_stages.stage` pode ser nulo.

4. Melhorar diagnóstico de erros
- Trocar o toast genérico “Erro ao atualizar negócio” por mensagem mais útil em modo seguro, registrando o erro técnico no console.
- Isso facilita identificar quando o erro vem de RLS/permissão, enum legado, etapa inválida ou trigger do banco.

5. Validação final
- Executar checagem TypeScript do projeto.
- Fazer busca para confirmar que não há outros pontos gravando `stage` com UUID de etapa.
- Confirmar que as referências do payload `IMP_CLIENTE_V4_TESTE` continuam corretas e não serão alteradas nesta correção.

Arquivos previstos
- `src/components/layout/AppSidebar.tsx`
- `src/components/pipeline/DealFormDialog.tsx`
- `src/pages/Pipeline.tsx`
- `src/hooks/usePipelineData.ts`
- Possivelmente `src/hooks/useModulePermissions.ts`, se necessário para expor melhor estado carregado ao menu

Resultado esperado
- Ao navegar Pipeline → outro menu → Pipeline, os menus laterais não desaparecem.
- Ao alterar a etapa dentro dos detalhes do negócio e clicar em Atualizar, o negócio muda de status sem erro.
- O comportamento fica consistente entre atualização pelo select e movimentação por arrastar o card.