import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { ActiveSessionModal } from '@/components/auth/ActiveSessionModal';
import { setSessionId, clearSessionId } from '@/hooks/useSessionGuard';
import { fetchAccessBlockedInfo } from '@/lib/accessWindowInfo';

const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'Senha deve ter pelo menos 6 caracteres');

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Navegador';
}

function isAccessWindowBlockError(error: { message?: string; details?: string } | null) {
  if (!error) return false;

  const message = (error.message || '').toLowerCase();
  const details = (error.details || '').toLowerCase();

  return (
    message.includes('outside_allowed_hours') ||
    message.includes('horário') ||
    (
      message.includes('target_owner_id') &&
      details.includes('access_violation_log') &&
      details.includes('outside_allowed_hours')
    )
  );
}

function isSessionRpcUnavailableError(error: { message?: string; details?: string; code?: string } | null) {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();

  return (
    code === 'PGRST202' ||
    message.includes('could not find the function public.create_app_session') ||
    message.includes('could not find the function public.check_existing_session') ||
    message.includes('could not find the function public.force_replace_session') ||
    details.includes('does not exist')
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading, signIn, signOut } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Active session modal state
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [activeSessionInfo, setActiveSessionInfo] = useState<any>(null);
  const [isReplacingSession, setIsReplacingSession] = useState(false);
  // Keep user ref for session creation after signIn
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !showSessionModal && !pendingUserId) {
      const sid = localStorage.getItem('app_session_id');
      if (sid) {
        navigate('/today', { replace: true });
      }
    }
  }, [user, loading, navigate, showSessionModal, pendingUserId]);

  const fallbackLoginWithoutAppSession = () => {
    clearSessionId();
    toast.success('Login realizado com sucesso!');
    navigate('/today', { replace: true });
  };

  const createSessionAndNavigate = async (userId: string): Promise<boolean> => {
    const deviceInfo = getDeviceInfo();
    const { data, error } = await supabase.rpc('create_app_session', {
      p_user_id: userId,
      p_device_info: deviceInfo,
      p_ip_address: null,
      p_user_agent: navigator.userAgent.substring(0, 200),
    });

    if (error) {
      if (isAccessWindowBlockError(error)) {
        await redirectToAccessBlocked(userId);
        return false;
      }
      if (isSessionRpcUnavailableError(error)) {
        console.warn('RPC de sessão indisponível. Seguindo com login padrão.', error);
        fallbackLoginWithoutAppSession();
        return true;
      }
      console.error('Error creating session:', error);
      toast.error('Erro ao criar sessão');
      return false;
    }

    const result = data as any;
    if (result?.success) {
      setSessionId(result.session_id);
      toast.success('Login realizado com sucesso!');
      navigate('/today', { replace: true });
      return true;
    } else if (result?.error === 'OUTSIDE_ALLOWED_HOURS') {
      // Janela de acesso bloqueia login — single source of truth no banco
      await redirectToAccessBlocked(userId);
      return false;
    } else if (result?.error === 'ACTIVE_SESSION_EXISTS') {
      // Race condition fallback — check again
      const { data: checkData } = await supabase.rpc('check_existing_session', { p_user_id: userId });
      const check = checkData as any;
      if (check?.has_active) {
        setPendingUserId(userId);
        setActiveSessionInfo(check.session);
        setShowSessionModal(true);
      }
      return false;
    } else {
      // Fallback: resposta inesperada (não-success sem erro conhecido)
      console.error('Resposta inesperada de create_app_session:', result);
      toast.error('Erro inesperado ao validar acesso');
      return false;
    }
  };

  const redirectToAccessBlocked = async (userId: string) => {
    // Coleta info ANTES do signOut (precisa do token)
    const info = await fetchAccessBlockedInfo(userId);
    await signOut();
    navigate('/access-blocked', { replace: true, state: { info } });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      setIsSubmitting(false);
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else {
        toast.error('Erro ao fazer login: ' + error.message);
      }
      return;
    }

    // Auth succeeded — get current user
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setIsSubmitting(false);
      toast.error('Erro ao obter dados do usuário');
      return;
    }
    // Janela de acesso é validada dentro de create_app_session/force_replace_session
    // (single source of truth no banco — sem dupla checagem aqui)

    // Check for existing session
    const { data: checkData, error: checkError } = await supabase.rpc('check_existing_session', {
      p_user_id: currentUser.id,
    });

    if (checkError) {
      if (isSessionRpcUnavailableError(checkError)) {
        console.warn('RPC de sessão indisponível em check_existing_session. Seguindo com login padrão.', checkError);
        fallbackLoginWithoutAppSession();
        setIsSubmitting(false);
        return;
      }
      console.error('Error checking session:', checkError);
      // Proceed to create session anyway
      await createSessionAndNavigate(currentUser.id);
      setIsSubmitting(false);
      return;
    }

    const check = checkData as any;

    if (check?.has_active) {
      // Show modal
      setPendingUserId(currentUser.id);
      setActiveSessionInfo(check.session);
      setShowSessionModal(true);
      setIsSubmitting(false);
    } else {
      // No active session — create one
      await createSessionAndNavigate(currentUser.id);
      setIsSubmitting(false);
    }
  };

  const handleCancelSession = async () => {
    setShowSessionModal(false);
    setActiveSessionInfo(null);
    setPendingUserId(null);
    clearSessionId();
    await signOut();
  };

  const handleReplaceSession = async () => {
    if (!pendingUserId) return;
    setIsReplacingSession(true);

    const deviceInfo = getDeviceInfo();
    const { data, error } = await supabase.rpc('force_replace_session', {
      p_user_id: pendingUserId,
      p_device_info: deviceInfo,
      p_ip_address: null,
      p_user_agent: navigator.userAgent.substring(0, 200),
    });

    if (error) {
      if (isAccessWindowBlockError(error)) {
        setShowSessionModal(false);
        setActiveSessionInfo(null);
        await redirectToAccessBlocked(pendingUserId);
        setPendingUserId(null);
        setIsReplacingSession(false);
        return;
      }
      if (isSessionRpcUnavailableError(error)) {
        console.warn('RPC de sessão indisponível em force_replace_session. Seguindo com login padrão.', error);
        setShowSessionModal(false);
        setPendingUserId(null);
        setActiveSessionInfo(null);
        fallbackLoginWithoutAppSession();
        setIsReplacingSession(false);
        return;
      }
      toast.error('Erro ao substituir sessão');
      setIsReplacingSession(false);
      return;
    }

    const result = data as any;
    if (result?.success) {
      setSessionId(result.session_id);
      setShowSessionModal(false);
      setPendingUserId(null);
      setActiveSessionInfo(null);
      toast.success('Login realizado com sucesso!');
      navigate('/today', { replace: true });
    } else if (result?.error === 'OUTSIDE_ALLOWED_HOURS') {
      setShowSessionModal(false);
      setActiveSessionInfo(null);
      await redirectToAccessBlocked(pendingUserId);
      setPendingUserId(null);
    } else if (result?.error) {
      toast.error('Erro ao criar nova sessão: ' + result.error);
    } else {
      // Fallback: resposta inesperada (não-success sem erro conhecido)
      console.error('Resposta inesperada de force_replace_session:', result);
      toast.error('Erro inesperado ao validar acesso');
    }
    setIsReplacingSession(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh p-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gradient-brand opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gradient-brand-soft opacity-20 blur-3xl" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/london-logo.png" alt="London" className="mx-auto h-16 w-16 rounded-2xl ring-1 ring-border-subtle shadow-[var(--shadow-md)] object-cover mb-4" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            CRM <span className="text-gradient-brand">London</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sistema de gestão de relacionamento com clientes
          </p>
        </div>

        <Card className="surface-glass border-border-subtle shadow-[var(--shadow-xl)]">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-display text-xl">Entrar</CardTitle>
            <CardDescription>
              Acesse sua conta para continuar
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-gradient-brand hover:opacity-95 shadow-[var(--shadow-md)] transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>

      <ActiveSessionModal
        open={showSessionModal}
        session={activeSessionInfo}
        isLoading={isReplacingSession}
        onCancel={handleCancelSession}
        onReplace={handleReplaceSession}
      />
    </div>
  );
}
