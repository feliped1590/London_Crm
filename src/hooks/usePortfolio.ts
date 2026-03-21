import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PortfolioItem {
  id: string;
  name: string;
  type: 'company' | 'contact' | 'deal';
}

export interface UserPortfolio {
  salesRepId: string;
  salesRepName: string;
  salesRepType: string | null;
  linkedUserId: string | null;
  // Backward-compat aliases
  userId: string;
  userName: string;
  userRole: string;
  companiesCount: number;
  contactsCount: number;
  dealsCount: number;
  // Lazy-loaded items for manage dialog
  companies: PortfolioItem[];
  contacts: PortfolioItem[];
  deals: PortfolioItem[];
}

export interface TransferRequest {
  items: { id: string; name: string; type: 'company' | 'contact' | 'deal' }[];
  fromSalesRepId: string | null;
  toSalesRepId: string;
  transferRelated: boolean;
  notes?: string;
}

export interface PortfolioTransfer {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  from_user_id: string | null;
  to_user_id: string | null;
  transferred_by: string;
  transferred_at: string;
  notes: string | null;
}

/**
 * Resolve a user_id linked to a sales_rep (prefers default link).
 */
async function resolveUserForSalesRep(salesRepId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_sales_reps')
    .select('user_id, is_default')
    .eq('sales_rep_id', salesRepId);

  if (!data?.length) return null;
  return data.find(l => l.is_default)?.user_id || data[0].user_id;
}

export function usePortfolio() {
  const queryClient = useQueryClient();

  // Buscar resumo de carteiras via RPC (contagens reais sem limite)
  const { data: portfolios, isLoading: isLoadingPortfolios } = useQuery({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_portfolio_summary');
      if (error) throw error;

      return (data || []).map((row: any) => ({
        salesRepId: row.sales_rep_id,
        salesRepName: row.sales_rep_name,
        salesRepType: row.sales_rep_type,
        linkedUserId: row.linked_user_id,
        userId: row.linked_user_id || row.sales_rep_id,
        userName: row.sales_rep_name,
        userRole: row.sales_rep_type || 'interno',
        companiesCount: Number(row.companies_count),
        contactsCount: Number(row.contacts_count),
        dealsCount: Number(row.deals_count),
        companies: [],
        contacts: [],
        deals: [],
      })) as UserPortfolio[];
    }
  });

  // Histórico de transferências
  const { data: transfers, isLoading: isLoadingTransfers } = useQuery({
    queryKey: ['portfolio-transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_transfers')
        .select('*')
        .order('transferred_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as PortfolioTransfer[];
    }
  });

  // Mutation para transferir itens
  const transferMutation = useMutation({
    mutationFn: async (request: TransferRequest) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Resolver user_id do vendedor destino (para manter RLS)
      const targetUserId = await resolveUserForSalesRep(request.toSalesRepId);

      // Resolver user_id do vendedor origem (para histórico)
      let fromUserId: string | null = null;
      if (request.fromSalesRepId) {
        fromUserId = await resolveUserForSalesRep(request.fromSalesRepId);
      }

      const transferRecords: any[] = [];
      const relatedItems: { id: string; name: string; type: 'company' | 'contact' | 'deal' }[] = [];

      // Buscar itens relacionados (contatos e negócios das empresas)
      if (request.transferRelated) {
        const companyIds = request.items
          .filter(item => item.type === 'company')
          .map(item => item.id);

        if (companyIds.length > 0) {
          const { data: relatedContacts } = await supabase
            .from('contacts')
            .select('id, first_name, last_name')
            .in('company_id', companyIds);

          relatedContacts?.forEach(contact => {
            const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
            relatedItems.push({ id: contact.id, name: name || 'Sem nome', type: 'contact' });
          });

          const { data: relatedDeals } = await supabase
            .from('deals')
            .select('id, name')
            .in('company_id', companyIds);

          relatedDeals?.forEach(deal => {
            relatedItems.push({ id: deal.id, name: deal.name, type: 'deal' });
          });
        }
      }

      const allItems = [...request.items, ...relatedItems];

      for (const item of allItems) {
        let tableName: 'companies' | 'contacts' | 'deals';
        if (item.type === 'company') tableName = 'companies';
        else if (item.type === 'contact') tableName = 'contacts';
        else tableName = 'deals';

        // sales_rep_id remains the commercial ownership source; owner_id is legacy compatibility only
        const updateData: Record<string, any> = {};
        if (targetUserId) updateData.owner_id = targetUserId;
        if (item.type === 'company') updateData.sales_rep_id = request.toSalesRepId;

        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', item.id);
        if (error) throw error;

        transferRecords.push({
          entity_type: item.type,
          entity_id: item.id,
          entity_name: item.name,
          from_user_id: fromUserId,
          to_user_id: targetUserId,
          transferred_by: user.id,
          notes: request.notes
        });
      }

      if (transferRecords.length > 0) {
        const { error } = await supabase
          .from('portfolio_transfers')
          .insert(transferRecords);
        if (error) throw error;
      }

      return allItems.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} item(ns) transferido(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-items'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transfers'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao transferir: ' + error.message);
    }
  });

  return {
    portfolios,
    isLoadingPortfolios,
    transfers,
    isLoadingTransfers,
    transferItems: transferMutation.mutate,
    isTransferring: transferMutation.isPending
  };
}

/**
 * Hook to load portfolio items for a specific sales rep on demand (for manage dialog).
 */
export function usePortfolioItems(salesRepId: string | null, entityType: 'company' | 'contact' | 'deal') {
  return useQuery({
    queryKey: ['portfolio-items', salesRepId, entityType],
    queryFn: async () => {
      if (!salesRepId) return [];
      const { data, error } = await supabase.rpc('get_portfolio_items', {
        p_sales_rep_id: salesRepId,
        p_entity_type: entityType,
      });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.item_id,
        name: row.item_name,
        type: row.item_type as 'company' | 'contact' | 'deal',
      })) as PortfolioItem[];
    },
    enabled: !!salesRepId,
  });
}

// Mantido para histórico de transferências e exibição de nomes
export function useUsers() {
  return useQuery({
    queryKey: ['users-for-transfer'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (error) throw error;

      const { data: salesReps } = await supabase
        .from('sales_reps')
        .select('id, name');

      const result = profiles?.map(p => ({
        id: p.user_id,
        name: p.full_name || 'Sem nome',
        role: 'vendedor'
      })) || [];

      // Adicionar sales_reps para resolução de nome no histórico
      salesReps?.forEach(sr => {
        if (!result.find(r => r.id === sr.id)) {
          result.push({ id: sr.id, name: sr.name, role: 'vendedor' });
        }
      });

      return result;
    }
  });
}