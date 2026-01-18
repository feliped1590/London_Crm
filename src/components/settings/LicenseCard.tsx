import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Users, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

interface LicenseStatus {
  current_users: number;
  max_users: number;
  plan_name: string;
  can_add_user: boolean;
  usage_percentage: number;
  valid_until: string | null;
}

const planLabels: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export function LicenseCard() {
  const { data: licenseStatus, isLoading, error } = useQuery({
    queryKey: ['license_status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_license_status');
      if (error) throw error;
      // RPC returns an array, get the first element
      const result = Array.isArray(data) ? data[0] : data;
      return result as LicenseStatus;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !licenseStatus) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar informações da licença
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = licenseStatus.usage_percentage;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = !licenseStatus.can_add_user;
  const remainingUsers = licenseStatus.max_users - licenseStatus.current_users;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Licença do Sistema</CardTitle>
          </div>
          <Badge variant={isAtLimit ? 'destructive' : isNearLimit ? 'secondary' : 'default'}>
            {planLabels[licenseStatus.plan_name] || licenseStatus.plan_name}
          </Badge>
        </div>
        <CardDescription>
          Gerenciamento de licenças e usuários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Usuários
            </span>
            <span className="font-medium">
              {licenseStatus.current_users} de {licenseStatus.max_users}
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className={isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}
          />
          <p className="text-xs text-muted-foreground text-right">
            {usagePercentage.toFixed(0)}% utilizado
          </p>
        </div>

        {/* Status Alert */}
        {isAtLimit ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Limite atingido!</span> Você não pode adicionar mais usuários. 
              Entre em contato para aumentar sua licença.
            </AlertDescription>
          </Alert>
        ) : isNearLimit ? (
          <Alert>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription>
              <span className="font-medium">Próximo do limite!</span> Você pode adicionar mais {remainingUsers} usuário{remainingUsers !== 1 ? 's' : ''}.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Você pode adicionar mais {remainingUsers} usuário{remainingUsers !== 1 ? 's' : ''}.
            </AlertDescription>
          </Alert>
        )}

        {/* Upgrade Button */}
        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={() => {
            // TODO: Implement upgrade flow or contact
            window.open('mailto:suporte@exemplo.com?subject=Solicitação de aumento de licença', '_blank');
          }}
        >
          <ExternalLink className="h-4 w-4" />
          {isAtLimit ? 'Solicitar aumento de licença' : 'Fazer upgrade do plano'}
        </Button>
      </CardContent>
    </Card>
  );
}
