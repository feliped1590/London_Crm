import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveTenantId } from '@/hooks/useActiveTenantId';
import {
  type DraftBaseline,
  type DraftEnvelope,
  type DraftScope,
  clearDraft,
  loadDraft,
  saveDraft,
} from './drafts';

interface UseFormDraftOptions<T> {
  /** Identificador estável do contexto. Ex: "orders:new" | "orders:<id>". `null` desativa o hook. */
  context: string | null;
  /**
   * Snapshot atual do formulário. O hook chama isso debounced para salvar.
   * Deve retornar `null` quando o form ainda não está pronto/tocado (evita drafts vazios).
   */
  buildSnapshot: () => T | null;
  /** Aplica os dados restaurados no form. */
  applyDraft: (data: T) => void;
  /** Valor do snapshot do registro vindo do banco (para detectar conflito). Opcional. */
  baseline?: DraftBaseline | null;
  /**
   * Habilita o hook. Quando false, nada acontece (não salva, não carrega).
   * Útil para evitar rodar antes de o form estar montado/aberto.
   */
  enabled?: boolean;
  /** Intervalo de debounce do save (ms). Default 600. */
  debounceMs?: number;
  /** Título exibido pela barra de abas (opcional). */
  title?: string;
}

type RestoreState =
  | { status: 'idle' }
  | { status: 'pending'; envelope: DraftEnvelope<unknown>; conflict: boolean };

export interface UseFormDraftResult {
  /** Tem rascunho aguardando decisão do usuário? */
  restorePending: boolean;
  /** O registro foi alterado por outra sessão entre o save e o retorno? */
  restoreConflict: boolean;
  /** Quando foi salvo o último rascunho (epoch ms) — útil para mostrar "há X min". */
  draftSavedAt: number | null;
  /** Aplica o rascunho aguardando. */
  acceptRestore: () => void;
  /** Descarta o rascunho aguardando + remove do storage. */
  discardRestore: () => void;
  /** Remove o draft (usado após save com sucesso). */
  clear: () => void;
  /** Marca o form como "tocado" — habilita save subsequente. */
  markDirty: () => void;
  /** Salva imediatamente (sem debounce). Útil em onBeforeUnload. */
  flush: () => void;
  /** O usuário já decidiu (aceitou ou descartou) nesta montagem? */
  decided: boolean;
}

/**
 * Hook genérico que persiste o estado do formulário em sessionStorage,
 * escopado por tenant + usuário, e oferece um handshake de restauração.
 *
 * Padrão de uso:
 *
 *   const draft = useFormDraft({
 *     context: isEditMode ? `orders:${order.id}` : 'orders:new',
 *     enabled: open,
 *     buildSnapshot: () => (touched ? currentFormState : null),
 *     applyDraft: (data) => hydrateFormFromData(data),
 *     baseline: order ? { updatedAt: order.updated_at } : null,
 *   });
 *
 *   // Quando salvar com sucesso:
 *   draft.clear();
 *
 *   // Modal de restauração:
 *   {draft.restorePending && (
 *     <DraftRestoreDialog
 *       conflict={draft.restoreConflict}
 *       onRestore={draft.acceptRestore}
 *       onDiscard={draft.discardRestore}
 *     />
 *   )}
 */
