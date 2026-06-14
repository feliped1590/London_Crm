import { useEffect } from 'react';
import { useWorkspace } from './WorkspaceContext';

/**
 * Hook opt-in para páginas-piloto reportarem título e estado de "alterações não salvas".
 *
 * Deve ser chamado no componente raiz da página. O `tabId` é injetado pelo
 * WorkspaceHost via prop interna; quando ausente (página rodando fora do
 * Workspace, ex: mobile), o hook é no-op.
 */
export function useWorkspaceTab(
  tabId: string | undefined,
  patch: { title?: string; isDirty?: boolean },
) {
  const { reportTab } = useWorkspace();
  const { title, isDirty } = patch;

  useEffect(() => {
    if (!tabId) return;
    reportTab(tabId, { title, isDirty });
  }, [tabId, title, isDirty, reportTab]);
}
