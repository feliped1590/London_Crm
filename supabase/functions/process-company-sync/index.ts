/**
 * Edge Function: process-company-sync
 * Processa a fila company_sync_queue enviando clientes ao ERP Projedata (IMP_CLIENTE_V3).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapCompanyToErp, buildCompanyPayload } from '../_shared/projedata/company-mapper.ts';
import { validateCompanyForSync } from '../_shared/projedata/company-validator.ts';
import type { CompanySyncContext } from '../_shared/projedata/company-types.ts';
import type { CRMCompanyForSync } from '../_shared/projedata/company-mapper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const apiUrl = Deno.env.get('PROJEDATA_API_URL');
  const apiToken = Deno.env.get('PROJEDATA_API_TOKEN');

  if (!apiUrl || !apiToken) {
    return errorResponse(500, 'PROJEDATA_API_URL e PROJEDATA_API_TOKEN não configurados');
  }

  try {
    // Parse request body for optional company_id (manual sync)
    let targetCompanyId: string | null = null;
    try {
      const body = await req.json();
      targetCompanyId = body?.company_id || null;
    } catch { /* no body = batch mode */ }

    // If specific company_id provided, ensure it's in the queue
    if (targetCompanyId) {
      const { data: existing } = await supabase
        .from('company_sync_queue')
        .select('id, status')
        .eq('company_id', targetCompanyId)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (!existing) {
        const { data: companyInfo } = await supabase
          .from('companies')
          .select('id, tenant_id')
          .eq('id', targetCompanyId)
          .single();

        if (!companyInfo) {
          return errorResponse(404, 'Empresa não encontrada');
        }

        // Check for any existing entry to reset
        const { data: existingEntry } = await supabase
          .from('company_sync_queue')
          .select('id')
          .eq('company_id', targetCompanyId)
          .maybeSingle();

        if (existingEntry) {
          await supabase
            .from('company_sync_queue')
            .update({
              status: 'pending',
              attempts: 0,
              error_message: null,
              next_retry_at: null,
              processed_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingEntry.id);
        } else {
          await supabase
            .from('company_sync_queue')
            .insert({
              company_id: targetCompanyId,
              tenant_id: companyInfo.tenant_id,
              status: 'pending',
            });
        }
      }
    }

    // 1. Buscar itens pendentes da fila
    let queueQuery = supabase
      .from('company_sync_queue')
      .select('id, company_id, attempts, tenant_id')
      .eq('status', 'pending')
      .lt('attempts', 5)
      .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
      .order('created_at', { ascending: true });

    if (targetCompanyId) {
      queueQuery = queueQuery.eq('company_id', targetCompanyId);
    } else {
      queueQuery = queueQuery.limit(10);
    }

    const { data: queue, error: queueError } = await queueQuery;

    if (queueError) {
      console.error('[process-company-sync] Erro ao ler fila:', queueError.message);
      return errorResponse(500, queueError.message);
    }

    if (!queue || queue.length === 0) {
      return jsonResponse({ success: true, processed: 0, message: 'Nenhum cliente pendente na fila' });
    }

    console.log(`[process-company-sync] Processando ${queue.length} cliente(s)`);

    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ company_id: string; status: string; error?: string; erp_code?: string }> = [];

    for (const queueItem of queue) {
      try {
        // 2. Marcar como processing
        await supabase
          .from('company_sync_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', queueItem.id);

        // 3. Carregar empresa completa
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select(`
            id, name, fantasia, cnpj, tipo_pessoa, email, phone, 
            address, address_number, address_complement, neighborhood, city, state, zip_code,
            inscricao_estadual, sales_rep_id, created_by, legal_entity_id,
            legal_entities(id, erp_company_code)
          `)
          .eq('id', queueItem.company_id)
          .single();

        if (companyError || !company) {
          throw new Error(`Empresa não encontrada: ${queueItem.company_id}`);
        }

        // 4. Buscar cidade_codigo
        const { data: cityMapping } = await supabase
          .from('erp_cities')
          .select('codigo_erp')
          .eq('nome', company.city || '')
          .eq('uf', company.state || '')
          .maybeSingle();

        const cidadeCodigo = cityMapping?.codigo_erp || 0;

        // 5. Resolver vendedor ERP
        let vendedorCodigo = 0;
        if (company.sales_rep_id) {
          const { data: salesRep } = await supabase
            .from('sales_reps')
            .select('erp_vendor_code')
            .eq('id', company.sales_rep_id)
            .maybeSingle();
          vendedorCodigo = Number(salesRep?.erp_vendor_code) || 0;
        }

        // 6. Resolver usuário ERP
        let usuarioErp = 0;
        if (company.created_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('erp_user_code')
            .eq('user_id', company.created_by)
            .maybeSingle();
          usuarioErp = Number(profile?.erp_user_code) || 0;
        }

        // 7. Resolver empresa emissora
        const legalEntity = company.legal_entities as any;
        const empresaCodigo = Number(legalEntity?.erp_company_code) || 1;

        // 8. Validar
        const validation = validateCompanyForSync({
          cnpj: company.cnpj,
          name: company.name,
          tipo_pessoa: company.tipo_pessoa,
          cidade_codigo: cidadeCodigo,
          address: company.address,
          zip_code: company.zip_code,
        });

        if (!validation.valid) {
          const details = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          throw new Error(`Validação falhou: ${details}`);
        }

        // 9. Gerar payload
        const context: CompanySyncContext = {
          cidade_codigo: cidadeCodigo,
          empresa_codigo: empresaCodigo,
          vendedor_codigo: vendedorCodigo,
          usuario_erp: usuarioErp || 1,
        };

        const crmCompany: CRMCompanyForSync = {
          cnpj: company.cnpj!,
          tipo_pessoa: company.tipo_pessoa,
          name: company.name,
          fantasia: company.fantasia,
          phone: company.phone,
          email: company.email,
          inscricao_estadual: company.inscricao_estadual,
          address: company.address,
          address_complement: company.address_complement,
          address_number: company.address_number,
          neighborhood: company.neighborhood,
          zip_code: company.zip_code,
        };

        const mapped = mapCompanyToErp(crmCompany, context);
        const payload = buildCompanyPayload(mapped);

        console.log(`[process-company-sync] Enviando cliente ${company.name} (CNPJ: ${company.cnpj})`);

        // 10. Enviar ao ERP
        const response = await fetch(apiUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`,
          },
          body: payload,
        });

        const responseText = await response.text();
        console.log(`[process-company-sync] Resposta ERP (${response.status}): ${responseText}`);

        if (!response.ok) {
          throw new Error(`ERP retornou ${response.status}: ${responseText}`);
        }

        // 11. Parse retorno
        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        const retornoObj = Array.isArray(responseData) ? responseData[0] : responseData;
        const retorno = retornoObj?.['#out#p_retorno'] || retornoObj?.p_retorno || '';

        if (typeof retorno === 'string' && retorno.includes('#ERRO#')) {
          throw new Error(`ERP retornou erro: ${retorno}`);
        }

        // Extrair cd_correntista do retorno
        let erpCode: string | null = null;
        if (typeof retorno === 'string') {
          // Tentativa de extrair código do retorno (ex: "CORRENTISTA#12345")
          const parts = retorno.split('#');
          if (parts.length >= 2 && parts[1]) {
            erpCode = parts[1];
          }
        }

        if (!erpCode) {
          // Tentar extrair de outros campos
          erpCode = retornoObj?.cd_correntista?.toString() || retornoObj?.codigo?.toString() || null;
        }

        if (!erpCode) {
          throw new Error(`ERP não retornou código do cliente. Resposta: ${JSON.stringify(retornoObj)}`);
        }

        // 12. Sucesso - atualizar
        await supabase
          .from('company_sync_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            payload: JSON.parse(payload),
            response: responseData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id);

        await supabase
          .from('companies')
          .update({
            erp_code: erpCode,
            erp_synced_at: new Date().toISOString(),
          })
          .eq('id', queueItem.company_id);

        // Log
        await supabase.from('erp_sync_logs').insert({
          entity_type: 'company',
          entity_id: queueItem.company_id,
          direction: 'crm_to_erp',
          status: 'success',
          payload_sent: JSON.parse(payload),
          response_received: responseData,
          tenant_id: queueItem.tenant_id,
        });

        successCount++;
        results.push({ company_id: queueItem.company_id, status: 'completed', erp_code: erpCode });

      } catch (err: any) {
        console.error(`[process-company-sync] Erro:`, err.message);

        const newAttempts = (queueItem.attempts || 0) + 1;
        const isFinal = newAttempts >= 5;
        const retryDelay = Math.min(60 * Math.pow(2, newAttempts), 3600);
        const nextRetry = new Date(Date.now() + retryDelay * 1000).toISOString();

        await supabase
          .from('company_sync_queue')
          .update({
            status: isFinal ? 'failed' : 'pending',
            attempts: newAttempts,
            error_message: err.message,
            next_retry_at: isFinal ? null : nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id);

        await supabase.from('erp_sync_logs').insert({
          entity_type: 'company',
          entity_id: queueItem.company_id,
          direction: 'crm_to_erp',
          status: 'error',
          error_message: err.message,
          tenant_id: queueItem.tenant_id,
        });

        errorCount++;
        results.push({ company_id: queueItem.company_id, status: isFinal ? 'failed' : 'retry', error: err.message });
      }
    }

    return jsonResponse({
      success: true,
      processed: queue.length,
      success_count: successCount,
      error_count: errorCount,
      results,
    });

  } catch (err: any) {
    console.error('[process-company-sync] Erro geral:', err.message);
    return errorResponse(500, err.message);
  }
});
