const DEFAULT_BASE_URL = 'https://app.sgg.net.br/api/v3/';

export interface SggApiErrorPayload {
  erro?: string;
  msg?: string;
}

export interface SggProbeResult {
  authenticated: boolean;
  reachable: boolean;
  status: number;
  apiCode: string | null;
  message: string;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function basicAuthorization(apiKey: string): string {
  return `Basic ${btoa(`${apiKey}:`)}`;
}

function validateApiKey(apiKey: string): void {
  if (!/^[a-zA-Z0-9]{32}$/.test(apiKey)) {
    throw new Error('SGG_API_KEY deve conter exatamente 32 caracteres alfanuméricos.');
  }
}

async function safeJson(response: Response): Promise<SggApiErrorPayload> {
  try {
    return await response.json() as SggApiErrorPayload;
  } catch {
    return {};
  }
}

/**
 * Verifica conectividade e autenticação sem executar nenhuma operação de escrita.
 *
 * A documentação da SGG exige JSON no corpo inclusive para GET. A Fetch API não
 * permite corpo em GET, então esta sondagem chama o endpoint sem filtros. Uma
 * chave válida pode receber D011 (JSON ausente); esse retorno já comprova que a
 * credencial passou pela camada de autenticação.
 */
export async function probeSggConnection(): Promise<SggProbeResult> {
  const apiKey = Deno.env.get('SGG_API_KEY')?.trim();
  if (!apiKey) {
    throw new Error('Secret SGG_API_KEY não configurado.');
  }
  validateApiKey(apiKey);

  const baseUrl = normalizeBaseUrl(
    Deno.env.get('SGG_API_BASE_URL')?.trim() || DEFAULT_BASE_URL,
  );

  const response = await fetch(new URL('empresa/', baseUrl), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuthorization(apiKey),
    },
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await safeJson(response);
  const apiCode = typeof payload.erro === 'string' ? payload.erro : null;
  const authenticationRejected = apiCode === 'A000' || apiCode === 'A001' ||
    response.status === 401 || response.status === 403;

  return {
    authenticated: !authenticationRejected,
    reachable: true,
    status: response.status,
    apiCode,
    message: authenticationRejected
      ? 'A SGG recusou a chave de API.'
      : 'A API SGG respondeu e aceitou a camada de autenticação.',
  };
}

