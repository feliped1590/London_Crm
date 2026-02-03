import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useModulePermissions } from './useModulePermissions';
import { OrderStatus } from '@/types/products';
import { toast } from 'sonner';

export interface OrderApproval {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  approved_by: string | null;
  approved_at: string;
  notes: string | null;
  profiles?: {
    full_name: string;
  } | null;
}

// Define the allowed transitions per role
// Gate Comercial: Seller releases to production, Admin controls rest
const TRANSITION_RULES: Record<OrderStatus, {
  next: OrderStatus | null;
  allowedRoles: ('admin' | 'vendedor')[];
  requiresOwnership?: boolean; // If true, vendedor can only approve their own orders
}> = {
  pendente: {
    next: 'em_producao',
    allowedRoles: ['admin', 'vendedor'],
    requiresOwnership: true, // Vendedor can only release their own orders
  },
  em_producao: {
    next: 'produzido',
    allowedRoles: ['admin'],
  },
  produzido: {
    next: 'faturado',
    allowedRoles: ['admin'],
  },
  faturado: {
    next: 'entregue',
    allowedRoles: ['admin'],
  },
  entregue: {
    next: null, // Final state
    allowedRoles: [],
  },
  cancelado: {
    next: null, // Final state
    allowedRoles: [],
  },
};

// Transition labels for UI
export const TRANSITION_LABELS: Record<string, { label: string; description: string }> = {
  'pendente->em_producao': {
    label: 'Liberar para Produção',
    description: 'Autoriza o pedido para iniciar produção',
  },
  'em_producao->produzido': {
    label: 'Marcar como Produzido',
    description: 'Confirma que o pedido foi produzido',
  },
  'produzido->faturado': {
    label: 'Faturar Pedido',
    description: 'Registra o faturamento do pedido',
  },
  'faturado->entregue': {
    label: 'Confirmar Entrega',
    description: 'Confirma a entrega ao cliente',
  },
};

export function useOrderApproval(orderId: string, orderStatus: OrderStatus, orderCreatedBy?: string | null) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const queryClient = useQueryClient();

  // Fetch approval history for this order
  const { data: approvalHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['order_approvals', orderId],
    queryFn: async (): Promise<OrderApproval[]> => {
      const { data: approvals, error } = await supabase
        .from('order_approvals')
        .select('*')
        .eq('order_id', orderId)
        .order('approved_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for display
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      return (approvals || []).map(approval => ({
        ...approval,
        from_status: approval.from_status as OrderStatus | null,
        to_status: approval.to_status as OrderStatus,
        profiles: profiles?.find(p => p.user_id === approval.approved_by) || null,
      }));
    },
    enabled: !!orderId,
  });

  // Check if current user can approve the next transition
  const canApproveNextTransition = (): boolean => {
    if (!user) return false;

    const rule = TRANSITION_RULES[orderStatus];
    if (!rule || !rule.next) return false;

    // Admin can always approve
    if (isAdmin) return true;

    // Check if vendedor is allowed
    if (rule.allowedRoles.includes('vendedor')) {
      // If ownership is required, check if user is the creator
      if (rule.requiresOwnership) {
        return orderCreatedBy === user.id;
      }
      return true;
    }

    return false;
  };

  // Get the next possible transition
  const getNextTransition = (): { from: OrderStatus; to: OrderStatus; label: string; description: string } | null => {
    const rule = TRANSITION_RULES[orderStatus];
    if (!rule || !rule.next) return null;

    const key = `${orderStatus}->${rule.next}`;
    const transitionInfo = TRANSITION_LABELS[key] || { 
      label: `Avançar para ${rule.next}`, 
      description: '' 
    };

    return {
      from: orderStatus,
      to: rule.next,
      ...transitionInfo,
    };
  };

  // Approve transition mutation
  const approveMutation = useMutation({
    mutationFn: async ({ notes }: { notes?: string }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const rule = TRANSITION_RULES[orderStatus];
      if (!rule || !rule.next) {
        throw new Error('Não há transição disponível para este status');
      }

      if (!canApproveNextTransition()) {
        throw new Error('Você não tem permissão para aprovar esta transição');
      }

      const newStatus = rule.next;

      // Insert approval record
      const { error: approvalError } = await supabase
        .from('order_approvals')
        .insert({
          order_id: orderId,
          from_status: orderStatus,
          to_status: newStatus,
          approved_by: user.id,
          notes: notes || null,
        });

      if (approvalError) {
        // Check for unique constraint violation
        if (approvalError.code === '23505') {
          throw new Error('Esta transição já foi registrada anteriormente');
        }
        throw approvalError;
      }

      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (updateError) throw updateError;

      return { from: orderStatus, to: newStatus };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_approvals', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log', orderId] });
      
      const transitionKey = `${data.from}->${data.to}`;
      const label = TRANSITION_LABELS[transitionKey]?.label || 'Transição';
      toast.success(`${label} realizada com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao aprovar transição');
    },
  });

  // Check if user can cancel the order
  const canCancelOrder = (): boolean => {
    if (!user) return false;
    
    // Only admin can cancel
    if (!isAdmin) return false;

    // Can only cancel if not already cancelled or delivered
    return orderStatus !== 'cancelado' && orderStatus !== 'entregue';
  };

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      if (!user) throw new Error('Usuário não autenticado');
      if (!isAdmin) throw new Error('Apenas administradores podem cancelar pedidos');

      // Insert cancellation record
      const { error: approvalError } = await supabase
        .from('order_approvals')
        .insert({
          order_id: orderId,
          from_status: orderStatus,
          to_status: 'cancelado',
          approved_by: user.id,
          notes: reason,
        });

      if (approvalError) throw approvalError;

      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelado' })
        .eq('id', orderId);

      if (updateError) throw updateError;

      return { from: orderStatus, to: 'cancelado' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_approvals', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log', orderId] });
      toast.success('Pedido cancelado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao cancelar pedido');
    },
  });

  return {
    approvalHistory: approvalHistory || [],
    isLoadingHistory,
    canApproveNextTransition: canApproveNextTransition(),
    getNextTransition,
    approve: approveMutation.mutate,
    isApproving: approveMutation.isPending,
    canCancelOrder: canCancelOrder(),
    cancel: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
  };
}
