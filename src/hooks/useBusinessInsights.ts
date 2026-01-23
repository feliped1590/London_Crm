import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, differenceInDays, addDays, isPast, isFuture } from "date-fns";

export interface InactiveCustomer {
  id: string;
  name: string;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number;
  totalOrders: number;
  totalValue: number;
  severity: "critical" | "warning" | "info";
}

export interface StagnantDeal {
  id: string;
  name: string;
  stage: string;
  value: number;
  lastUpdate: Date;
  daysSinceUpdate: number;
  ownerName: string | null;
  companyName: string | null;
  severity: "critical" | "warning" | "info";
}

export interface OverdueTask {
  id: string;
  title: string;
  dueDate: Date;
  daysOverdue: number;
  assigneeName: string | null;
  dealName: string | null;
  companyName: string | null;
  priority: string;
  severity: "critical" | "warning" | "info";
}

export interface ExpiringProposal {
  id: string;
  number: string;
  companyName: string | null;
  contactName: string | null;
  totalValue: number;
  validityDate: Date;
  daysUntilExpiry: number;
  dealId: string;
  severity: "critical" | "warning" | "info";
}

export interface InsightsSummary {
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export interface BusinessInsights {
  inactiveCustomers: InactiveCustomer[];
  stagnantDeals: StagnantDeal[];
  overdueTasks: OverdueTask[];
  expiringProposals: ExpiringProposal[];
  summary: InsightsSummary;
  isLoading: boolean;
  error: Error | null;
}

// Thresholds configuration
const INACTIVE_CUSTOMER_DAYS = { critical: 90, warning: 60, info: 30 };
const STAGNANT_DEAL_DAYS = { critical: 30, warning: 15, info: 7 };
const OVERDUE_TASK_DAYS = { critical: 7, warning: 3, info: 1 };
const EXPIRING_PROPOSAL_DAYS = { critical: 3, warning: 7, info: 14 };

function getSeverity(
  value: number,
  thresholds: { critical: number; warning: number; info: number },
  isHigherWorse: boolean = true
): "critical" | "warning" | "info" {
  if (isHigherWorse) {
    if (value >= thresholds.critical) return "critical";
    if (value >= thresholds.warning) return "warning";
    return "info";
  } else {
    if (value <= thresholds.critical) return "critical";
    if (value <= thresholds.warning) return "warning";
    return "info";
  }
}

export function useBusinessInsights(): BusinessInsights {
  const today = new Date();

  // Fetch inactive customers (companies without recent orders)
  const { data: inactiveCustomers = [], isLoading: loadingInactive, error: errorInactive } = useQuery({
    queryKey: ["insights-inactive-customers"],
    queryFn: async () => {
      // Get all companies with their order history
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, name");

      if (companiesError) throw companiesError;

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("company_id, created_at, total_value");

      if (ordersError) throw ordersError;

      // Aggregate orders by company
      const companyOrders = new Map<string, { dates: Date[]; totalValue: number; count: number }>();
      
      orders?.forEach((order) => {
        if (!order.company_id) return;
        const existing = companyOrders.get(order.company_id) || { dates: [], totalValue: 0, count: 0 };
        existing.dates.push(new Date(order.created_at));
        existing.totalValue += Number(order.total_value) || 0;
        existing.count += 1;
        companyOrders.set(order.company_id, existing);
      });

      // Find inactive customers (has orders but none recently)
      const inactive: InactiveCustomer[] = [];
      const thirtyDaysAgo = subDays(today, INACTIVE_CUSTOMER_DAYS.info);

      companies?.forEach((company) => {
        const orderData = companyOrders.get(company.id);
        if (!orderData || orderData.count === 0) return; // Skip companies with no orders

        const lastOrderDate = new Date(Math.max(...orderData.dates.map(d => d.getTime())));
        const daysSince = differenceInDays(today, lastOrderDate);

        if (daysSince >= INACTIVE_CUSTOMER_DAYS.info) {
          inactive.push({
            id: company.id,
            name: company.name,
            lastOrderDate,
            daysSinceLastOrder: daysSince,
            totalOrders: orderData.count,
            totalValue: orderData.totalValue,
            severity: getSeverity(daysSince, INACTIVE_CUSTOMER_DAYS),
          });
        }
      });

      return inactive.sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch stagnant deals
  const { data: stagnantDeals = [], isLoading: loadingStagnant, error: errorStagnant } = useQuery({
    queryKey: ["insights-stagnant-deals"],
    queryFn: async () => {
      const { data: deals, error } = await supabase
        .from("deals")
        .select(`
          id,
          name,
          stage,
          value,
          updated_at,
          owner_id,
          company_id,
          companies(name),
          profiles:owner_id(full_name)
        `)
        .not("stage", "in", "(ganho,perdido)")
        .order("updated_at", { ascending: true });

      if (error) throw error;

      const stagnant: StagnantDeal[] = [];

      deals?.forEach((deal) => {
        const lastUpdate = new Date(deal.updated_at);
        const daysSince = differenceInDays(today, lastUpdate);

        if (daysSince >= STAGNANT_DEAL_DAYS.info) {
          stagnant.push({
            id: deal.id,
            name: deal.name,
            stage: deal.stage,
            value: Number(deal.value) || 0,
            lastUpdate,
            daysSinceUpdate: daysSince,
            ownerName: (deal.profiles as any)?.full_name || null,
            companyName: (deal.companies as any)?.name || null,
            severity: getSeverity(daysSince, STAGNANT_DEAL_DAYS),
          });
        }
      });

      return stagnant;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch overdue tasks
  const { data: overdueTasks = [], isLoading: loadingOverdue, error: errorOverdue } = useQuery({
    queryKey: ["insights-overdue-tasks"],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          due_date,
          priority,
          assigned_to,
          deal_id,
          company_id,
          profiles:assigned_to(full_name),
          deals:deal_id(name),
          companies:company_id(name)
        `)
        .eq("status", "pendente")
        .not("due_date", "is", null)
        .lt("due_date", today.toISOString())
        .order("due_date", { ascending: true });

      if (error) throw error;

      const overdue: OverdueTask[] = (tasks || []).map((task) => {
        const dueDate = new Date(task.due_date!);
        const daysOverdue = differenceInDays(today, dueDate);

        return {
          id: task.id,
          title: task.title,
          dueDate,
          daysOverdue,
          assigneeName: (task.profiles as any)?.full_name || null,
          dealName: (task.deals as any)?.name || null,
          companyName: (task.companies as any)?.name || null,
          priority: task.priority,
          severity: getSeverity(daysOverdue, OVERDUE_TASK_DAYS),
        };
      });

      return overdue;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch expiring proposals
  const { data: expiringProposals = [], isLoading: loadingExpiring, error: errorExpiring } = useQuery({
    queryKey: ["insights-expiring-proposals"],
    queryFn: async () => {
      const maxDate = addDays(today, EXPIRING_PROPOSAL_DAYS.info);
      
      const { data: proposals, error } = await supabase
        .from("proposals")
        .select(`
          id,
          number,
          total_value,
          validity_date,
          deal_id,
          company_id,
          contact_id,
          companies:company_id(name),
          contacts:contact_id(first_name, last_name)
        `)
        .eq("status", "enviada")
        .not("validity_date", "is", null)
        .gte("validity_date", today.toISOString().split("T")[0])
        .lte("validity_date", maxDate.toISOString().split("T")[0])
        .order("validity_date", { ascending: true });

      if (error) throw error;

      const expiring: ExpiringProposal[] = (proposals || []).map((proposal) => {
        const validityDate = new Date(proposal.validity_date!);
        const daysUntil = differenceInDays(validityDate, today);

        const contact = proposal.contacts as any;
        const contactName = contact 
          ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() 
          : null;

        return {
          id: proposal.id,
          number: proposal.number,
          companyName: (proposal.companies as any)?.name || null,
          contactName,
          totalValue: Number(proposal.total_value) || 0,
          validityDate,
          daysUntilExpiry: daysUntil,
          dealId: proposal.deal_id,
          severity: getSeverity(daysUntil, EXPIRING_PROPOSAL_DAYS, false),
        };
      });

      return expiring;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate summary
  const allItems = [
    ...inactiveCustomers,
    ...stagnantDeals,
    ...overdueTasks,
    ...expiringProposals,
  ];

  const summary: InsightsSummary = {
    totalAlerts: allItems.length,
    criticalCount: allItems.filter((i) => i.severity === "critical").length,
    warningCount: allItems.filter((i) => i.severity === "warning").length,
    infoCount: allItems.filter((i) => i.severity === "info").length,
  };

  const isLoading = loadingInactive || loadingStagnant || loadingOverdue || loadingExpiring;
  const error = errorInactive || errorStagnant || errorOverdue || errorExpiring;

  return {
    inactiveCustomers,
    stagnantDeals,
    overdueTasks,
    expiringProposals,
    summary,
    isLoading,
    error: error as Error | null,
  };
}
