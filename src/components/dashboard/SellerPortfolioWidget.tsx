import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Users, Building2, UserCheck, UserX, UserPlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SellerData {
  userId: string;
  userName: string;
  active: number;
  inactive: number;
  prospecting: number;
  total: number;
}

export function SellerPortfolioWidget() {
  const { data: sellersData, isLoading } = useQuery({
    queryKey: ["seller-portfolio-widget"],
    queryFn: async () => {
      // Fetch all companies with owner info
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, name, owner_id, active, created_at");

      if (companiesError) throw companiesError;

      // Fetch all deals to identify prospecting (companies with open deals but no won deals)
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("company_id, stage");

      if (dealsError) throw dealsError;

      // Fetch profiles to get seller names
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

      // Group deals by company
      const companyDeals = new Map<string, string[]>();
      deals?.forEach((deal) => {
        if (deal.company_id) {
          const existing = companyDeals.get(deal.company_id) || [];
          existing.push(deal.stage);
          companyDeals.set(deal.company_id, existing);
        }
      });

      // Aggregate by owner
      const sellerMap = new Map<string, SellerData>();

      companies?.forEach((company) => {
        const ownerId = company.owner_id;
        if (!ownerId) return;

        if (!sellerMap.has(ownerId)) {
          sellerMap.set(ownerId, {
            userId: ownerId,
            userName: profileMap.get(ownerId) || "Sem nome",
            active: 0,
            inactive: 0,
            prospecting: 0,
            total: 0,
          });
        }

        const seller = sellerMap.get(ownerId)!;
        const stages = companyDeals.get(company.id) || [];

        // Determine company status
        const hasWonDeal = stages.includes("fechado_ganho");
        const hasOpenDeal = stages.some((s) => !["fechado_ganho", "fechado_perdido"].includes(s));

        if (hasWonDeal) {
          // Active: has at least one won deal
          if (company.active !== false) {
            seller.active++;
          } else {
            seller.inactive++;
          }
        } else if (hasOpenDeal) {
          // Prospecting: has open deals but no won deals
          seller.prospecting++;
        } else {
          // Inactive: no deals or only lost deals
          seller.inactive++;
        }

        seller.total++;
      });

      // Convert to array and sort by total
      return Array.from(sellerMap.values()).sort((a, b) => b.total - a.total);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalActive = sellersData?.reduce((sum, s) => sum + s.active, 0) || 0;
  const totalInactive = sellersData?.reduce((sum, s) => sum + s.inactive, 0) || 0;
  const totalProspecting = sellersData?.reduce((sum, s) => sum + s.prospecting, 0) || 0;
  const grandTotal = totalActive + totalInactive + totalProspecting;

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Clientes por Vendedor
        </CardTitle>
        <div className="flex items-center gap-2 text-xs">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="border-green-500 bg-green-500/10 text-green-700 gap-1">
                  <UserCheck className="h-3 w-3" />
                  {totalActive}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Clientes ativos (com vendas)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="border-yellow-500 bg-yellow-500/10 text-yellow-700 gap-1">
                  <UserPlus className="h-3 w-3" />
                  {totalProspecting}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Em prospecção (negócios abertos)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="border-muted-foreground bg-muted text-muted-foreground gap-1">
                  <UserX className="h-3 w-3" />
                  {totalInactive}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Clientes inativos</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {sellersData && sellersData.length > 0 ? (
              sellersData.map((seller) => (
                <div
                  key={seller.userId}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {seller.userName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[150px]">{seller.userName}</p>
                      <p className="text-xs text-muted-foreground">{seller.total} clientes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="border-green-500 bg-green-500/10 text-green-700 text-xs px-2">
                      {seller.active}
                    </Badge>
                    <Badge variant="outline" className="border-yellow-500 bg-yellow-500/10 text-yellow-700 text-xs px-2">
                      {seller.prospecting}
                    </Badge>
                    <Badge variant="outline" className="text-xs px-2">
                      {seller.inactive}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum cliente cadastrado</p>
              </div>
            )}
          </div>
        </ScrollArea>
        {grandTotal > 0 && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>{grandTotal} clientes no total</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Ativo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Prospecção
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                Inativo
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
