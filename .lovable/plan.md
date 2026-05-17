
# Configuração "Timeout de Inatividade" — diagnóstico e correção

## Serve? Sim, mas só **parcialmente**.

### Onde JÁ funciona (backend)
O valor salvo em `tenant_settings.session_idle_timeout_minutes` é lido pela função `get_session_idle_timeout_minutes()` e usada por:
- `validate_app_session` — invalida `app_sessions` quando `expires_at < now()`.
- `touch_app_session` — estende `expires_at = now() + timeout`.
- Job de limpeza periódica.

Ou seja: o **servidor** respeita os 90 min configurados. Quando expira, a próxima validação client-side (a cada 60 s) detecta `valid=false reason=idle_timeout` e desloga.

### Onde NÃO funciona (cliente)
No `useSessionGuard.ts` que acabei de entregar nas Fases 1-2 o idle timer client-side está **hardcoded em 30 min**:

```ts
const IDLE_TIMEOUT_MS = 30 * 60_000; // 30min — client-side idle logout
```

Resultado: independentemente de o admin configurar 90, 120 ou 1440 min, o cliente derruba a sessão em 30 min. **A configuração da tela está sendo silenciosamente ignorada pelo watchdog client-side.**

Também há um efeito colateral: o heartbeat só "toca" o backend a cada 5 min E só se houve atividade recente. Com timeout backend de 90 min isso é folgado. Mas se alguém configurar < 5 min, o backend pode expirar antes do primeiro touch.

---

## Plano de correção

1. **Buscar o timeout configurado** uma vez, via React Query (`queryKey: ['session_idle_timeout']`, `staleTime: 5min`) — já existe esse hook em `ActiveSessionsManager`, vamos extrair para `src/hooks/useSessionIdleTimeout.ts` reutilizável.
2. **Wire no `useSessionGuard`**:
   - Substituir constante `IDLE_TIMEOUT_MS` pelo valor do hook (`* 60_000`).
   - Fallback para 30 min se a query ainda não resolveu.
   - Passar para `useIdleTimeout({ idleMs: configuredMs, ... })`.
3. **Ajustar heartbeat dinâmico**: `HEARTBEAT_INTERVAL = max(60s, timeout/3)` para garantir que o `touch_app_session` rode antes do backend expirar, mesmo em configurações curtas (5–15 min).
4. **Refetch ao alterar a configuração**: quando admin salva novo timeout, o `invalidateQueries(['session_idle_timeout'])` já existente vai disparar refetch — o `useIdleTimeout` reinicia com novo valor automaticamente (deps mudam).
5. **Texto da UI**: ajustar copy para deixar claro que vale para todos os usuários do tenant (já está, mas confirmar).

### Arquivos alterados
- `src/hooks/useSessionIdleTimeout.ts` — **novo** (hook compartilhado).
- `src/hooks/useSessionGuard.ts` — usa o hook; constante `IDLE_TIMEOUT_MS` removida; `HEARTBEAT_INTERVAL` derivado.
- `src/components/settings/ActiveSessionsManager.tsx` — passa a consumir o mesmo hook (single source of truth).

### Validação
- Salvar 5 min → ficar parado → confirmar logout local em ~5 min com toast.
- Salvar 90 min → confirmar que cliente não desloga em 30 min.
- Trocar valor com aba aberta → próximo tick respeita o novo valor (sem reload).

### Sem mudanças no banco
A função RPC já existe e está correta. Apenas o client estava ignorando.

Posso seguir e implementar?
