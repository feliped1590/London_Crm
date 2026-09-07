import { sggGet, type SggApiErrorPayload } from '../_shared/sgg/client.ts';

type JsonRecord = Record<string, unknown>;

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

function assertNoApiError(payload: SggApiErrorPayload, context: string): void {
  const code = payload.statusCode || payload.erro;
  if (!code || code === 'D000' || code === 'D001') return;
  throw new Error(`${context}: ${code}: ${payload.statusMsg || payload.msg || 'Erro retornado pela SGG.'}`);
}

function authorized(req: Request): boolean {
  const configured = Deno.env.get('SGG_SYNC_CRON_SECRET');
  const provided = req.headers.get('x-sgg-sync-secret');
  return Boolean(configured && provided && configured === provided);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return response({ error: 'Método não permitido.' }, 405);
  if (!authorized(req)) return response({ error: 'Não autorizado.' }, 401);

  try {
    const body = await req.json().catch(() => ({})) as { companyId?: string };

    if (!body.companyId) {
      const result = await sggGet<JsonRecord>('empresa/', {
        paginador: { pagina: 0, tamanho: 100 },
      });
      assertNoApiError(result.payload, 'Consulta de empresas');
      const companies = records(result.payload).map((company) => ({
        sggId: String(company.id_empresa ?? company.codigo ?? ''),
        corporateName: company.nome ?? company.razao_social ?? null,
        tradeName: company.fantasia ?? company.nome_fantasia ?? null,
        document: company.CNPJ ?? company.cnpj ?? company.CPF ?? company.cpf ?? null,
        status: company.situacao ?? null,
      }));
      return response({ success: true, count: companies.length, companies });
    }

    const result = await sggGet<JsonRecord>('funcionario/', {
      id_empresa: body.companyId,
      paginador: { pagina: 0, tamanho: 100 },
    });
    assertNoApiError(result.payload, 'Consulta de funcionários');
    const employees = records(result.payload).map((employee) => ({
      sggId: String(employee.id_funcionario ?? employee.codigo ?? ''),
      name: employee.nome ?? null,
      status: employee.situacao ?? null,
      admissionDate: employee.data_admissao ?? null,
      dismissalDate: employee.data_demissao ?? null,
      role: employee.funcao ?? employee.cargo ?? null,
      sector: employee.setor ?? null,
      lastEditedAt: employee.data_hora_edicao ?? null,
    }));
    return response({ success: true, companySggId: body.companyId, count: employees.length, employees });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('[sgg-inventory-read] Falha sanitizada:', message);
    return response({ success: false, error: message }, 502);
  }
});

