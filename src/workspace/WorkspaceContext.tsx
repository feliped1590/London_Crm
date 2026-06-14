import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isWorkspaceTabsEnabled } from '@/config/features';
import { useIsMobile } from '@/hooks/use-mobile';
import { matchWorkspaceRoute } from './registry';

export const MAX_WORKSPACE_TABS = 10;

export interface WorkspaceTab {
  id: string;
  /** path + search inicial usado para montar o MemoryRouter da aba */
  initialPath: string;
  /** path + search "canônico" da aba (atualizado quando ela é ativa) */
  currentPath: string;
  title: string;
  /** Marca de alteração não salva, fornecida pelas páginas via useWorkspaceTab. */
  isDirty: boolean;
  createdAt: number;
  lastActiveAt: number;
}

export type CloseTabReason = 'user' | 'auto';

interface WorkspaceContextValue {
  enabled: boolean;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  openOrActivate: (path: string) => void;
  activate: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  /** Usado pelo hook useWorkspaceTab. */
  reportTab: (tabId: string, patch: { title?: string; isDirty?: boolean }) => void;
  /** Atualiza currentPath quando navegação interna acontece dentro da aba ativa. */
  syncTabPath: (tabId: string, path: string) => void;
  /** Solicita confirmação para fechar; resolve true se o usuário confirmou. */
  requestCloseTab: (tabId: string) => void;
  /** Quando o limite é atingido. */
  blockedReason: string | null;
  clearBlocked: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface PendingClose {
  tabId: string;
  title: string;
}

interface WorkspaceProviderProps {
  children: ReactNode;
  /** Callback chamado quando uma confirmação de fechamento é necessária. */
  onConfirmClose?: (info: PendingClose, confirm: () => void, cancel: () => void) => void;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const isMobile = useIsMobile();
  const enabled = !isMobile && isWorkspaceTabsEnabled();

  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeTabId);
  activeIdRef.current = activeTabId;

  const location = useLocation();
  const navigate = useNavigate();

  // ----- openOrActivate -----
  const openOrActivate = useCallback((path: string) => {
    const matched = matchWorkspaceRoute(path.split('?')[0]);
    if (!matched) return;
    const { tabId, def, params } = matched;
    const now = Date.now();

    setTabs((prev) => {
      const existing = prev.find((t) => t.id === tabId);
      if (existing) {
        return prev.map((t) =>
          t.id === tabId ? { ...t, currentPath: path, lastActiveAt: now } : t,
        );
      }
      // Limite de abas
      if (prev.length >= MAX_WORKSPACE_TABS) {
        const removable = prev
          .filter((t) => !t.isDirty)
          .sort((a, b) => a.lastActiveAt - b.lastActiveAt)[0];
        if (!removable) {
          setBlockedReason(
            `Limite de ${MAX_WORKSPACE_TABS} abas atingido e todas possuem alterações não salvas. Salve ou descarte uma aba para abrir esta.`,
          );
          return prev;
        }
        const filtered = prev.filter((t) => t.id !== removable.id);
        return [
          ...filtered,
          {
            id: tabId,
            initialPath: path,
            currentPath: path,
            title: def.defaultTitle(params),
            isDirty: false,
            createdAt: now,
            lastActiveAt: now,
          },
        ];
      }
      return [
        ...prev,
        {
          id: tabId,
          initialPath: path,
          currentPath: path,
          title: def.defaultTitle(params),
          isDirty: false,
          createdAt: now,
          lastActiveAt: now,
        },
      ];
    });
    setActiveTabId(tabId);
  }, []);

  // ----- activate (clique em aba) -----
  const activate = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return;
      setActiveTabId(tabId);
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, lastActiveAt: Date.now() } : t)),
      );
      // Sincroniza URL do navegador com a aba ativa, sem reabrir tab.
      if (location.pathname + location.search !== tab.currentPath) {
        navigate(tab.currentPath);
      }
    },
    [location.pathname, location.search, navigate],
  );

  // ----- reportTab -----
  const reportTab = useCallback(
    (tabId: string, patch: { title?: string; isDirty?: boolean }) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                title: patch.title ?? t.title,
                isDirty: patch.isDirty ?? t.isDirty,
              }
            : t,
        ),
      );
    },
    [],
  );

  // ----- syncTabPath -----
  const syncTabPath = useCallback((tabId: string, path: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, currentPath: path } : t)),
    );
  }, []);

  // ----- closeTab (sem confirmação — usado após confirmar) -----
  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== tabId);
      // Se fechou a ativa, ativa vizinha
      if (activeIdRef.current === tabId) {
        const neighbor = next[idx] ?? next[idx - 1] ?? null;
        setActiveTabId(neighbor?.id ?? null);
        if (neighbor) navigate(neighbor.currentPath);
      }
      return next;
    });
  }, [navigate]);

  // ----- requestCloseTab (com confirmação se dirty) -----
  const requestCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return;
      if (tab.isDirty) {
        setPendingClose({ tabId, title: tab.title });
      } else {
        closeTab(tabId);
      }
    },
    [closeTab],
  );

  const clearBlocked = useCallback(() => setBlockedReason(null), []);

  // ----- Sincroniza URL externa -> tabs (sidebar, back/forward, etc.) -----
  useEffect(() => {
    if (!enabled) return;
    const full = location.pathname + location.search;
    const matched = matchWorkspaceRoute(location.pathname);
    if (!matched) return;
    const existing = tabsRef.current.find((t) => t.id === matched.tabId);
    if (existing) {
      if (activeIdRef.current !== existing.id) {
        setActiveTabId(existing.id);
      }
      if (existing.currentPath !== full) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === existing.id ? { ...t, currentPath: full, lastActiveAt: Date.now() } : t,
          ),
        );
      }
    } else {
      openOrActivate(full);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, location.pathname, location.search]);

  // ----- beforeunload se alguma aba está dirty -----
  useEffect(() => {
    const anyDirty = tabs.some((t) => t.isDirty);
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [tabs]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      enabled,
      tabs,
      activeTabId,
      openOrActivate,
      activate,
      closeTab,
      reportTab,
      syncTabPath,
      requestCloseTab,
      blockedReason,
      clearBlocked,
    }),
    [enabled, tabs, activeTabId, openOrActivate, activate, closeTab, reportTab, syncTabPath, requestCloseTab, blockedReason, clearBlocked],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {pendingClose && (
        <CloseConfirmInline
          info={pendingClose}
          onConfirm={() => {
            const id = pendingClose.tabId;
            setPendingClose(null);
            closeTab(id);
          }}
          onCancel={() => setPendingClose(null)}
        />
      )}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    // Fallback "desligado" — útil em ambientes sem provider (testes, mobile-only)
    return {
      enabled: false,
      tabs: [],
      activeTabId: null,
      openOrActivate: () => {},
      activate: () => {},
      closeTab: () => {},
      reportTab: () => {},
      syncTabPath: () => {},
      requestCloseTab: () => {},
      blockedReason: null,
      clearBlocked: () => {},
    };
  }
  return ctx;
}

// ---- Confirmação simples (inline para evitar import cíclico no provider) ----
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function CloseConfirmInline({
  info,
  onConfirm,
  onCancel,
}: {
  info: PendingClose;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fechar aba com alterações não salvas?</AlertDialogTitle>
          <AlertDialogDescription>
            A aba <strong>{info.title}</strong> possui alterações que ainda não foram salvas.
            Se fechar agora, essas alterações serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Descartar e fechar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
