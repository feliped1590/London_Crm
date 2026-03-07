import { useMemo } from 'react';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useModulePermissions } from '@/hooks/useModulePermissions';

/**
 * Hook that provides sales-rep-based access control at the UI level.
 * A user can only work with clients whose sales_rep is linked to them via user_sales_reps.
 * Admins bypass this restriction entirely.
 */
export function useSalesRepAccess() {
  const { mySalesReps } = useSalesReps();
  const { isAdmin } = useModulePermissions();

  const mySalesRepIds = useMemo(() => {
    return new Set(mySalesReps?.map(usr => usr.sales_rep_id) || []);
  }, [mySalesReps]);

  /**
   * Check if the current user can access a record based on its sales_rep_id.
   * - Admins always have access.
   * - If salesRepId is null, only admins can access.
   * - Otherwise, user must have the sales_rep linked via user_sales_reps.
   */
  const canAccessBySalesRep = (salesRepId: string | null | undefined): boolean => {
    if (isAdmin) return true;
    if (!salesRepId) return false; // sem vendedor = apenas admin
    return mySalesRepIds.has(salesRepId);
  };

  return {
    mySalesRepIds,
    canAccessBySalesRep,
    isAdmin: !!isAdmin,
    isLoaded: mySalesReps !== undefined,
  };
}
