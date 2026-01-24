import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PortfolioItem {
  id: string;
  name: string;
  type: 'company' | 'contact' | 'deal';
}

export interface UserPortfolio {
  userId: string;
  userName: string;
  userRole: string;
  companies: PortfolioItem[];
  contacts: PortfolioItem[];
  deals: PortfolioItem[];
}

export interface TransferRequest {
  items: { id: string; name: string; type: 'company' | 'contact' | 'deal' }[];
  fromUserId: string | null;
  toUserId: string;
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

export function usePortfolio() {
  const queryClient = useQueryClient();

  // Buscar todos os usuários com suas carteiras
  const { data: portfolios, isLoading: isLoadingPortfolios } = useQuery({
    queryKey: ['portfolios'],
    queryFn: async () => {
      // Buscar todos os usuários
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Buscar empresas, contatos e negócios por owner_id
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, owner_id');

      if (companiesError) throw companiesError;

      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, owner_id');

      if (contactsError) throw contactsError;

      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, name, owner_id');

      if (dealsError) throw dealsError;

      // Montar portfolios por usuário
      const portfolioMap: Record<string, UserPortfolio> = {};

      profiles?.forEach(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        portfolioMap[profile.user_id] = {
          userId: profile.user_id,
          userName: profile.full_name || 'Sem nome',
          userRole: userRole?.role || 'vendedor',
          companies: [],
          contacts: [],
          deals: []
        };
      });

      // Adicionar empresas
      companies?.forEach(company => {
        if (company.owner_id && portfolioMap[company.owner_id]) {
          portfolioMap[company.owner_id].companies.push({
            id: company.id,
            name: company.name,
            type: 'company'
          });
        }
      });

      // Adicionar contatos
      contacts?.forEach(contact => {
        if (contact.owner_id && portfolioMap[contact.owner_id]) {
          const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
          portfolioMap[contact.owner_id].contacts.push({
            id: contact.id,
            name: name || 'Sem nome',
            type: 'contact'
          });
        }
      });

      // Adicionar negócios
      deals?.forEach(deal => {
        if (deal.owner_id && portfolioMap[deal.owner_id]) {
          portfolioMap[deal.owner_id].deals.push({
            id: deal.id,
            name: deal.name,
            type: 'deal'
          });
        }
      });

      return Object.values(portfolioMap);
    }
  });

  // Buscar histórico de transferências
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

      const transferRecords: any[] = [];
      const relatedItems: { id: string; name: string; type: 'company' | 'contact' | 'deal' }[] = [];

      // Se transferir relacionados, buscar contatos e negócios das empresas
      if (request.transferRelated) {
        const companyIds = request.items
          .filter(item => item.type === 'company')
          .map(item => item.id);

        if (companyIds.length > 0) {
          // Buscar contatos relacionados
          const { data: relatedContacts } = await supabase
            .from('contacts')
            .select('id, first_name, last_name')
            .in('company_id', companyIds)
            .eq('owner_id', request.fromUserId);

          relatedContacts?.forEach(contact => {
            const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
            relatedItems.push({ id: contact.id, name: name || 'Sem nome', type: 'contact' });
          });

          // Buscar negócios relacionados
          const { data: relatedDeals } = await supabase
            .from('deals')
            .select('id, name')
            .in('company_id', companyIds)
            .eq('owner_id', request.fromUserId);

          relatedDeals?.forEach(deal => {
            relatedItems.push({ id: deal.id, name: deal.name, type: 'deal' });
          });
        }
      }

      const allItems = [...request.items, ...relatedItems];

      // Atualizar owner_id de cada item
      for (const item of allItems) {
        let tableName: 'companies' | 'contacts' | 'deals';
        
        if (item.type === 'company') tableName = 'companies';
        else if (item.type === 'contact') tableName = 'contacts';
        else tableName = 'deals';

        const { error } = await supabase
          .from(tableName)
          .update({ owner_id: request.toUserId })
          .eq('id', item.id);

        if (error) throw error;

        // Preparar registro de transferência
        transferRecords.push({
          entity_type: item.type,
          entity_id: item.id,
          entity_name: item.name,
          from_user_id: request.fromUserId,
          to_user_id: request.toUserId,
          transferred_by: user.id,
          notes: request.notes
        });
      }

      // Inserir registros de histórico
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

export function useUsers() {
  return useQuery({
    queryKey: ['users-for-transfer'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (error) throw error;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      return profiles?.map(p => ({
        id: p.user_id,
        name: p.full_name || 'Sem nome',
        role: roles?.find(r => r.user_id === p.user_id)?.role || 'vendedor'
      })) || [];
    }
  });
}
