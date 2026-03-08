import { useMemo } from 'react';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useModulePermissions } from '@/hooks/useModulePermissions';

/**
 * Hook that provides sales-rep-based access control at the UI level.
 * A user can only work with clients whose sales_rep is linked to them via user_sales_reps.
 * Admins can see everything but need intervention authorization for clients not directly linked.
 */
export function useSalesRepAccess() {
  const { mySalesReps } = useSalesReps();
  const { isAdmin } = useModulePermissions();

  const mySalesRepIds = useMemo(() => {
    return new Set(mySalesReps?.map(usr => usr.sales_rep_id) || []);
  }, [mySalesReps]);

  /**
   * Check if the current user has DIRECT access (linked via user_sales_reps).
   * Does NOT consider admin bypass.
   */
  const hasDirectAccess = (salesRepId: string | null | undefined): boolean => {
    if (!salesRepId) return false;
    return mySalesRepIds.has(salesRepId);
  };

  /**
   * Check if the current user can access a record based on its sales_rep_id.
   * - Admins always have access (for listing/filtering).
   * - If salesRepId is null, only admins can access.
   * - Otherwise, user must have the sales_rep linked via user_sales_reps.
   */
  const canAccessBySalesRep = (salesRepId: string | null | undefined): boolean => {
    if (isAdmin) return true;
    if (!salesRepId) return false;
    return mySalesRepIds.has(salesRepId);
  };

  /**
   * Check if admin needs intervention authorization to access a record.
   * Returns true if user is admin but does NOT have direct link to the sales rep.
   */
  const needsAdminIntervention = (salesRepId: string | null | undefined): boolean => {
    if (!isAdmin) return false;
    if (!salesRepId) return true; // admin accessing client without sales rep
    return !mySalesRepIds.has(salesRepId);
  };

  return {
    mySalesRepIds,
    hasDirectAccess,
    canAccessBySalesRep,
    needsAdminIntervention,
    isAdmin: !!isAdmin,
    isLoaded: mySalesReps !== undefined,
  };
}
