const DEFAULT_BASE_URL = 'https://app.sgg.net.br/api/v3/';

export interface SggApiErrorPayload {
  erro?: string;
  msg?: string;
  statusCode?: string;
  statusMsg?: string;
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

export interface SggGetResult<T = unknown> {
  status: number;
  payload: T & SggApiErrorPayload;
}

/** Envia o JSON no corpo de GET conforme contrato específico da API SGG. */
export async function sggGet<T = unknown>(
  path: string,
  filters: Record<string, unknown>,
): Promise<SggGetResult<T>> {
  const apiKey = Deno.env.get('SGG_API_KEY')?.trim();
  if (!apiKey) throw new Error('Secret SGG_API_KEY não configurado.');
  validateApiKey(apiKey);

  const baseUrl = normalizeBaseUrl(
    Deno.env.get('SGG_API_BASE_URL')?.trim() || DEFAULT_BASE_URL,
  );
  const url = new URL(path.replace(/^\/+/, ''), baseUrl);
  const body = JSON.stringify(filters);

  if (url.protocol !== 'https:') throw new Error('A URL da SGG deve usar HTTPS.');

  const encoder = new TextEncoder();
  const requestBytes = encoder.encode([
    `GET ${url.pathname}${url.search} HTTP/1.1`,
    `Host: ${url.hostname}`,
    'Accept: application/json',
    `Authorization: ${basicAuthorization(apiKey)}`,
    'Content-Type: application/json',
    `Content-Length: ${encoder.encode(body).byteLength}`,
    'Connection: close',
    '',
    body,
  ].join('\r\n'));

  const connection = await Deno.connectTls({ hostname: url.hostname, port: Number(url.port || 443) });
  try {
    let written = 0;
    while (written < requestBytes.byteLength) written += await connection.write(requestBytes.subarray(written));

    const chunks: Uint8Array[] = [];
    const buffer = new Uint8Array(16_384);
    while (true) {
      const read = await connection.read(buffer);
      if (read === null) break;
      chunks.push(buffer.slice(0, read));
    }

    const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const joined = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const raw = new TextDecoder().decode(joined);
    const headerEnd = raw.indexOf('\r\n\r\n');
    if (headerEnd < 0) throw new Error('Resposta HTTP inválida da SGG.');
    const headers = raw.slice(0, headerEnd);
    const status = Number(headers.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i)?.[1] || 0);
    let responseBody = raw.slice(headerEnd + 4);

    if (/transfer-encoding:\s*chunked/i.test(headers)) {
      let decoded = '';
      let cursor = 0;
      while (cursor < responseBody.length) {
        const lineEnd = responseBody.indexOf('\r\n', cursor);
        if (lineEnd < 0) break;
        const chunkSize = Number.parseInt(responseBody.slice(cursor, lineEnd).split(';')[0], 16);
        if (!Number.isFinite(chunkSize) || chunkSize === 0) break;
        const start = lineEnd + 2;
        decoded += responseBody.slice(start, start + chunkSize);
        cursor = start + chunkSize + 2;
      }
      responseBody = decoded;
    }

    const payload = JSON.parse(responseBody) as T & SggApiErrorPayload;
    return { status, payload };
  } finally {
    connection.close();
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
