/**
 * Edge Function: erp-sync
 * Fundação v1 - Ponto único de entrada para integração ERP Iniflex
 * 
 * Responsabilidades:
 * - Receber requisições de sincronização
 * - Validar dados antes de enviar ao ERP
 * - Registrar logs de todas as operações
 * - Orquestrar dependências (ex: empresa antes de contato)
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  SyncRequest, 
  SyncStatus, 
  SYNC_STATUS, 
  SYNC_DIRECTION, 
  ENTITY_TYPE,
  CRMCompany,
  CRMContact,
} from '../_shared/iniflex/types.ts';
import { sendToIniflex } from '../_shared/iniflex/adapter.ts';
import { mapCompanyToIniflex, mapContactToIniflex } from '../_shared/iniflex/mapper.ts';
import { validateCompany, validateContact } from '../_shared/iniflex/validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const body = await req.json() as SyncRequest;
    const { entity_type, entity_id, ensure_dependencies } = body;

    // Validar request
    if (!entity_type || !entity_id) {
      return errorResponse(400, 'entity_type e entity_id são obrigatórios');
    }

    if (!Object.values(ENTITY_TYPE).includes(entity_type)) {
      return errorResponse(400, `Tipo de entidade não suportado: ${entity_type}`);
    }

    console.log(`[erp-sync] Iniciando sync: ${entity_type} - ${entity_id}`);

    // Criar log inicial (status: pending)
    const { data: log, error: logError } = await supabase
      .from('erp_sync_logs')
      .insert({
        entity_type,
        entity_id,
        direction: SYNC_DIRECTION.CRM_TO_ERP,
        status: SYNC_STATUS.PENDING,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('[erp-sync] Erro ao criar log:', logError);
    }

    const logId = log?.id;

    // Processar conforme tipo de entidade
    if (entity_type === ENTITY_TYPE.COMPANY) {
      return await syncCompany(supabase, entity_id, logId);
    }

    if (entity_type === ENTITY_TYPE.CONTACT) {
      // Orquestração mínima: garantir que empresa existe no ERP
      if (ensure_dependencies) {
        const dependencyResult = await ensureCompanyDependency(supabase, entity_id, logId);
        if (!dependencyResult.success) {
          return errorResponse(400, dependencyResult.error!);
        }
      }
      return await syncContact(supabase, entity_id, logId);
    }

    return errorResponse(400, `Tipo não implementado: ${entity_type}`);

  } catch (error) {
    console.error('[erp-sync] Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return errorResponse(500, errorMessage);
  }
});

/**
 * Garante que a empresa do contato existe no ERP
 */
async function ensureCompanyDependency(
  supabase: SupabaseClient,
  contactId: string,
  logId?: string
): Promise<{ success: boolean; error?: string }> {
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('company_id, companies(iniflex_id)')
    .eq('id', contactId)
    .single();

  if (error || !contact) {
    return { success: true }; // Sem empresa, não precisa sincronizar
  }

  // companies pode ser objeto ou array dependendo da relação
  const companiesData = contact.companies;
  const companyIniflex = Array.isArray(companiesData)
    ? companiesData[0]?.iniflex_id
    : (companiesData as { iniflex_id: string | null } | null)?.iniflex_id;

  if (contact.company_id && !companyIniflex) {
    console.log(`[erp-sync] Sincronizando empresa dependente: ${contact.company_id}`);
    
    const companyResult = await syncCompanyInternal(supabase, contact.company_id);
    
    if (!companyResult.success) {
      // Registrar falha de dependência no log do contato
      await updateLog(
        supabase,
        logId,
        SYNC_STATUS.FAILED,
        null,
        `Falha ao sincronizar empresa dependente: ${companyResult.error}`
      );
      return { success: false, error: `Falha ao sincronizar empresa: ${companyResult.error}` };
    }
  }

  return { success: true };
}

/**
 * Sincroniza empresa com o ERP (função pública com Response)
 */
