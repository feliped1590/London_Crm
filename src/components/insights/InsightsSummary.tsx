import { Link } from "react-router-dom";
import { AlertTriangle, Building2, TrendingDown, Clock, FileText, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusinessInsights } from "@/hooks/useBusinessInsights";

export function InsightsSummary() {
  const { inactiveCustomers, stagnantDeals, overdueTasks, expiringProposals, summary, isLoading } = useBusinessInsights();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summary.totalAlerts === 0) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-green-600" />
            Alertas e Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-600 font-medium">✓ Tudo em ordem!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nenhum alerta identificado no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  const alerts = [
    {
      icon: Building2,
      label: "Clientes inativos",
      count: inactiveCustomers.length,
      critical: inactiveCustomers.filter((c) => c.severity === "critical").length,
    },
    {
      icon: TrendingDown,
      label: "Negócios parados",
      count: stagnantDeals.length,
      critical: stagnantDeals.filter((d) => d.severity === "critical").length,
    },
    {
      icon: Clock,
      label: "Tarefas atrasadas",
      count: overdueTasks.length,
      critical: overdueTasks.filter((t) => t.severity === "critical").length,
    },
    {
      icon: FileText,
      label: "Propostas expirando",
      count: expiringProposals.length,
      critical: expiringProposals.filter((p) => p.severity === "critical").length,
    },
  ].filter((a) => a.count > 0);

  return (
    <Card
      className={
        summary.criticalCount > 0
          ? "border-destructive/50 bg-destructive/5"
          : "border-yellow-500/50 bg-yellow-500/5"
      }
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle
            className={`h-4 w-4 ${
              summary.criticalCount > 0 ? "text-destructive" : "text-yellow-600"
            }`}
          />
          Alertas e Insights
        </CardTitle>
        <div className="flex gap-2">
          {summary.criticalCount > 0 && (
            <Badge variant="destructive">{summary.criticalCount} críticos</Badge>
          )}
          {summary.warningCount > 0 && (
            <Badge variant="outline" className="border-yellow-500 bg-yellow-500/10 text-yellow-700">
              {summary.warningCount} atenção
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-1"
            >
              <div className="flex items-center gap-2 text-sm">
                <alert.icon className="h-4 w-4 text-muted-foreground" />
                <span>{alert.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{alert.count}</span>
                {alert.critical > 0 && (
                  <Badge variant="destructive" className="text-xs h-5">
                    {alert.critical}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button variant="link" className="mt-2 p-0 h-auto" asChild>
          <Link to="/insights" className="flex items-center gap-1 text-sm">
            Ver detalhes
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
