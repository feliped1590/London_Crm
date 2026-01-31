import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendToIniflex } from '../_shared/iniflex/adapter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Validates CNPJ checksum (Brazilian company registration number)
 * Returns true if CNPJ is valid, false otherwise
 */
function isValidCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cnpj[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return digit2 === parseInt(cnpj[13]);
}

interface InflexCustomer {
  codigo?: number | string;
  cnpj_cpf?: number | string;
  nome?: string;
  fantasia?: string;
  situacao?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

interface NormalizedCustomer {
  external_id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao: 'ativo' | 'inativo';
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
}

function normalizeCustomer(raw: InflexCustomer, cnpj: string): NormalizedCustomer {
  return {
    external_id: String(raw.codigo || raw.cnpj_cpf || ''),
    cnpj,
    razao_social: raw.nome || '',
    nome_fantasia: raw.fantasia || raw.nome || '',
    situacao: raw.situacao?.toLowerCase()?.includes('ativ') ? 'ativo' : 'inativo',
    endereco: {
      logradouro: raw.endereco || '',
      numero: raw.numero || '',
      bairro: raw.bairro || '',
      cidade: raw.cidade || '',
      uf: raw.uf || '',
      cep: raw.cep || '',
    },
  };
}

function extractCustomers(data: unknown): InflexCustomer[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj)) return obj;
  if (Array.isArray(obj.clientes)) return obj.clientes;
  if (Array.isArray(obj.correntistas)) return obj.correntistas;
  if (Array.isArray(obj.data)) return obj.data;
  if (obj.codigo || obj.cnpj_cpf) return [obj as InflexCustomer];
  return [];
}

// deno-lint-ignore no-explicit-any
async function updateLog(
  supabase: any,
  logId: string | undefined,
  status: string,
  externalId: string | null,
  errorMsg: string | null,
  response: unknown
): Promise<void> {
  if (!logId) return;
  await supabase
    .from('erp_sync_logs')
    .update({
      status,
      external_id: externalId,
      error_message: errorMsg,
      response_payload: response,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json();
    const cnpjClean = body.cnpj?.replace(/\D/g, '') || '';

    // ===== VALIDATIONS (no logs if invalid) =====
    if (!cnpjClean) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cnpjClean.length !== 14) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ deve ter 14 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidCNPJ(cnpjClean)) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== CHECK CREDENTIALS (quick fail) =====
    const INIFLEX_URL = Deno.env.get('INIFLEX_API_URL');
    const INIFLEX_TOKEN = Deno.env.get('INIFLEX_API_TOKEN');

    if (!INIFLEX_URL || !INIFLEX_TOKEN) {
      console.error('[iniflex-customer-lookup] Credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Serviço de integração não configurado' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[iniflex-customer-lookup] Searching customer: ${cnpjClean}`);

    // ===== CREATE INITIAL LOG =====
    const { data: log } = await supabase
      .from('erp_sync_logs')
      .insert({
        entity_type: 'customer_lookup',
        entity_id: cnpjClean,
        direction: 'crm_to_erp',
        status: 'processing',
        request_payload: { cnpj: cnpjClean },
      })
      .select('id')
      .single();

    const logId = log?.id;

    // ===== INIFLEX PAYLOAD (chave será injetada pelo adapter) =====
    const payload = {
      tipoComando: 'ASDCOMANDO',
      grupoComando: 'EXP_CLIENTE',
      '#out#p_retorno': 'T',
      json: {
        cnpj_cpf: parseInt(cnpjClean),
      },
    };

    // ===== USAR ADAPTER CENTRALIZADO =====
    const result = await sendToIniflex(payload);

    if (!result.success) {
      await updateLog(supabase, logId, 'failed', null, result.error || 'Erro desconhecido', result.rawResponse);
      
      // Determinar status HTTP apropriado
      const isTimeout = result.error?.includes('Timeout');
      const status = isTimeout ? 504 : 503;
      const userMessage = isTimeout 
        ? 'Consulta demorou muito. Tente novamente' 
        : 'Serviço de consulta temporariamente indisponível';
      
      return new Response(
        JSON.stringify({ success: false, error: userMessage }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PROCESS RESPONSE =====
    const customers = extractCustomers(result.rawResponse);
    const found = customers.find((c) =>
      String(c.cnpj_cpf).replace(/\D/g, '') === cnpjClean
    );

    if (found) {
      const normalized = normalizeCustomer(found, cnpjClean);
      await updateLog(supabase, logId, 'success', normalized.external_id, null, result.rawResponse);

      return new Response(
        JSON.stringify({
          success: true,
          found: true,
          data: normalized,
          source: 'iniflex',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Not found is a valid state, not an error
      await updateLog(supabase, logId, 'success', null, 'not_found', result.rawResponse);

      return new Response(
        JSON.stringify({
          success: true,
          found: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[iniflex-customer-lookup] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao consultar cliente no ERP' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
