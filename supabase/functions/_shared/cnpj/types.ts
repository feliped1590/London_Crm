/**
 * Tipos compartilhados da camada de consulta de CNPJ.
 *
 * NormalizedCnpjResult é o contrato ÚNICO devolvido por qualquer provider.
 * Mantém o shape histórico esperado pelo frontend (CustomerNew.tsx),
 * acrescido apenas de campos opcionais que o frontend pode ignorar com
 * segurança (`inscricao_estadual`, `is_matriz`, `regime_tributario`).
 */

export interface NormalizedCnpjEndereco {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface NormalizedCnpjResult {
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_inicio_atividade: string;
  cnae_principal: string;
  endereco: NormalizedCnpjEndereco;
  telefone: string;
  porte: string;
  capital_social: number;
  /** Opcional — preenchido pelo CnpjWsProvider via regra de seleção única. */
  inscricao_estadual?: string;
  /** Opcional — derivado de `estabelecimento.tipo === 'Matriz'` no CNPJ.ws. */
  is_matriz?: boolean;
  /** Opcional — preenchido APENAS quando Simples/MEI é confirmado. */
  regime_tributario?: 'simples_nacional';
  /** E-mail do estabelecimento (quando o provider devolver). */
  email?: string;
  /** Setor sugerido a partir do CNAE (nome, p/ resolver ID no frontend). */
  setor_sugerido?: string;
  /** Segmento sugerido a partir do CNAE (nome). */
  segmento_sugerido?: string;
}

export type ProviderName = 'brasilapi' | 'cnpjws';
export type ResultSource = ProviderName | 'cache';

export type ProviderErrorCode =
  | 'not_found'
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'invalid';

export type RawProviderResult =
  | { ok: true; data: NormalizedCnpjResult }
  | { ok: false; code: ProviderErrorCode; message: string };

export interface ICnpjProvider {
  readonly name: ProviderName;
  lookup(cnpjDigits: string): Promise<RawProviderResult>;
}

export interface LookupOptions {
  /** Provider primário desejado. Default: 'brasilapi'. */
  provider?: ProviderName;
  /** Se true e o provider primário falhar, tenta o outro. Default: true. */
  allowFallback?: boolean;
  /** Ignora cache e força nova consulta. Default: false. */
  forceRefresh?: boolean;
}

export interface LookupResponse {
  ok: true;
  data: NormalizedCnpjResult;
  source: ResultSource;
  /** Provider primário tentado. */
  primaryProvider: ProviderName;
  /** True se o resultado veio do fallback. */
  fallbackUsed: boolean;
  /** Tempo total em ms (inclui cache lookup, provider e cache write). */
  elapsedMs: number;
}

export interface LookupErrorResponse {
  ok: false;
  code: ProviderErrorCode;
  message: string;
  primaryProvider: ProviderName;
  fallbackUsed: boolean;
  elapsedMs: number;
}
