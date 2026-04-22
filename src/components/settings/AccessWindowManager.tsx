import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import { useLegalEntities } from '@/hooks/useLegalEntities';
import {
  useAccessWindowConfig,
  useAccessWindowStatus,
  type AccessException,
  WEEKDAYS,
} from '@/hooks/useAccessWindowConfig';
import { formatCNPJ } from '@/lib/cpfCnpjMask';

import { AccessWindowDayRow } from './AccessWindowDayRow';
import { AccessExceptionDialog } from './AccessExceptionDialog';

export function AccessWindowManager() {
  const { accessibleEntities, isLoading: entitiesLoading } = useLegalEntities();
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Default selection: first entity
  const effectiveEntityId =
    selectedEntityId ?? (accessibleEntities[0]?.id ?? null);
  const selectedEntity = accessibleEntities.find((e) => e.id === effectiveEntityId) ?? null;

  const {
    schedules,
    exceptions,
    isLoading,
    hasOwnRules,
    addSchedule,
    toggleSchedule,
    deleteSchedule,
    applyWeekdayPreset,
    upsertException,
    deleteException,
  } = useAccessWindowConfig(effectiveEntityId);

  const { data: isWithinWindow } = useAccessWindowStatus();

  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [editingException, setEditingException] = useState<AccessException | null>(null);
  const [presetConfirmOpen, setPresetConfirmOpen] = useState(false);

  const intervalsByDay = useMemo(() => {
    const map = new Map<number, typeof schedules>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    schedules.forEach((s) => {
      map.get(s.weekday)?.push(s);
    });
    return map;
  }, [schedules]);

  if (entitiesLoading) {
    return <p className="text-sm text-muted-foreground">Carregando entidades jurídicas…</p>;
  }

  if (accessibleEntities.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma entidade jurídica (CNPJ) cadastrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header / seletor de CNPJ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Janela de Acesso por CNPJ
          </CardTitle>
          <CardDescription>
            Defina os horários e dias permitidos para que vendedores e atendentes acessem o
            CRM. A regra escolhida vale para o CNPJ que o usuário tem como ativo.
            Administradores e desenvolvedores são imunes (mas auditados).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[260px]">
              <Select
                value={effectiveEntityId ?? ''}
                onValueChange={(v) => setSelectedEntityId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um CNPJ" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleEntities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{e.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatCNPJ(e.cnpj)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEntity && (
              <Badge variant={hasOwnRules ? 'default' : 'secondary'} className="gap-1">
                {hasOwnRules ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Regra própria deste CNPJ
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Sem regra — usando fallback do tenant (24/7 se não houver)
                  </>
                )}
              </Badge>
            )}

            {typeof isWithinWindow === 'boolean' && (
              <Badge variant={isWithinWindow ? 'default' : 'destructive'} className="gap-1">
                {isWithinWindow ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Acesso PERMITIDO agora (você)
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    FORA da janela agora (você)
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grade semanal */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Grade semanal
            </CardTitle>
            <CardDescription>
              Adicione um ou mais intervalos por dia. Dias sem intervalos ficam bloqueados.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPresetConfirmOpen(true)}
            disabled={!selectedEntity || applyWeekdayPreset.isPending}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Aplicar Seg–Sex 08:00–18:00
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div>
              {WEEKDAYS.map((_, weekday) => (
                <AccessWindowDayRow
                  key={weekday}
                  weekday={weekday}
                  intervals={intervalsByDay.get(weekday) ?? []}
                  disabled={!selectedEntity || addSchedule.isPending}
                  onAdd={(start, end) =>
                    selectedEntity &&
                    addSchedule.mutate({
                      tenantId: selectedEntity.tenant_id,
                      weekday,
                      start_time: start,
                      end_time: end,
                    })
                  }
                  onToggle={(id, isActive) =>
                    toggleSchedule.mutate({ id, is_active: isActive })
                  }
                  onDelete={(id) => deleteSchedule.mutate(id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exceções */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Exceções (feriados / liberações)</CardTitle>
            <CardDescription>
              Datas pontuais que sobrescrevem a grade semanal.
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditingException(null);
              setExceptionDialogOpen(true);
            }}
            disabled={!selectedEntity}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova exceção
          </Button>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma exceção cadastrada para este CNPJ.
            </p>
          ) : (
            <div className="divide-y">
              {exceptions.map((ex) => {
                const [y, m, d] = ex.exception_date.split('-').map(Number);
                const localDate = new Date(y, m - 1, d);
                return (
                  <div
                    key={ex.id}
                    className="flex items-center gap-3 py-2.5 hover:bg-muted/30 -mx-2 px-2 rounded"
                  >
                    <Badge
                      variant={ex.is_allowed ? 'default' : 'destructive'}
                      className="gap-1"
                    >
                      {ex.is_allowed ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {ex.is_allowed ? 'Liberado' : 'Bloqueado'}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {format(localDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      {ex.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {ex.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingException(ex);
                        setExceptionDialogOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:text-destructive"
                      onClick={() => deleteException.mutate(ex.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        ℹ️ A configuração é resolvida em tempo real: a sessão do usuário é validada a cada
        ~60 segundos. Mudanças entram em vigor imediatamente para novos logins e em até
        1 minuto para sessões ativas.
      </p>

      {/* Dialog de exceção */}
      <AccessExceptionDialog
        open={exceptionDialogOpen}
        onOpenChange={setExceptionDialogOpen}
        initial={editingException}
        isPending={upsertException.isPending}
        onSubmit={(input) => {
          if (!selectedEntity) return;
          upsertException.mutate(
            { ...input, tenantId: selectedEntity.tenant_id },
            { onSuccess: () => setExceptionDialogOpen(false) },
          );
        }}
      />

      {/* Confirmação do preset */}
      <AlertDialog open={presetConfirmOpen} onOpenChange={setPresetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar preset Seg–Sex 08:00–18:00?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai <strong>remover todos os intervalos atuais</strong> deste CNPJ e
              substituir por Segunda a Sexta, das 08:00 às 18:00. As exceções
              (feriados/liberações) não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!selectedEntity) return;
                applyWeekdayPreset.mutate(
                  { tenantId: selectedEntity.tenant_id },
                  { onSuccess: () => setPresetConfirmOpen(false) },
                );
              }}
            >
              Aplicar preset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