async function syncCompany(
  supabase: SupabaseClient,
  companyId: string,
  logId?: string
): Promise<Response> {
  const result = await syncCompanyInternal(supabase, companyId, logId);

  if (!result.success) {
    return errorResponse(400, result.error!);
  }

  return new Response(
    JSON.stringify({
      success: true,
      entity_type: ENTITY_TYPE.COMPANY,
      entity_id: companyId,
      external_id: result.externalId,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Sincroniza empresa com o ERP (função interna)
 */
async function syncCompanyInternal(
  supabase: SupabaseClient,
  companyId: string,
  logId?: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  // Buscar empresa
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error || !company) {
    // Falha PRÉ-ERP: entidade não encontrada
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, 'Empresa não encontrada');
    return { success: false, error: 'Empresa não encontrada' };
  }

  // Validar dados
  const validation = validateCompany(company as CRMCompany);
  if (!validation.valid) {
    // Falha PRÉ-ERP: validação
    const errorMsg = validation.errors.join(', ');
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, errorMsg);
    return { success: false, error: errorMsg };
  }

  // Mapear payload
  const payload = mapCompanyToIniflex(company as CRMCompany);

  // Atualizar para PROCESSING antes de chamar ERP
  await supabase
    .from('erp_sync_logs')
    .update({
      status: SYNC_STATUS.PROCESSING,
      request_payload: payload,
    })
    .eq('id', logId);

  // Chamar ERP
  const result = await sendToIniflex(payload);

  if (!result.success) {
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, result.error, result.rawResponse);
    return { success: false, error: result.error };
  }

  // Atualizar empresa com ID do ERP
  await supabase
    .from('companies')
    .update({
      iniflex_id: result.externalId,
      iniflex_synced_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  // Atualizar log com sucesso
  await updateLog(supabase, logId, SYNC_STATUS.SUCCESS, result.externalId, null, result.rawResponse);

  console.log(`[erp-sync] Empresa sincronizada: ${companyId} -> ${result.externalId}`);
  return { success: true, externalId: result.externalId || undefined };
}

/**
 * Sincroniza contato com o ERP
 */
async function syncContact(
  supabase: SupabaseClient,
  contactId: string,
  logId?: string
): Promise<Response> {
  // Buscar contato
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  if (error || !contact) {
    // Falha PRÉ-ERP: entidade não encontrada
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, 'Contato não encontrado');
    return errorResponse(404, 'Contato não encontrado');
  }

  // Validar dados
  const validation = validateContact(contact as CRMContact);
  if (!validation.valid) {
    // Falha PRÉ-ERP: validação
    const errorMsg = validation.errors.join(', ');
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, errorMsg);
    return errorResponse(400, errorMsg);
  }

  // Mapear payload
  const payload = mapContactToIniflex(contact as CRMContact);

  // Atualizar para PROCESSING antes de chamar ERP
  await supabase
    .from('erp_sync_logs')
    .update({
      status: SYNC_STATUS.PROCESSING,
      request_payload: payload,
    })
    .eq('id', logId);

  // Chamar ERP
  const result = await sendToIniflex(payload);

  if (!result.success) {
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, result.error, result.rawResponse);
    return errorResponse(500, result.error!);
  }

  // Atualizar contato com ID do ERP
  await supabase
    .from('contacts')
    .update({
      iniflex_id: result.externalId,
      iniflex_synced_at: new Date().toISOString(),
    })
    .eq('id', contactId);

  // Atualizar log com sucesso
  await updateLog(supabase, logId, SYNC_STATUS.SUCCESS, result.externalId, null, result.rawResponse);

  console.log(`[erp-sync] Contato sincronizado: ${contactId} -> ${result.externalId}`);

  return new Response(
    JSON.stringify({
      success: true,
      entity_type: ENTITY_TYPE.CONTACT,
      entity_id: contactId,
      external_id: result.externalId,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Atualiza log de sincronização
 */
async function updateLog(
  supabase: SupabaseClient,
  logId: string | undefined,
  status: SyncStatus,
  externalId: string | null,
  error?: string | null,
  response?: unknown
): Promise<void> {
  if (!logId) return;

  await supabase
    .from('erp_sync_logs')
    .update({
      status,
      external_id: externalId,
      error_message: error || null,
      response_payload: response || null,
    })
    .eq('id', logId);
}

/**
 * Cria resposta de erro padronizada
 */
function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
