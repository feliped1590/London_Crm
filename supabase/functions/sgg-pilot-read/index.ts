import { sggGet, type SggApiErrorPayload } from '../_shared/sgg/client.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };

interface PilotRequest {
  companyDocument: string;
  employeeName: string;
}

type JsonRecord = Record<string, unknown>;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatCnpj(value: string): string {
  const normalized = digits(value);
  if (normalized.length !== 14) throw new Error('CNPJ do piloto deve conter 14 dígitos.');
  return normalized.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
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

function apiError(payload: SggApiErrorPayload): string | null {
  const code = payload.statusCode || payload.erro;
  if (!code || code === 'D000' || code === 'D001') return null;
  return `${code}: ${payload.statusMsg || payload.msg || 'Erro retornado pela SGG.'}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return response({ error: 'Método não permitido.' }, 405);

  const configuredSecret = Deno.env.get('SGG_SYNC_CRON_SECRET');
  const providedSecret = req.headers.get('x-sgg-sync-secret');
  if (!configuredSecret || !providedSecret || configuredSecret !== providedSecret) {
    return response({ error: 'Não autorizado.' }, 401);
  }

  try {
    const body = await req.json() as PilotRequest;
    const companyDocument = formatCnpj(body.companyDocument || '');
    const employeeName = body.employeeName?.trim();
    if (!employeeName || employeeName.length > 160) {
      return response({ error: 'Nome do funcionário inválido.' }, 400);
    }

    let companies: JsonRecord[] = [];
    const companyFilters = [
      { cnpj_cpf: companyDocument },
      { codigo: digits(companyDocument) },
    ];
    for (const companyFilter of companyFilters) {
      const companyResult = await sggGet<JsonRecord>('empresa/', {
        ...companyFilter,
        paginador: { pagina: 0, tamanho: 10 },
      });
      const companyFailure = apiError(companyResult.payload);
      if (companyFailure) throw new Error(`Consulta de empresa: ${companyFailure}`);
      companies = records(companyResult.payload);
      if (companies.length > 0) break;
    }
    const company = companies[0];
    if (!company) {
      let employee: JsonRecord | undefined;
      for (const nameVariant of [`NOME_${employeeName}`, employeeName, `NOME_${employeeName.toUpperCase()}`]) {
        const employeeResult = await sggGet<JsonRecord>('funcionario/', {
          funcionario: nameVariant,
          paginador: { pagina: 0, tamanho: 10 },
        });
        const employeeFailure = apiError(employeeResult.payload);
        if (employeeFailure) throw new Error(`Consulta de funcionário: ${employeeFailure}`);
        employee = records(employeeResult.payload)[0];
        if (employee) break;
      }

      return response({
        success: true,
        companyFound: false,
        employeeFound: Boolean(employee),
        employee: employee ? {
          sggId: String(employee.id_funcionario ?? employee.codigo ?? ''),
          associatedCompanySggId: String(employee.id_empresa ?? ''),
          status: employee.situacao ?? null,
          admissionDate: employee.data_admissao ?? null,
          dismissalDate: employee.data_demissao ?? null,
          lastEditedAt: employee.data_hora_edicao ?? null,
        } : null,
      });
    }

    const companyId = String(company.id_empresa ?? company.codigo ?? '');
    if (!companyId) throw new Error('Empresa localizada, mas sem identificador SGG na resposta.');

    const employeeResult = await sggGet<JsonRecord>('funcionario/', {
      id_empresa: companyId,
      funcionario: `NOME_${employeeName}`,
      paginador: { pagina: 0, tamanho: 10 },
    });
    const employeeFailure = apiError(employeeResult.payload);
    if (employeeFailure) throw new Error(`Consulta de funcionário: ${employeeFailure}`);

    const employees = records(employeeResult.payload);
    const employee = employees[0];

    return response({
      success: true,
      companyFound: true,
      company: {
        sggId: companyId,
        active: String(company.situacao ?? '').toLowerCase() !== 'inativa',
      },
      employeeFound: Boolean(employee),
      employee: employee ? {
        sggId: String(employee.id_funcionario ?? employee.codigo ?? ''),
        status: employee.situacao ?? null,
        admissionDate: employee.data_admissao ?? null,
        dismissalDate: employee.data_demissao ?? null,
        lastEditedAt: employee.data_hora_edicao ?? null,
      } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('[sgg-pilot-read] Falha sanitizada:', message);
    return response({ success: false, error: message }, 502);
  }
});
