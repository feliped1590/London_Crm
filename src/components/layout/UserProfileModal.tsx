import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Shield } from 'lucide-react';

interface UserProfileModalProps {
  children: React.ReactNode;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'bg-red-500' },
  vendedor: { label: 'Vendedor', color: 'bg-blue-500' },
  atendente: { label: 'Atendente', color: 'bg-green-500' },
  desenvolvedor: { label: 'Desenvolvedor', color: 'bg-purple-500' },
};

export function UserProfileModal({ children }: UserProfileModalProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['user-profile-modal', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  const { data: userRole } = useQuery({
    queryKey: ['user-role-modal', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  const roleConfig = userRole?.role ? roleLabels[userRole.role] : { label: 'Usuário', color: 'bg-gray-500' };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold">
              {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>

          {/* Profile Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <User className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="font-medium truncate">
                  {profile?.full_name || 'Não informado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="font-medium truncate">
                  {user?.email || 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Tipo de Acesso</p>
                <Badge className={`${roleConfig.color} mt-1`}>
                  {roleConfig.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
