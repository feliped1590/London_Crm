import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SalesRep {
  id: string;
  name: string;
  type: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  tenant_id: string;
  created_at: string;
}

export interface UserSalesRep {
  id: string;
  user_id: string;
  sales_rep_id: string;
  is_default: boolean;
  created_at: string;
  sales_rep?: SalesRep;
}

export function useSalesReps() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // All sales reps (admin view)
  const { data: salesReps, isLoading } = useQuery({
    queryKey: ['sales_reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_reps')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as SalesRep[];
    },
  });

  // Current user's linked sales reps
  const { data: mySalesReps } = useQuery({
    queryKey: ['my_sales_reps', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_sales_reps')
        .select('*, sales_rep:sales_reps(*)')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        sales_rep: d.sales_rep as SalesRep,
      })) as UserSalesRep[];
    },
    enabled: !!user?.id,
  });

  // Active sales reps for current user (for select dropdowns)
  const myActiveSalesReps = mySalesReps
    ?.filter(usr => usr.sales_rep?.active)
    ?.map(usr => usr.sales_rep!)
    || [];

  const defaultSalesRepId = mySalesReps?.find(usr => usr.is_default)?.sales_rep_id || null;

  // All user-sales-rep links (admin)
  const { data: allUserSalesReps } = useQuery({
    queryKey: ['all_user_sales_reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sales_reps')
        .select('*, sales_rep:sales_reps(*)');
      if (error) throw error;
      return (data || []) as UserSalesRep[];
    },
  });

  // CRUD mutations
  const createSalesRep = useMutation({
    mutationFn: async (rep: { name: string; type: string; phone?: string; email?: string; tenant_id: string }) => {
      const { error } = await supabase.from('sales_reps').insert(rep);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_reps'] });
      toast.success('Vendedor criado!');
    },
    onError: () => toast.error('Erro ao criar vendedor'),
  });

  const updateSalesRep = useMutation({
    mutationFn: async ({ id, ...data }: Partial<SalesRep> & { id: string }) => {
      const { error } = await supabase.from('sales_reps').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_reps'] });
      toast.success('Vendedor atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar vendedor'),
  });

  const linkUserSalesRep = useMutation({
    mutationFn: async ({ user_id, sales_rep_id, is_default }: { user_id: string; sales_rep_id: string; is_default?: boolean }) => {
      const { error } = await supabase.from('user_sales_reps').insert({
        user_id,
        sales_rep_id,
        is_default: is_default || false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_sales_reps'] });
      queryClient.invalidateQueries({ queryKey: ['my_sales_reps'] });
      toast.success('Vendedor vinculado!');
    },
    onError: () => toast.error('Erro ao vincular vendedor'),
  });

  const unlinkUserSalesRep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_sales_reps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_sales_reps'] });
      queryClient.invalidateQueries({ queryKey: ['my_sales_reps'] });
      toast.success('Vínculo removido!');
    },
    onError: () => toast.error('Erro ao remover vínculo'),
  });

  const setDefaultSalesRep = useMutation({
    mutationFn: async ({ id, user_id }: { id: string; user_id: string }) => {
      const { error } = await supabase
        .from('user_sales_reps')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_sales_reps'] });
      queryClient.invalidateQueries({ queryKey: ['my_sales_reps'] });
      toast.success('Vendedor padrão definido!');
    },
    onError: () => toast.error('Erro ao definir padrão'),
  });

  return {
    salesReps,
    isLoading,
    mySalesReps,
    myActiveSalesReps,
    defaultSalesRepId,
    allUserSalesReps,
    createSalesRep,
    updateSalesRep,
    linkUserSalesRep,
    unlinkUserSalesRep,
    setDefaultSalesRep,
  };
}