export function useFormDraft<T>({
  context,
  buildSnapshot,
  applyDraft,
  baseline,
  enabled = true,
  debounceMs = 600,
  title,
}: UseFormDraftOptions<T>): UseFormDraftResult {
  const { user } = useAuth();
  const { data: tenantId } = useActiveTenantId();

  const scope = useMemo<DraftScope>(
    () => ({ tenantId: tenantId ?? null, userId: user?.id ?? null }),
    [tenantId, user?.id],
  );

  const [restore, setRestore] = useState<RestoreState>({ status: 'idle' });
  const [decided, setDecided] = useState(false);
  const [touched, setTouched] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  const buildSnapshotRef = useRef(buildSnapshot);
  buildSnapshotRef.current = buildSnapshot;
  const applyDraftRef = useRef(applyDraft);
  applyDraftRef.current = applyDraft;
  const baselineRef = useRef<DraftBaseline | null | undefined>(baseline);
  baselineRef.current = baseline;
  const titleRef = useRef<string | undefined>(title);
  titleRef.current = title;

  const active = enabled && !!context && !!scope.tenantId && !!scope.userId;

  // -------- Detecta rascunho na entrada --------
  useEffect(() => {
    if (!active || !context) {
      setRestore({ status: 'idle' });
      setDecided(false);
      setTouched(false);
      setDraftSavedAt(null);
      return;
    }
    const env = loadDraft<T>(scope, context);
    if (!env) {
      setRestore({ status: 'idle' });
      setDecided(true); // não há nada a decidir
      return;
    }
    const currentUpdatedAt = baselineRef.current?.updatedAt ?? null;
    const savedUpdatedAt = env.baseline?.updatedAt ?? null;
    const conflict = !!savedUpdatedAt && !!currentUpdatedAt && savedUpdatedAt !== currentUpdatedAt;
    setRestore({ status: 'pending', envelope: env as DraftEnvelope<unknown>, conflict });
    setDecided(false);
    setDraftSavedAt(env.savedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, context, scope.tenantId, scope.userId]);

  // -------- Save debounced após qualquer mudança --------
  useEffect(() => {
    if (!active || !context || !decided || !touched) return;
    const handle = window.setTimeout(() => {
      const snapshot = buildSnapshotRef.current();
      if (snapshot === null || snapshot === undefined) return;
      const ok = saveDraft(scope, context, snapshot, {
        baseline: baselineRef.current ?? undefined,
        title: titleRef.current,
      });
      if (ok) setDraftSavedAt(Date.now());
    }, debounceMs);
    return () => window.clearTimeout(handle);
    // Reexecuta no próximo tick após qualquer setState do consumidor — usamos
    // `Date.now()` indireto através do `touched` toggle, mas a forma simples é
    // re-rodar a cada render quando ativo.
  });

  // -------- Save final no unmount + beforeunload --------
  useEffect(() => {
    if (!active || !context) return;
    const flushNow = () => {
      if (!touched || !decided) return;
      const snapshot = buildSnapshotRef.current();
      if (snapshot === null || snapshot === undefined) return;
      saveDraft(scope, context, snapshot, {
        baseline: baselineRef.current ?? undefined,
        title: titleRef.current,
      });
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!touched || !decided) return;
      flushNow();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      flushNow();
    };
  }, [active, context, scope.tenantId, scope.userId, touched, decided]);

  const acceptRestore = useCallback(() => {
    if (restore.status !== 'pending') return;
    try {
      applyDraftRef.current(restore.envelope.data as T);
    } catch (err) {
      console.warn('[useFormDraft] applyDraft falhou', err);
    }
    setRestore({ status: 'idle' });
    setDecided(true);
    setTouched(true); // já que restaurou, qualquer alteração posterior gera novo save
  }, [restore]);

  const discardRestore = useCallback(() => {
    if (!context) return;
    clearDraft(scope, context);
    setRestore({ status: 'idle' });
    setDecided(true);
    setDraftSavedAt(null);
  }, [context, scope]);

  const clear = useCallback(() => {
    if (!context) return;
    clearDraft(scope, context);
    setDraftSavedAt(null);
    setTouched(false);
  }, [context, scope]);

  const markDirty = useCallback(() => {
    if (!touched) setTouched(true);
  }, [touched]);

  const flush = useCallback(() => {
    if (!active || !context || !decided) return;
    const snapshot = buildSnapshotRef.current();
    if (snapshot === null || snapshot === undefined) return;
    const ok = saveDraft(scope, context, snapshot, {
      baseline: baselineRef.current ?? undefined,
      title: titleRef.current,
    });
    if (ok) setDraftSavedAt(Date.now());
  }, [active, context, scope, decided]);

  return {
    restorePending: restore.status === 'pending',
    restoreConflict: restore.status === 'pending' && restore.conflict,
    draftSavedAt,
    acceptRestore,
    discardRestore,
    clear,
    markDirty,
    flush,
    decided,
  };
}
