/**
 * Edge Function: process-company-sync
 * Processa a fila company_sync_queue enviando clientes ao ERP Projedata (IMP_CLIENTE_V4).
 * Inclui consulta EXP_CLIENTES_V2 para anti-duplicidade e recuperação de erp_code.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapCompanyToErp, buildCompanyPayload, searchClienteByCnpj, getSegmentoBySetor } from '../_shared/projedata/company-mapper.ts';
import { validateCompanyForSync } from '../_shared/projedata/company-validator.ts';
import type { CompanySyncContext } from '../_shared/projedata/company-types.ts';
import type { CRMCompanyForSync } from '../_shared/projedata/company-mapper.ts';
import { parseClienteRetorno } from '../_shared/erp/projedata-parser.ts';
import { checkAccessWindowForTenant, AccessWindowError, AccessCheckUnavailableError } from '../_shared/accessControl.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_ERP_COMPANY_CODE = 1;

async function fetchWithRetry(url: string, init: RequestInit, correlationId: string, retries = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err: any) {
      lastError = err;
      console.warn('[process-company-sync] ERP request failed', { correlationId, attempt, error: err.message });
      if (attempt > retries) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

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

function isPermanentCompanySyncError(message: string): boolean {
  const normalized = message.toUpperCase();
  return (
    normalized.includes('CNPJ_CPF_ALFANUMERICO') ||
    (normalized.includes('ORA-06550') && normalized.includes('PLS-00302')) ||
    (normalized.includes('ORA-06550') && normalized.includes('PLS-00320'))
  );
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

    // If specific company_id provided, force it back into the queue for immediate processing
    if (targetCompanyId) {
      const { data: companyInfo } = await supabase
        .from('companies')
        .select('id, tenant_id')
        .eq('id', targetCompanyId)
        .single();

      if (!companyInfo) {
        return errorResponse(404, 'Empresa não encontrada');
      }

      const { data: existingEntry } = await supabase
        .from('company_sync_queue')
        .select('id, status')
        .eq('company_id', targetCompanyId)
        .maybeSingle();

      if (existingEntry?.status === 'processing') {
        return jsonResponse({ success: true, processed: 0, message: 'Cliente já está sendo processado na fila' });
      }

      if (existingEntry) {
        await supabase
          .from('company_sync_queue')
          .update({
            status: 'pending',
            attempts: 0,
            error_message: null,
            next_retry_at: null,
            processed_at: null,
            payload: null,
            response: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingEntry.id);
      } else {
        await supabase
          .from('company_sync_queue')
          .upsert({
            company_id: targetCompanyId,
            tenant_id: companyInfo.tenant_id,
            status: 'pending',
          }, { onConflict: 'company_id' });
      }

      // Clear stale sync_error status on manual retry
      await supabase
        .from('companies')
        .update({ integration_status: 'not_synced' })
        .eq('id', targetCompanyId)
        .eq('integration_status', 'sync_error');
    }

    // 1. Buscar itens pendentes da fila (excluindo bloqueados por validação e pausados)
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
      queueQuery = queueQuery.limit(30);
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

    // Normalização centralizada de CNPJ
    const normalizeCnpj = (v: string) => v.replace(/\D/g, '');

    // Cache em memória — só cacheia resultados positivos (não bloqueia retries)
    const erpLookupCache = new Map<string, string>();
    async function searchWithCache(cnpj: string): Promise<string | null> {
      const norm = normalizeCnpj(cnpj);
      if (erpLookupCache.has(norm)) return erpLookupCache.get(norm)!;
      const start = Date.now();
      const result = await searchClienteByCnpj(cnpj, apiUrl!, apiToken!, supabase);
      console.log(`[ERP lookup] ${Date.now() - start}ms | CNPJ ${norm} | ${result ? 'encontrado' : 'não encontrado'}`);
      if (result) erpLookupCache.set(norm, result);
      return result;
    }
    function invalidateCache(cnpj: string | null | undefined) {
      if (cnpj) erpLookupCache.delete(normalizeCnpj(cnpj));
    }

    for (const queueItem of queue) {
      let payloadForLog: Record<string, unknown> | null = null;
      try {
        // ⏰ Janela de acesso por tenant (strict)
        try {
          await checkAccessWindowForTenant(supabase, queueItem.tenant_id, {
            mode: 'strict',
            context: 'process-company-sync',
          });
        } catch (winErr) {
          if (winErr instanceof AccessWindowError || winErr instanceof AccessCheckUnavailableError) {
            console.warn(`[process-company-sync] Item ${queueItem.id} adiado: ${winErr.message}`);
            await supabase
              .from('company_sync_queue')
              .update({
                status: 'pending',
                next_retry_at: new Date(Date.now() + 10 * 60_000).toISOString(),
                error_message: winErr.message,
                updated_at: new Date().toISOString(),
              })
              .eq('id', queueItem.id);
            errorCount++;
            results.push({ company_id: queueItem.company_id, status: 'deferred', error: winErr.message });
            continue;
          }
          throw winErr;
        }

        // 2. Marcar como processing (lock de concorrência)
        const { data: locked } = await supabase
          .from('company_sync_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', queueItem.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();

        if (!locked) {
          console.log(`[process-company-sync] Item ${queueItem.id} já em processamento, pulando`);
          continue;
        }

        // 3. Carregar empresa completa
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select(`
            id, tenant_id, name, fantasia, cnpj, tipo_pessoa, email, phone, 
            address, address_number, address_complement, neighborhood, city, state, zip_code,
            inscricao_estadual, sales_rep_id, created_by, legal_entity_id, setor_id, segmento_id,
            legal_entities(id, erp_company_code),
            setores(id, nome),
            segmentos(id, nome, erp_code)
          `)
          .eq('id', queueItem.company_id)
          .single();

        if (companyError || !company) {
          throw new Error(`Empresa não encontrada: ${queueItem.company_id}`);
        }

        // ═══ FASE A: Consulta pré-envio (EXP_CLIENTES_V2) ═══
        if (company.cnpj) {
          console.log(`[process-company-sync] Fase A: Buscando ${company.name} no ERP por CNPJ`);
          const existingErpCode = await searchWithCache(company.cnpj);

          if (existingErpCode) {
            console.log(`[process-company-sync] Cliente já existe no ERP: ${existingErpCode}`);

            await supabase
              .from('companies')
              .update({ erp_code: existingErpCode, erp_synced_at: new Date().toISOString() })
              .eq('id', queueItem.company_id);

            await supabase
              .from('company_sync_queue')
              .update({
                status: 'completed',
                processed_at: new Date().toISOString(),
                response: { found_existing: true, erp_code: existingErpCode },
                updated_at: new Date().toISOString(),
              })
              .eq('id', queueItem.id);

            await supabase.from('erp_sync_logs').insert({
              entity_type: 'company',
              entity_id: queueItem.company_id,
              direction: 'crm_to_erp',
              status: 'found_existing',
              external_id: existingErpCode,
              response_payload: { erp_code: existingErpCode },
            });

            successCount++;
            results.push({ company_id: queueItem.company_id, status: 'found_existing', erp_code: existingErpCode });
            continue;
          }
        }

        // ═══ FASE B: Validação + Envio IMP_CLIENTE_V4 ═══

        // 4. Buscar cidade_codigo
        const { data: cityMapping } = await supabase
          .from('erp_cities')
          .select('codigo_erp')
          .eq('nome', company.city || '')
          .eq('uf', company.state || '')
          .maybeSingle();

        const cidadeCodigo = cityMapping?.codigo_erp ?? 0;

        // 5. Resolver vendedor ERP (informativo — validador decide se bloqueia)
        let vendedorCodigo = 0;
        let salesRepName: string | null = null;
        const hasSalesRep = !!company.sales_rep_id;
        if (company.sales_rep_id) {
          const { data: salesRep } = await supabase
            .from('sales_reps')
            .select('erp_vendor_code, name')
            .eq('id', company.sales_rep_id)
            .maybeSingle();
          salesRepName = salesRep?.name ?? null;
          vendedorCodigo = Number(salesRep?.erp_vendor_code) || 0;
        }

        // 6. Resolver usuário ERP via vendedor vinculado (sales_rep → user_sales_reps → profiles)
        let usuarioErp = 0;
        let usuarioErpName = '';
        let hasErpUser = false;
        if (company.sales_rep_id) {
          const { data: repLink } = await supabase
            .from('user_sales_reps')
            .select('user_id')
            .eq('sales_rep_id', company.sales_rep_id)
            .order('is_default', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (repLink?.user_id) {
            hasErpUser = true;
            const { data: profile } = await supabase
              .from('profiles')
              .select('erp_user_code, full_name')
              .eq('user_id', repLink.user_id)
              .maybeSingle();

            if (profile) {
              usuarioErpName = profile.full_name || '';
              usuarioErp = Number(profile.erp_user_code) || 0;
            }
          }
        }
        // Fallback: created_by se não houver vendedor vinculado
        if (!hasErpUser && company.created_by) {
          hasErpUser = true;
          const { data: profile } = await supabase
            .from('profiles')
            .select('erp_user_code, full_name')
            .eq('user_id', company.created_by)
            .maybeSingle();

          if (profile) {
            usuarioErpName = profile.full_name || '';
            usuarioErp = Number(profile.erp_user_code) || 0;
          }
        }

        // 7. Resolver empresa emissora
        // Regra atual do projeto: payload de cliente sempre usa empresa 1,
        // independentemente do código ERP cadastrado na entidade jurídica.
        const empresaCodigo = DEFAULT_ERP_COMPANY_CODE;

        // 8. Preparar dados e validação estruturada (defesa em profundidade)
        // Resolver destino_mercadoria pelo setor: Indústria = I, demais = C (padrão)
        const setorNome = ((company as any).setores as any)?.nome?.toUpperCase?.() || '';
        const destinoMercadoria = setorNome.includes('INDUSTRIA') || setorNome.includes('INDÚSTRIA') ? 'I' : 'C';

        // Resolver banco_padrao_erp da tabela financeira; fallback padrão ERP = 999
        let bancoPadraoErp = 999;
        const { data: erpFinancial } = await supabase
          .from('company_erp_financial')
          .select('banco_padrao_erp')
          .eq('company_id', queueItem.company_id)
          .maybeSingle();
        if (erpFinancial?.banco_padrao_erp != null) {
          bancoPadraoErp = erpFinancial.banco_padrao_erp;
        }

        // Resolver segmento_mercado pelo setor
        const segmentoMercado = getSegmentoBySetor(((company as any).setores as any)?.nome);

        // Resolver subsegmento_mercado pelo segmento do CRM (segmentos.erp_code)
        const segmentoData = (company as any).segmentos as any;
        const subsegmentoMercado = Number(segmentoData?.erp_code) || 0;

        const context: CompanySyncContext = {
          cidade_codigo: cidadeCodigo,
          empresa_codigo: empresaCodigo,
          vendedor_codigo: vendedorCodigo,
          usuario_erp: usuarioErp,
          destino_mercadoria: destinoMercadoria,
          banco_padrao: bancoPadraoErp,
          segmento: segmentoMercado,
          subsegmento: subsegmentoMercado,
        };

        // Inferir tipo_pessoa: CNPJ com 14 dígitos = PJ, 11 dígitos = PF, default = PJ
        const cnpjDigits = (company.cnpj || '').replace(/\D/g, '');
        const tipoPessoa = company.tipo_pessoa || (cnpjDigits.length === 11 ? 'PF' : 'PJ');

        const crmCompany: CRMCompanyForSync = {
          cnpj: company.cnpj!,
          tipo_pessoa: tipoPessoa,
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
          state: company.state,
        };

        const mapped = mapCompanyToErp(crmCompany, context);
        const validation = validateCompanyForSync({
          cnpj: company.cnpj,
          name: company.name,
          tipo_pessoa: tipoPessoa,
          cidade_codigo: cidadeCodigo,
          city: company.city,
          state: company.state,
          address: company.address,
          zip_code: company.zip_code,
          banco_padrao: mapped.banco_padrao,
          segmento_mercado: mapped.segmento_mercado,
          subsegmento_mercado: mapped.subsegmento_mercado,
          has_sales_rep: hasSalesRep,
          sales_rep_name: salesRepName,
          sales_rep_erp_code: vendedorCodigo || null,
          has_erp_user: hasErpUser,
          erp_user_name: usuarioErpName || null,
          erp_user_code: usuarioErp || null,
        });

        if (!validation.valid) {
          await supabase.from('company_sync_queue').update({
            status: 'blocked_validation',
            error_message: validation.errors.map((e) => e.message).join('; '),
            validation_errors: validation.errors,
            validation_fields: validation.fields,
            updated_at: new Date().toISOString(),
          }).eq('id', queueItem.id);
          await supabase.from('companies').update({ integration_status: 'missing_data' }).eq('id', queueItem.company_id);
          await supabase.from('erp_sync_logs').insert({
            entity_type: 'company', entity_id: queueItem.company_id, direction: 'crm_to_erp', status: 'blocked_validation',
            error_message: validation.errors.map((e) => `${e.field}: ${e.message}`).join('; '),
          });
          errorCount++;
          results.push({ company_id: queueItem.company_id, status: 'blocked_validation', error: 'Dados incompletos' });
          continue;
        }
        const payload = buildCompanyPayload(mapped);
        payloadForLog = JSON.parse(payload);

        // Recheck anti-duplicidade antes do envio (cenário de concorrência)
        if (company.cnpj) {
          await new Promise(r => setTimeout(r, 500));
          invalidateCache(company.cnpj);
          const recheck = await searchWithCache(company.cnpj);
          if (recheck) {
            console.log(`[process-company-sync] Recheck: cliente apareceu no ERP (${recheck}), evitando duplicata`);
            await supabase.from('companies').update({ erp_code: recheck, erp_synced_at: new Date().toISOString() }).eq('id', queueItem.company_id);
            await supabase.from('company_sync_queue').update({ status: 'completed', processed_at: new Date().toISOString(), response: { found_existing: true, erp_code: recheck, via: 'recheck' }, updated_at: new Date().toISOString() }).eq('id', queueItem.id);
            await supabase.from('erp_sync_logs').insert({ entity_type: 'company', entity_id: queueItem.company_id, direction: 'crm_to_erp', status: 'found_existing', external_id: recheck, response_payload: { erp_code: recheck, via: 'recheck' } });
            successCount++;
            results.push({ company_id: queueItem.company_id, status: 'found_existing', erp_code: recheck });
            continue;
          }
        }

        const correlationId = crypto.randomUUID();
        console.log('[process-company-sync] Fase B: enviando cliente ao ERP', {
          correlationId,
          companyId: queueItem.company_id,
          tenantId: company.tenant_id,
        });

        // 10. Enviar ao ERP com timeout + retry
        const response = await fetchWithRetry(apiUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`,
            'X-Correlation-Id': correlationId,
          },
          body: payload,
        }, correlationId);

        const responseText = await response.text();
        console.log(`[process-company-sync] Resposta ERP (${response.status}): ${responseText}`);

        if (!response.ok) {
          throw new Error(`ERP retornou ${response.status}: ${responseText}`);
        }

        // 11. Parse retorno V4: array externo + JSON interno em p_retorno
        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }
        const clienteRetorno = parseClienteRetorno(responseData, { cnpj: company.cnpj });
        let erpCode: string | null = String(clienteRetorno.correntista);

        if (erpCode) {
          // Sucesso completo
          const syncStatus = 'completed';

          await supabase
            .from('company_sync_queue')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString(),
              payload: JSON.parse(payload),
              response: { responseData, parsed: clienteRetorno, correlationId },
              updated_at: new Date().toISOString(),
            })
            .eq('id', queueItem.id);

          await supabase
            .from('companies')
            .update({ erp_code: erpCode, erp_synced_at: new Date().toISOString() })
            .eq('id', queueItem.company_id);

           await supabase.from('erp_sync_logs').insert({
              entity_type: 'company',
              entity_id: queueItem.company_id,
              direction: 'crm_to_erp',
              status: syncStatus,
              external_id: erpCode,
              request_payload: JSON.parse(payload),
              response_payload: { rawResponse: responseData, parsed: clienteRetorno, correlationId },
            });

          successCount++;
          results.push({ company_id: queueItem.company_id, status: syncStatus, erp_code: erpCode });
        } else {
          // Enviou com sucesso mas ainda não encontrou código — marcar para retry pelo front
          console.log('[process-company-sync] Enviado com sucesso mas erp_code não disponível ainda');

          await supabase
            .from('company_sync_queue')
            .update({
              status: 'waiting_propagation',
              error_message: 'Cliente enviado ao ERP com sucesso. Aguardando propagação do código.',
              payload: JSON.parse(payload),
              response: { responseData, correlationId },
              next_retry_at: new Date(Date.now() + 60_000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', queueItem.id);

           await supabase.from('erp_sync_logs').insert({
              entity_type: 'company',
              entity_id: queueItem.company_id,
              direction: 'crm_to_erp',
              status: 'waiting_propagation',
              request_payload: JSON.parse(payload),
              response_payload: { rawResponse: responseData, correlationId, technical_error: 'correntista ausente após parser' },
            });

          results.push({ company_id: queueItem.company_id, status: 'waiting_propagation' });
        }

      } catch (err: any) {
        console.error(`[process-company-sync] Erro:`, err.message);

        const newAttempts = (queueItem.attempts || 0) + 1;
        const isPermanent = isPermanentCompanySyncError(err.message || '');
        const isFinal = isPermanent || newAttempts >= 5;
        const retryDelay = Math.min(60 * Math.pow(2, newAttempts), 3600);
        const nextRetry = new Date(Date.now() + retryDelay * 1000).toISOString();

        const queueUpdate: Record<string, unknown> = {
          status: isFinal ? 'failed' : 'pending',
          attempts: newAttempts,
          error_message: err.message,
          next_retry_at: isFinal ? null : nextRetry,
          response: { error: err.message, permanent: isPermanent, retryable: !isPermanent },
          updated_at: new Date().toISOString(),
        };
        if (payloadForLog) queueUpdate.payload = payloadForLog;

        await supabase
          .from('company_sync_queue')
          .update(queueUpdate)
          .eq('id', queueItem.id);

        // Marcar integration_status como sync_error (trigger não cobre erros de sync)
        await supabase
          .from('companies')
          .update({ integration_status: 'sync_error' })
          .eq('id', queueItem.company_id);

        await supabase.from('erp_sync_logs').insert({
          entity_type: 'company',
          entity_id: queueItem.company_id,
          direction: 'crm_to_erp',
            status: 'error',
            error_message: err.message,
            response_payload: { error: err.message, technical: true, permanent: isPermanent },
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
