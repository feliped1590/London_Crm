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

    let headerEnd = -1;
    for (let index = 0; index <= joined.byteLength - 4; index += 1) {
      if (joined[index] === 13 && joined[index + 1] === 10 && joined[index + 2] === 13 && joined[index + 3] === 10) {
        headerEnd = index;
        break;
      }
    }
    if (headerEnd < 0) throw new Error('Resposta HTTP inválida da SGG.');
    const headers = new TextDecoder().decode(joined.subarray(0, headerEnd));
    const status = Number(headers.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i)?.[1] || 0);
    let responseBodyBytes = joined.subarray(headerEnd + 4);

    if (/transfer-encoding:\s*chunked/i.test(headers)) {
      const decodedChunks: Uint8Array[] = [];
      let cursor = 0;
      while (cursor < responseBodyBytes.byteLength) {
        let lineEnd = -1;
        for (let index = cursor; index < responseBodyBytes.byteLength - 1; index += 1) {
          if (responseBodyBytes[index] === 13 && responseBodyBytes[index + 1] === 10) {
            lineEnd = index;
            break;
          }
        }
        if (lineEnd < 0) break;
        const sizeLine = new TextDecoder().decode(responseBodyBytes.subarray(cursor, lineEnd));
        const chunkSize = Number.parseInt(sizeLine.split(';')[0], 16);
        if (!Number.isFinite(chunkSize) || chunkSize === 0) break;
        const start = lineEnd + 2;
        decodedChunks.push(responseBodyBytes.slice(start, start + chunkSize));
        cursor = start + chunkSize + 2;
      }
      const decodedLength = decodedChunks.reduce((total, chunk) => total + chunk.byteLength, 0);
      const decoded = new Uint8Array(decodedLength);
      let decodedOffset = 0;
      for (const chunk of decodedChunks) {
        decoded.set(chunk, decodedOffset);
        decodedOffset += chunk.byteLength;
      }
      responseBodyBytes = decoded;
    } else {
      const declaredLength = Number(headers.match(/content-length:\s*(\d+)/i)?.[1]);
      if (Number.isFinite(declaredLength)) responseBodyBytes = responseBodyBytes.subarray(0, declaredLength);
    }

    const payload = JSON.parse(new TextDecoder().decode(responseBodyBytes)) as T & SggApiErrorPayload;
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
