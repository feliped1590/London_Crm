import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  title: string;
  icon: ReactNode;
  count: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  onClick?: () => void;
}

export function InsightCard({
  title,
  icon,
  count,
  criticalCount,
  warningCount,
  infoCount,
  onClick,
}: InsightCardProps) {
  const hasCritical = criticalCount > 0;
  const hasWarning = warningCount > 0;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        hasCritical && "border-destructive/50 bg-destructive/5",
        !hasCritical && hasWarning && "border-yellow-500/50 bg-yellow-500/5"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-5 w-5 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {criticalCount} crítico{criticalCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline" className="border-yellow-500 bg-yellow-500/10 text-yellow-700 text-xs">
              {warningCount} atenção
            </Badge>
          )}
          {infoCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {infoCount} info
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
