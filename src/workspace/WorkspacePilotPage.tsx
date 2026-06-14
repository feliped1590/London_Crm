import { ComponentType } from 'react';
import { isWorkspaceTabsEnabled } from '@/config/features';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Wrapper para os elementos de Route piloto.
 * - Quando o Workspace está ativo (desktop + flag), retorna `null` — o
 *   WorkspaceProvider observa o `useLocation` do BrowserRouter e abre/ativa
 *   a aba correspondente; o WorkspaceHost cuida da renderização real.
 * - Quando desativado (mobile ou flag off), renderiza o `Fallback` clássico.
 */
export function WorkspacePilotPage({
  Fallback,
}: {
  Fallback: ComponentType<unknown>;
}) {
  const isMobile = useIsMobile();
  const enabled = !isMobile && isWorkspaceTabsEnabled();
  if (enabled) return null;
  return <Fallback />;
}
