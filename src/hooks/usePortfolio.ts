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
  to_user_id: string;
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

  // Buscar carteiras agrupadas por vendedor comercial (sales_rep)
  const { data: portfolios, isLoading: isLoadingPortfolios } = useQuery({
    queryKey: ['portfolios'],
    queryFn: async () => {
      // 1. Sales reps ativos
      const { data: salesReps, error: repsError } = await supabase
        .from('sales_reps')
        .select('id, name, type, active')
        .eq('active', true)
        .order('name');
      if (repsError) throw repsError;

      // 2. Vínculos user ↔ sales_rep
      const { data: userLinks, error: linksError } = await supabase
        .from('user_sales_reps')
        .select('user_id, sales_rep_id, is_default');
      if (linksError) throw linksError;

      // Map: sales_rep_id → user_id (prefer is_default)
      const repToUser: Record<string, string> = {};
      userLinks?.forEach(link => {
        if (!repToUser[link.sales_rep_id]) repToUser[link.sales_rep_id] = link.user_id;
      });
      userLinks?.forEach(link => {
        if (link.is_default) repToUser[link.sales_rep_id] = link.user_id;
      });

      // 3. Empresas com sales_rep_id
      const { data: companies, error: compError } = await supabase
        .from('companies')
        .select('id, name, sales_rep_id');
      if (compError) throw compError;

      // Map: company_id → sales_rep_id
      const companyToRep: Record<string, string> = {};
      companies?.forEach(c => {
        if (c.sales_rep_id) companyToRep[c.id] = c.sales_rep_id;
      });

      // 4. Contatos
      const { data: contacts, error: contError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, company_id');
      if (contError) throw contError;

      // 5. Negócios
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, name, company_id');
      if (dealsError) throw dealsError;

      // 6. Montar portfolios por vendedor
      const portfolioMap: Record<string, UserPortfolio> = {};

      salesReps?.forEach(rep => {
        const linkedUser = repToUser[rep.id] || null;
        portfolioMap[rep.id] = {
          salesRepId: rep.id,
          salesRepName: rep.name,
          salesRepType: rep.type,
          linkedUserId: linkedUser,
          userId: linkedUser || rep.id,
          userName: rep.name,
          userRole: rep.type || 'interno',
          companies: [],
          contacts: [],
          deals: [],
        };
      });

      // Adicionar empresas
      companies?.forEach(company => {
        if (company.sales_rep_id && portfolioMap[company.sales_rep_id]) {
          portfolioMap[company.sales_rep_id].companies.push({
            id: company.id,
            name: company.name,
            type: 'company',
          });
        }
      });

      // Adicionar contatos (via empresa → sales_rep)
      contacts?.forEach(contact => {
        const repId = contact.company_id ? companyToRep[contact.company_id] : null;
        if (repId && portfolioMap[repId]) {
          const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
          portfolioMap[repId].contacts.push({
            id: contact.id,
            name: name || 'Sem nome',
            type: 'contact',
          });
        }
      });

      // Adicionar negócios (via empresa → sales_rep)
      deals?.forEach(deal => {
        const repId = deal.company_id ? companyToRep[deal.company_id] : null;
        if (repId && portfolioMap[repId]) {
          portfolioMap[repId].deals.push({
            id: deal.id,
            name: deal.name,
            type: 'deal',
          });
        }
      });

      return Object.values(portfolioMap);
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

        // Build update: sales_rep_id apenas para empresas, owner_id para todos
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
          to_user_id: targetUserId || request.toSalesRepId,
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
