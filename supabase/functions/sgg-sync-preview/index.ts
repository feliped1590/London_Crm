import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sggGet, type SggApiErrorPayload } from '../_shared/sgg/client.ts';

type JsonRecord = Record<string, unknown>;

const PILOT = {
  sggCompanyId: '106',
  cnpjMasked: '64.655.527/0001-37',
  cnpjDigits: '64655527000137',
  nameQuery: '%MATOS BLOWING%',
} as const;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function records(payload: JsonRecord): JsonRecord[] {
  const candidate = payload.resultado ?? payload.result ?? payload.dados ?? payload.data;
  if (Array.isArray(candidate)) return candidate.filter((item): item is JsonRecord => Boolean(item && typeof item === 'object'));
  if (candidate && typeof candidate === 'object') {
    const container = candidate as JsonRecord;
    const nested = container.registros ?? container.itens ?? container.items ?? container.dados ?? container.data;
    if (Array.isArray(nested)) return nested.filter((item): item is JsonRecord => Boolean(item && typeof item === 'object'));
    return [container];
  }
  return [];
}

function assertNoApiError(payload: SggApiErrorPayload): void {
  const code = payload.statusCode || payload.erro;
  if (!code || code === 'D000' || code === 'D001') return;
  throw new Error(`${code}: ${payload.statusMsg || payload.msg || 'Erro retornado pela SGG.'}`);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return response({ error: 'Método não permitido.' }, 405);

  const configuredSecret = Deno.env.get('SGG_SYNC_CRON_SECRET');
  const providedSecret = req.headers.get('x-sgg-sync-secret');
  if (!configuredSecret || !providedSecret || configuredSecret !== providedSecret) {
    return response({ error: 'Não autorizado.' }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Configuração interna do Supabase incompleta.');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let { data: crmCompanies, error: crmError } = await supabase
      .from('companies')
      .select('id, tenant_id, legal_entity_id, name, fantasia, cnpj, active')
      .in('cnpj', [PILOT.cnpjMasked, PILOT.cnpjDigits])
      .limit(5);

    if (crmError) throw new Error(`Falha ao localizar empresa no CRM: ${crmError.message}`);
    if (!crmCompanies?.length) {
      const nameLookup = await supabase
        .from('companies')
        .select('id, tenant_id, legal_entity_id, name, fantasia, cnpj, active')
        .ilike('name', PILOT.nameQuery)
        .limit(5);
      if (nameLookup.error) throw new Error(`Falha ao localizar empresa por nome: ${nameLookup.error.message}`);
      crmCompanies = nameLookup.data;
    }

    const sggResult = await sggGet<JsonRecord>('funcionario/', {
      id_empresa: PILOT.sggCompanyId,
      paginador: { pagina: 0, tamanho: 100 },
    });
    assertNoApiError(sggResult.payload);
    const employees = records(sggResult.payload);
    const active = employees.filter((employee) => String(employee.situacao).toLowerCase() === 'ativo').length;
    const dismissed = employees.filter((employee) => String(employee.situacao).toLowerCase() === 'demitido').length;
    const latestEdit = employees
      .map((employee) => String(employee.data_hora_edicao ?? ''))
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return response({
      success: true,
      writePerformed: false,
      pilot: {
        sggCompanyId: PILOT.sggCompanyId,
        crmMatches: (crmCompanies || []).map((company) => ({
          id: company.id,
          tenantId: company.tenant_id,
          legalEntityId: company.legal_entity_id,
          name: company.name,
          tradeName: company.fantasia,
          cnpj: company.cnpj,
          active: company.active,
        })),
        employeeSummary: {
          total: employees.length,
          active,
          dismissed,
          latestEdit,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('[sgg-sync-preview] Falha sanitizada:', message);
    return response({ success: false, writePerformed: false, error: message }, 502);
  }
});

