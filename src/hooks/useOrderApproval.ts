import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useModulePermissions } from './useModulePermissions';
import { OrderStatus, OrderType } from '@/types/products';
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

interface TransitionRule {
  next: OrderStatus | null;
  allowedRoles: ('admin' | 'vendedor')[];
  requiresOwnership?: boolean;
}

// Transition rules for PRODUÇÃO orders
const PRODUCAO_TRANSITIONS: Record<OrderStatus, TransitionRule> = {
  pendente: {
    next: 'em_producao',
    allowedRoles: ['admin', 'vendedor'],
    requiresOwnership: true,
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
  em_faturamento: { next: null, allowedRoles: [] },
  entregue: { next: null, allowedRoles: [] },
  cancelado: { next: null, allowedRoles: [] },
};

// Transition rules for PRONTA ENTREGA orders
const PRONTA_ENTREGA_TRANSITIONS: Record<OrderStatus, TransitionRule> = {
  pendente: {
    next: 'em_faturamento',
    allowedRoles: ['admin', 'vendedor'],
    requiresOwnership: true,
  },
  em_faturamento: {
    next: 'faturado',
    allowedRoles: ['admin'],
  },
  faturado: {
    next: null, // Final state for pronta entrega
    allowedRoles: [],
  },
  em_producao: { next: null, allowedRoles: [] },
  produzido: { next: null, allowedRoles: [] },
  entregue: { next: null, allowedRoles: [] },
  cancelado: { next: null, allowedRoles: [] },
};

function getTransitionRules(orderType: OrderType): Record<OrderStatus, TransitionRule> {
  return orderType === 'pronta_entrega' || orderType === 'Pronto Entrega' ? PRONTA_ENTREGA_TRANSITIONS : PRODUCAO_TRANSITIONS;
}

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
  // Pronta Entrega transitions
  'pendente->em_faturamento': {
    label: 'Liberar para Faturamento',
    description: 'Autoriza o pedido para faturamento direto',
  },
  'em_faturamento->faturado': {
    label: 'Faturar Pedido',
    description: 'Registra o faturamento do pedido',
  },
};

export function useOrderApproval(
  orderId: string,
  orderStatus: OrderStatus,
  orderCreatedBy?: string | null,
  orderType: OrderType = 'Novo/Alteração'
) {
  const { user } = useAuth();
  const { isAdmin, hasFullAccess, can } = useModulePermissions();
  const queryClient = useQueryClient();

  const TRANSITION_RULES = getTransitionRules(orderType);
  const hasOrdersFullAccess = hasFullAccess('orders');
  const canEditOrders = can('orders', 'edit' as any);

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

  const canApproveNextTransition = (): boolean => {
    if (!user) return false;

    const rule = TRANSITION_RULES[orderStatus];
    if (!rule || !rule.next) return false;

    if (isAdmin) return true;

    // Acesso total ao módulo Pedidos equivale a admin para fins de transição de status
    if (hasOrdersFullAccess) return true;

    if (rule.allowedRoles.includes('vendedor')) {
      if (rule.requiresOwnership) {
        return orderCreatedBy === user.id;
      }
      return true;
    }

    // Acesso restrito com permissão de editar: aplica regra de ownership (igual vendedor)
    if (canEditOrders && rule.requiresOwnership) {
      return orderCreatedBy === user.id;
    }

    return false;
  };


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

      const { error: approvalError } = await supabase
        .from('order_approvals')
        .insert({
          order_id: orderId,
          from_status: orderStatus as any,
          to_status: newStatus as any,
          approved_by: user.id,
          notes: notes || null,
        });

      if (approvalError) {
        if (approvalError.code === '23505') {
          throw new Error('Esta transição já foi registrada anteriormente');
        }
        throw approvalError;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus as any })
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

  const canCancelOrder = (): boolean => {
    if (!user) return false;
    if (!isAdmin && !hasOrdersFullAccess) return false;
    return orderStatus !== 'cancelado' && orderStatus !== 'entregue' && orderStatus !== 'faturado';
  };

  const cancelMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      if (!user) throw new Error('Usuário não autenticado');
      if (!isAdmin && !hasOrdersFullAccess) throw new Error('Você não tem permissão para cancelar pedidos');


      const { error: approvalError } = await supabase
        .from('order_approvals')
        .insert({
          order_id: orderId,
          from_status: orderStatus as any,
          to_status: 'cancelado' as any,
          approved_by: user.id,
          notes: reason,
        });

      if (approvalError) throw approvalError;

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelado' as any })
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
