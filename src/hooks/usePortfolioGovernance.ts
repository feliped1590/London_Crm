import { useAuth } from './useAuth';
import { useModulePermissions } from './useModulePermissions';
import { supabase } from '@/integrations/supabase/client';

export interface ClientOwnershipResult {
  isOwner: boolean;
  ownerId: string | null;
  ownerName: string | null;
  clientName: string | null;
}

export interface InterventionLogData {
  actionType: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  clientId?: string;
  clientName?: string;
  clientOwnerId?: string;
  clientOwnerName?: string;
  justification: string;
  details?: Record<string, unknown>;
}

export function usePortfolioGovernance() {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();

  /**
   * Check if the current user owns a company (by CRM company ID)
   */
  const checkCompanyOwnership = async (companyId: string): Promise<ClientOwnershipResult> => {
    if (!user?.id) {
      return { isOwner: false, ownerId: null, ownerName: null, clientName: null };
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select(`
        id, 
        name, 
        owner_id,
        profiles:owner_id(full_name)
      `)
      .eq('id', companyId)
      .maybeSingle();

    if (error || !company) {
      return { isOwner: false, ownerId: null, ownerName: null, clientName: null };
    }

    const ownerId = company.owner_id;
    const ownerName = (company.profiles as any)?.full_name || null;
    const isOwner = !ownerId || ownerId === user.id;

    return {
      isOwner,
      ownerId,
      ownerName,
      clientName: company.name,
    };
  };

  /**
   * Check if current user needs to provide justification for an action
   * Returns the ownership info if justification is needed, null otherwise
   */
  const requiresJustification = async (companyId: string | null): Promise<ClientOwnershipResult | null> => {
    // If no company, no justification needed
    if (!companyId) return null;

    // Only admins need to justify (non-admins are blocked by triggers)
    if (!isAdmin) return null;

    const ownership = await checkCompanyOwnership(companyId);

    // If user owns the company, no justification needed
    if (ownership.isOwner) return null;

    // Admin accessing another user's client - needs justification
    return ownership;
  };

  /**
   * Log an administrative intervention
   */
  const logIntervention = async (data: InterventionLogData): Promise<void> => {
    if (!user?.id) {
      console.error('Cannot log intervention: no authenticated user');
      return;
    }

    const insertData = {
      admin_user_id: user.id,
      action_type: data.actionType,
      entity_type: data.entityType,
      entity_id: data.entityId,
      entity_name: data.entityName || null,
      client_id: data.clientId || null,
      client_name: data.clientName || null,
      client_owner_id: data.clientOwnerId || null,
      client_owner_name: data.clientOwnerName || null,
      justification: data.justification,
      details: data.details || {},
    };

    const { error } = await supabase.from('admin_intervention_log').insert(insertData as any);

    if (error) {
      console.error('Failed to log intervention:', error);
      throw error;
    }
  };

  return {
    isAdmin,
    userId: user?.id,
    checkCompanyOwnership,
    requiresJustification,
    logIntervention,
  };
}
