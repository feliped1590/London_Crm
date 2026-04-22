// Helper para coletar informações da janela de acesso aplicada ao usuário,
// chamado no momento do bloqueio (ainda autenticado no Auth.tsx) para passar
// dados úteis para a tela /access-blocked.
//
// Não falha se algo der errado — é apenas enriquecimento de UX.

import { supabase } from '@/integrations/supabase/client';

export interface AccessBlockedInfo {
  legalEntityName: string | null;
  scope: 'legal_entity' | 'tenant' | 'unknown';
  todayIntervals: Array<{ start: string; end: string }>;
  nextWindow: {
    date: string; // YYYY-MM-DD
    weekday: number; // 0=Dom..6=Sáb
    start: string; // HH:MM
    end: string; // HH:MM
    daysFromNow: number;
  } | null;
  todayException: {
    isAllowed: boolean;
    description: string | null;
  } | null;
}

const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export function weekdayName(n: number): string {
  return WEEKDAY_NAMES[n] ?? '';
}

export function formatBrDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export async function fetchAccessBlockedInfo(
  userId: string,
): Promise<AccessBlockedInfo> {
  const fallback: AccessBlockedInfo = {
    legalEntityName: null,
    scope: 'unknown',
    todayIntervals: [],
    nextWindow: null,
    todayException: null,
  };

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_legal_entity_id, active_tenant_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) return fallback;

    const legalEntityId = (profile as any).active_legal_entity_id as string | null;
    const tenantId = (profile as any).active_tenant_id as string | null;

    let legalEntityName: string | null = null;
    let useLegalEntityRules = false;

    if (legalEntityId) {
      const [{ data: le }, { data: leSchedules }, { data: leExceptions }] =
        await Promise.all([
          supabase
            .from('legal_entities')
            .select('name')
            .eq('id', legalEntityId)
            .maybeSingle(),
          supabase
            .from('legal_entity_access_schedules')
            .select('id')
            .eq('legal_entity_id', legalEntityId)
            .eq('is_active', true)
            .limit(1),
          supabase
            .from('legal_entity_access_exceptions')
            .select('id')
            .eq('legal_entity_id', legalEntityId)
            .limit(1),
        ]);

      legalEntityName = ((le as any)?.name as string | undefined) ?? null;
      useLegalEntityRules =
        ((leSchedules as any[] | null)?.length ?? 0) > 0 ||
        ((leExceptions as any[] | null)?.length ?? 0) > 0;
    }

    // Data/hora local em America/Sao_Paulo
    const tz = 'America/Sao_Paulo';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    const isoLocalDate = `${get('year')}-${get('month')}-${get('day')}`;
    const localTime = `${get('hour')}:${get('minute')}:${get('second')}`;
    const weekday = new Date(`${isoLocalDate}T12:00:00`).getDay();

    let todayIntervals: AccessBlockedInfo['todayIntervals'] = [];
    let todayException: AccessBlockedInfo['todayException'] = null;
    let nextWindow: AccessBlockedInfo['nextWindow'] = null;
    const scope: AccessBlockedInfo['scope'] = useLegalEntityRules
      ? 'legal_entity'
      : tenantId
        ? 'tenant'
        : 'unknown';

    if (useLegalEntityRules && legalEntityId) {
      const { data: exception } = await supabase
        .from('legal_entity_access_exceptions')
        .select('is_allowed, description')
        .eq('legal_entity_id', legalEntityId)
        .eq('exception_date', isoLocalDate)
        .maybeSingle();
      if (exception) {
        todayException = {
          isAllowed: (exception as any).is_allowed,
          description: (exception as any).description ?? null,
        };
      }

      const { data: today } = await supabase
        .from('legal_entity_access_schedules')
        .select('start_time, end_time')
        .eq('legal_entity_id', legalEntityId)
        .eq('is_active', true)
        .eq('weekday', weekday)
        .order('start_time');
      todayIntervals = ((today as any[] | null) ?? []).map((s) => ({
        start: String(s.start_time).slice(0, 5),
        end: String(s.end_time).slice(0, 5),
      }));

      nextWindow = await findNextWindow(
        'legal_entity',
        legalEntityId,
        isoLocalDate,
        localTime,
        weekday,
      );
    } else if (tenantId) {
      const { data: today } = await supabase
        .from('tenant_access_schedules')
        .select('start_time, end_time')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('weekday', weekday)
        .order('start_time');
      todayIntervals = ((today as any[] | null) ?? []).map((s) => ({
        start: String(s.start_time).slice(0, 5),
        end: String(s.end_time).slice(0, 5),
      }));

      nextWindow = await findNextWindow(
        'tenant',
        tenantId,
        isoLocalDate,
        localTime,
        weekday,
      );
    }

    return {
      legalEntityName,
      scope,
      todayIntervals,
      nextWindow,
      todayException,
    };
  } catch (err) {
    console.warn('[accessWindowInfo] Falha ao montar info:', err);
    return fallback;
  }
}

async function findNextWindow(
  scope: 'legal_entity' | 'tenant',
  ownerId: string,
  isoLocalDate: string,
  localTime: string,
  todayWeekday: number,
): Promise<AccessBlockedInfo['nextWindow']> {
  const table =
    scope === 'legal_entity'
      ? 'legal_entity_access_schedules'
      : 'tenant_access_schedules';
  const ownerCol = scope === 'legal_entity' ? 'legal_entity_id' : 'tenant_id';

  // Hoje, depois de agora?
  const { data: laterToday } = await (supabase as any)
    .from(table)
    .select('start_time, end_time')
    .eq(ownerCol, ownerId)
    .eq('is_active', true)
    .eq('weekday', todayWeekday)
    .gt('start_time', localTime)
    .order('start_time')
    .limit(1);

  if (laterToday && laterToday.length > 0) {
    const s = laterToday[0];
    return {
      date: isoLocalDate,
      weekday: todayWeekday,
      start: String(s.start_time).slice(0, 5),
      end: String(s.end_time).slice(0, 5),
      daysFromNow: 0,
    };
  }

  // Próximos 7 dias
  for (let i = 1; i <= 7; i++) {
    const d = new Date(`${isoLocalDate}T12:00:00`);
    d.setDate(d.getDate() + i);
    const checkDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const checkWeekday = d.getDay();

    if (scope === 'legal_entity') {
      const { data: blocked } = await supabase
        .from('legal_entity_access_exceptions')
        .select('id')
        .eq('legal_entity_id', ownerId)
        .eq('exception_date', checkDate)
        .eq('is_allowed', false)
        .limit(1);
      if (blocked && blocked.length > 0) continue;
    }

    const { data: next } = await (supabase as any)
      .from(table)
      .select('start_time, end_time')
      .eq(ownerCol, ownerId)
      .eq('is_active', true)
      .eq('weekday', checkWeekday)
      .order('start_time')
      .limit(1);

    if (next && next.length > 0) {
      const s = next[0];
      return {
        date: checkDate,
        weekday: checkWeekday,
        start: String(s.start_time).slice(0, 5),
        end: String(s.end_time).slice(0, 5),
        daysFromNow: i,
      };
    }
  }

  return null;
}
