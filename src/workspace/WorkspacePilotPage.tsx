import { ComponentType, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isWorkspaceTabsEnabled } from '@/config/features';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWorkspace } from './WorkspaceContext';

/**
 * Wrapper para os elementos de Route piloto.
 * - Quando o Workspace está ativo (desktop + flag), apenas dispara
 *   `openOrActivate` para refletir a URL na barra de abas e retorna `null`
 *   (o WorkspaceHost cuida da renderização do componente).
 * - Quando desativado (mobile ou flag off), renderiza o `Fallback` clássico.
 */
export function WorkspacePilotPage({
  Fallback,
}: {
  Fallback: ComponentType<unknown>;
}) {
  const isMobile = useIsMobile();
  const enabled = !isMobile && isWorkspaceTabsEnabled();
  const location = useLocation();
  const { openOrActivate } = useWorkspace();

  useEffect(() => {
    if (!enabled) return;
    openOrActivate(location.pathname + location.search);
  }, [enabled, location.pathname, location.search, openOrActivate]);

  if (enabled) return null;
  return <Fallback />;
}
