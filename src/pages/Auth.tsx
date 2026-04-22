import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';
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

  const createSessionAndNavigate = async (userId: string) => {
    const deviceInfo = getDeviceInfo();
    const { data, error } = await supabase.rpc('create_app_session', {
      p_user_id: userId,
      p_device_info: deviceInfo,
      p_ip_address: null,
      p_user_agent: navigator.userAgent.substring(0, 200),
    });

    if (error) {
      console.error('Error creating session:', error);
      toast.error('Erro ao criar sessão');
      return;
    }

    const result = data as any;
    if (result?.success) {
      setSessionId(result.session_id);
      toast.success('Login realizado com sucesso!');
      navigate('/today', { replace: true });
    } else if (result?.error === 'OUTSIDE_ALLOWED_HOURS') {
      // Janela de acesso bloqueia login — single source of truth no banco
      await signOut();
      navigate('/access-blocked', { replace: true });
    } else if (result?.error === 'ACTIVE_SESSION_EXISTS') {
      // Race condition fallback — check again
      const { data: checkData } = await supabase.rpc('check_existing_session', { p_user_id: userId });
      const check = checkData as any;
      if (check?.has_active) {
        setPendingUserId(userId);
        setActiveSessionInfo(check.session);
        setShowSessionModal(true);
      }
    } else {
      // Fallback: resposta inesperada (não-success sem erro conhecido)
      console.error('Resposta inesperada de create_app_session:', result);
      toast.error('Erro inesperado ao validar acesso');
    }
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
      setPendingUserId(null);
      setActiveSessionInfo(null);
      await signOut();
      navigate('/access-blocked', { replace: true });
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden mb-4">
            <img src="/images/logo-qualyvac.jpeg" alt="Qualyvac" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            CRM <span className="text-primary">Qualyvac Group</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Sistema de gestão de relacionamento com clientes
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>Entrar</CardTitle>
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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
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

        <p className="text-center text-sm text-muted-foreground mt-6">
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
