/**
 * Feature flags do projeto.
 *
 * WHATSAPP_ENABLED: quando `false`, todo o módulo de WhatsApp é desativado
 * (rota, sidebar, queries, realtime, polling). Decisão tomada na auditoria
 * de performance 2026-05 para reduzir Disk IO e processamento. Reativar
 * trocando para `true` e nada mais precisa ser alterado.
 */
export const WHATSAPP_ENABLED = false;

/**
 * WORKSPACE_TABS_ENABLED: ativa a barra de abas de trabalho (Workspace) que
 * preserva o estado dos formulários ao alternar entre módulos.
 *
 * v1 piloto: apenas Pedidos e Clientes (lista, novo, detalhe). Mobile sempre
 * usa a navegação clássica, independentemente desta flag. Para ativação
 * controlada em produção, é possível sobrescrever via localStorage:
 *   localStorage.setItem('workspace_tabs_enabled', 'true' | 'false')
 */
const DEFAULT_WORKSPACE_TABS_ENABLED = true;

export function isWorkspaceTabsEnabled(): boolean {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_TABS_ENABLED;
  try {
    const override = window.localStorage.getItem('workspace_tabs_enabled');
    if (override === 'true') return true;
    if (override === 'false') return false;
  } catch {
    /* ignore */
  }
  return DEFAULT_WORKSPACE_TABS_ENABLED;
}
