import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { toast } from 'sonner';

export interface AccessSchedule {
  id: string;
  tenant_id: string;
  legal_entity_id: string;
  weekday: number; // 0=Dom..6=Sáb
  start_time: string; // 'HH:MM:SS'
  end_time: string;   // 'HH:MM:SS'
  is_active: boolean;
  created_at: string;
}

export interface AccessException {
  id: string;
  tenant_id: string;
  legal_entity_id: string;
  exception_date: string; // 'YYYY-MM-DD'
  is_allowed: boolean;
  description: string | null;
  created_at: string;
}

export const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** Normaliza 'HH:MM' ou 'HH:MM:SS' para 'HH:MM:SS' */
function normalizeTime(t: string): string {
  if (!t) return t;
  const parts = t.split(':');
  if (parts.length === 2) return `${t}:00`;
  return t;
}

/** Detecta sobreposição entre [aStart,aEnd) e [bStart,bEnd) */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export function useAccessWindowConfig(legalEntityId: string | null) {
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['legal_entity_access_schedules', legalEntityId],
    enabled: !!legalEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_entity_access_schedules')
        .select('*')
        .eq('legal_entity_id', legalEntityId!)
        .order('weekday')
        .order('start_time');
      if (error) throw error;
      return data as AccessSchedule[];
    },
  });

  const { data: exceptions = [], isLoading: exceptionsLoading } = useQuery({
    queryKey: ['legal_entity_access_exceptions', legalEntityId],
    enabled: !!legalEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_entity_access_exceptions')
        .select('*')
        .eq('legal_entity_id', legalEntityId!)
        .order('exception_date', { ascending: false });
      if (error) throw error;
      return data as AccessException[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['legal_entity_access_schedules', legalEntityId] });
    queryClient.invalidateQueries({ queryKey: ['legal_entity_access_exceptions', legalEntityId] });
    queryClient.invalidateQueries({ queryKey: ['access_window_status'] });
  };

  // ---- Schedules ---------------------------------------------------------

  const addSchedule = useMutation({
    mutationFn: async (input: {
      tenantId: string;
      weekday: number;
      start_time: string;
      end_time: string;
    }) => {
      if (!legalEntityId) throw new Error('CNPJ não selecionado');
      const start = normalizeTime(input.start_time);
      const end = normalizeTime(input.end_time);
      if (start >= end) throw new Error('Horário final precisa ser maior que o inicial');

      // Validação client-side de sobreposição com intervalos ATIVOS do mesmo dia
      const sameDay = schedules.filter(s => s.weekday === input.weekday && s.is_active);
      const conflict = sameDay.find(s => overlaps(start, end, s.start_time, s.end_time));
      if (conflict) {
        throw new Error(
          `Conflito com intervalo existente ${conflict.start_time.slice(0, 5)}–${conflict.end_time.slice(0, 5)}`,
        );
      }

      const { error } = await supabase.from('legal_entity_access_schedules').insert({
        tenant_id: input.tenantId,
        legal_entity_id: legalEntityId,
        weekday: input.weekday,
        start_time: start,
        end_time: end,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Intervalo adicionado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSchedule = useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('legal_entity_access_schedules')
        .update({ is_active: input.is_active })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message || 'Erro ao alterar'),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('legal_entity_access_schedules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Intervalo removido');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao remover'),
  });

  /** Aplica preset Seg–Sex 08:00–18:00 (substitui regras anteriores). */
  const applyWeekdayPreset = useMutation({
    mutationFn: async (input: { tenantId: string }) => {
      if (!legalEntityId) throw new Error('CNPJ não selecionado');
      // Apaga tudo do CNPJ
      const { error: delErr } = await supabase
        .from('legal_entity_access_schedules')
        .delete()
        .eq('legal_entity_id', legalEntityId);
      if (delErr) throw delErr;

      const rows = [1, 2, 3, 4, 5].map(weekday => ({
        tenant_id: input.tenantId,
        legal_entity_id: legalEntityId,
        weekday,
        start_time: '08:00:00',
        end_time: '18:00:00',
        is_active: true,
      }));
      const { error } = await supabase.from('legal_entity_access_schedules').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Preset Seg–Sex 08:00–18:00 aplicado');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao aplicar preset'),
  });

  // ---- Exceptions --------------------------------------------------------

  const upsertException = useMutation({
    mutationFn: async (input: {
      tenantId: string;
      id?: string;
      exception_date: string;
      is_allowed: boolean;
      description: string | null;
    }) => {
      if (!legalEntityId) throw new Error('CNPJ não selecionado');
      if (input.id) {
        const { error } = await supabase
          .from('legal_entity_access_exceptions')
          .update({
            exception_date: input.exception_date,
            is_allowed: input.is_allowed,
            description: input.description,
          })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('legal_entity_access_exceptions').insert({
          tenant_id: input.tenantId,
          legal_entity_id: legalEntityId,
          exception_date: input.exception_date,
          is_allowed: input.is_allowed,
          description: input.description,
        });
        if (error) {
          if (error.code === '23505') {
            throw new Error('Já existe uma exceção para essa data neste CNPJ');
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success('Exceção salva');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao salvar exceção'),
  });

  const deleteException = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('legal_entity_access_exceptions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Exceção removida');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao remover'),
  });

  return {
    schedules,
    exceptions,
    isLoading: schedulesLoading || exceptionsLoading,
    hasOwnRules: schedules.length > 0 || exceptions.length > 0,
    addSchedule,
    toggleSchedule,
    deleteSchedule,
    applyWeekdayPreset,
    upsertException,
    deleteException,
  };
}

/** Status atual: chama is_within_access_window com o user logado. */
export function useAccessWindowStatus() {
  return useQuery({
    queryKey: ['access_window_status'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: userResp } = await ({ data: { user: await getCurrentUser() } } as { data: { user: Awaited<ReturnType<typeof getCurrentUser>> } });
      const uid = userResp.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase.rpc('is_within_access_window', { p_user_id: uid });
      if (error) throw error;
      return data as boolean;
    },
  });
}
