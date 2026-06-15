import { useState, useCallback } from 'react';

export type DrillDownSource = 'sales' | 'deals';

export interface DrillDownFilters {
  startDate: Date;
  endDate: Date;
  legalEntityId?: string | null;
  sellerId?: string | null;
  companyId?: string | null;
  productId?: string | null;
  stage?: string | null;
  lostReason?: string | null;
  source?: DrillDownSource;
}

export interface DrillDownState {
  open: boolean;
  title: string;
  subtitle?: string;
  filters: DrillDownFilters | null;
}

export function useSalesDrillDown() {
  const [state, setState] = useState<DrillDownState>({
    open: false,
    title: '',
    filters: null,
  });

  const openDrillDown = useCallback(
    (opts: { title: string; subtitle?: string; filters: DrillDownFilters }) => {
      setState({ open: true, title: opts.title, subtitle: opts.subtitle, filters: opts.filters });
    },
    []
  );

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return { state, openDrillDown, close };
}
