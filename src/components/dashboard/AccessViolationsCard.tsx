import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldAlert, UserCheck } from "lucide-react";
import { useAccessViolations } from "@/hooks/useAccessViolations";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { Skeleton } from "@/components/ui/skeleton";

const ACTION_LABEL: Record<string, { label: string; icon: typeof Clock; tone: string }> = {
  outside_allowed_hours: { label: "Fora do horário", icon: Clock, tone: "text-destructive" },
  admin_bypass: { label: "Bypass de admin", icon: ShieldAlert, tone: "text-amber-600" },
};

/**
 * Card admin-only com resumo das violações de janela de acesso (últimos 30 dias).
 * Aparece apenas para admin/desenvolvedor.
 */
export function AccessViolationsCard() {
  const { isAdmin } = useModulePermissions();
  const { data, isLoading } = useAccessViolations(30);

  if (!isAdmin) return null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acessos fora da jornada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.error) return null;

  const total = data.total ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Acessos fora da jornada
          </CardTitle>
          <Badge variant={total > 0 ? "destructive" : "secondary"}>
            {total} eventos
          </Badge>
        </div>
        <CardDescription>Últimos {data.period_days} dias</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            Nenhuma violação no período.
          </p>
        ) : (
          <>
            {/* Por tipo */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Por tipo</p>
              <div className="flex flex-wrap gap-2">
                {data.by_action.map((a) => {
                  const meta = ACTION_LABEL[a.action] ?? {
                    label: a.action,
                    icon: Clock,
                    tone: "text-foreground",
                  };
                  const Icon = meta.icon;
                  return (
                    <div
                      key={a.action}
                      className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                    >
                      <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                      <span>{meta.label}</span>
                      <Badge variant="outline" className="ml-1 h-5">
                        {a.total}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top usuários */}
            {data.by_user.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Top usuários
                </p>
                <ul className="space-y-1">
                  {data.by_user.slice(0, 5).map((u) => (
                    <li
                      key={u.user_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate">{u.user_name}</span>
                      <Badge variant="outline">{u.total}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
