import { useNavigate, useLocation } from "react-router-dom";
import { Clock, ArrowLeft, Building2, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { weekdayName, formatBrDate, type AccessBlockedInfo } from "@/lib/accessWindowInfo";

interface LocationState {
  info?: AccessBlockedInfo;
}

export default function AccessBlocked() {
  const navigate = useNavigate();
  const location = useLocation();
  const info = (location.state as LocationState | null)?.info;

  const hasDetails = Boolean(info && info.scope !== 'unknown');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Clock className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Fora do horário permitido</CardTitle>
          <CardDescription className="mt-2">
            Sua empresa restringe o acesso ao CRM aos horários autorizados.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {hasDetails && info && (
            <>
              <Separator />

              {/* CNPJ aplicado */}
              {info.legalEntityName && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                      Empresa aplicada
                    </p>
                    <p className="text-sm font-semibold mt-0.5 truncate">
                      {info.legalEntityName}
                    </p>
                  </div>
                </div>
              )}

              {/* Hoje */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Horários permitidos hoje
                  </p>
                  {info.todayException ? (
                    <div className="mt-1.5">
                      {info.todayException.isAllowed ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Liberação especial
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Bloqueado por exceção
                        </Badge>
                      )}
                      {info.todayException.description && (
                        <p className="text-sm mt-1.5 text-muted-foreground">
                          {info.todayException.description}
                        </p>
                      )}
                    </div>
                  ) : info.todayIntervals.length === 0 ? (
                    <p className="text-sm mt-0.5 text-muted-foreground">
                      Hoje não há janela de acesso liberada.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {info.todayIntervals.map((iv, idx) => (
                        <li key={idx} className="text-sm font-medium">
                          {iv.start} às {iv.end}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Próximo horário liberado */}
              {info.nextWindow && (
                <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-primary font-medium">
                      Próximo horário liberado
                    </p>
                    <p className="text-sm font-semibold mt-0.5">
                      {info.nextWindow.daysFromNow === 0
                        ? `Hoje às ${info.nextWindow.start}`
                        : `${weekdayName(info.nextWindow.weekday)}, ${formatBrDate(info.nextWindow.date)} às ${info.nextWindow.start}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Janela: {info.nextWindow.start} – {info.nextWindow.end}
                    </p>
                  </div>
                </div>
              )}

              <Separator />
            </>
          )}

          <p className="text-sm text-muted-foreground text-center">
            Se você acredita que deveria ter acesso agora, contate o
            administrador da sua empresa.
          </p>

          <Button
            onClick={() => navigate("/auth", { replace: true })}
            className="w-full"
            variant="outline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
