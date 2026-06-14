/**
 * Workspace v1 — store de rascunhos de formulário em sessionStorage.
 *
 * Diretrizes:
 *  - Escopo estrito por tenant + user. Nunca expor draft de outro usuário/tenant.
 *  - TTL de 7 dias (drafts antigos são silenciosamente descartados).
 *  - Versionamento do schema (`version: 1`) para invalidar rascunhos antigos.
 *  - Não serializar File/Blob/tokens — caller é responsável por sanitizar `data`.
 *  - Tudo é defensivo: try/catch em parse/stringify; falhas são silenciosas + log.
 */

export const DRAFT_SCHEMA_VERSION = 1 as const;
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
export const DRAFT_MAX_BYTES = 256 * 1024; // 256KB por draft
const KEY_PREFIX = 'draft:v1';

export interface DraftBaseline {
  updatedAt?: string | null;
  hash?: string | null;
}

export interface DraftEnvelope<T = unknown> {
  version: typeof DRAFT_SCHEMA_VERSION;
  tenantId: string;
  userId: string;
  context: string;
  savedAt: number;
  data: T;
  baseline?: DraftBaseline;
  title?: string;
}

export interface DraftScope {
  tenantId: string | null | undefined;
  userId: string | null | undefined;
}

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function buildKey(scope: DraftScope, context: string): string | null {
  if (!scope.tenantId || !scope.userId || !context) return null;
  return `${KEY_PREFIX}:${scope.tenantId}:${scope.userId}:${context}`;
}

function parseKey(key: string): { tenantId: string; userId: string; context: string } | null {
  // draft:v1:<tenant>:<user>:<context...>
  if (!key.startsWith(`${KEY_PREFIX}:`)) return null;
  const rest = key.slice(KEY_PREFIX.length + 1);
  const firstColon = rest.indexOf(':');
  if (firstColon < 0) return null;
  const tenantId = rest.slice(0, firstColon);
  const afterTenant = rest.slice(firstColon + 1);
  const secondColon = afterTenant.indexOf(':');
  if (secondColon < 0) return null;
  const userId = afterTenant.slice(0, secondColon);
  const context = afterTenant.slice(secondColon + 1);
  if (!tenantId || !userId || !context) return null;
  return { tenantId, userId, context };
}

function isExpired(envelope: DraftEnvelope): boolean {
  return Date.now() - envelope.savedAt > DRAFT_TTL_MS;
}

export function saveDraft<T>(
  scope: DraftScope,
  context: string,
  data: T,
  options?: { baseline?: DraftBaseline; title?: string },
): boolean {
  const storage = safeSessionStorage();
  const key = buildKey(scope, context);
  if (!storage || !key) return false;
  try {
    const envelope: DraftEnvelope<T> = {
      version: DRAFT_SCHEMA_VERSION,
      tenantId: scope.tenantId!,
      userId: scope.userId!,
      context,
      savedAt: Date.now(),
      data,
      baseline: options?.baseline,
      title: options?.title,
    };
    const serialized = JSON.stringify(envelope);
    if (serialized.length > DRAFT_MAX_BYTES) {
      console.warn(`[drafts] draft "${context}" excede ${DRAFT_MAX_BYTES} bytes — não salvo`);
      return false;
    }
    storage.setItem(key, serialized);
    return true;
  } catch (err) {
    console.warn('[drafts] falha ao salvar', err);
    return false;
  }
}

export function loadDraft<T>(scope: DraftScope, context: string): DraftEnvelope<T> | null {
  const storage = safeSessionStorage();
  const key = buildKey(scope, context);
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as DraftEnvelope<T>;
    if (
      !envelope ||
      envelope.version !== DRAFT_SCHEMA_VERSION ||
      envelope.tenantId !== scope.tenantId ||
      envelope.userId !== scope.userId ||
      envelope.context !== context
    ) {
      storage.removeItem(key);
      return null;
    }
    if (isExpired(envelope)) {
      storage.removeItem(key);
      return null;
    }
    return envelope;
  } catch (err) {
    console.warn('[drafts] falha ao carregar', err);
    try { storage.removeItem(key); } catch { /* noop */ }
    return null;
  }
}

export function clearDraft(scope: DraftScope, context: string): void {
  const storage = safeSessionStorage();
  const key = buildKey(scope, context);
  if (!storage || !key) return;
  try { storage.removeItem(key); } catch { /* noop */ }
}

export function hasDraft(scope: DraftScope, context: string): boolean {
  return loadDraft(scope, context) !== null;
}

export interface DraftListItem {
  context: string;
  savedAt: number;
  title?: string;
}

/** Lista drafts ativos do par tenant+user atual, descartando expirados/órfãos. */
export function listDrafts(scope: DraftScope): DraftListItem[] {
  const storage = safeSessionStorage();
  if (!storage || !scope.tenantId || !scope.userId) return [];
  const out: DraftListItem[] = [];
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    const parsed = parseKey(key);
    if (!parsed) continue;
    if (parsed.tenantId !== scope.tenantId || parsed.userId !== scope.userId) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const env = JSON.parse(raw) as DraftEnvelope;
      if (env.version !== DRAFT_SCHEMA_VERSION || isExpired(env)) {
        toRemove.push(key);
        continue;
      }
      out.push({ context: env.context, savedAt: env.savedAt, title: env.title });
    } catch {
      toRemove.push(key);
    }
  }
  for (const k of toRemove) {
    try { storage.removeItem(k); } catch { /* noop */ }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/** Remove TODOS os drafts do storage (usado no logout). */
export function clearAllDrafts(): void {
  const storage = safeSessionStorage();
  if (!storage) return;
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(`${KEY_PREFIX}:`)) toRemove.push(key);
  }
  for (const k of toRemove) {
    try { storage.removeItem(k); } catch { /* noop */ }
  }
}
