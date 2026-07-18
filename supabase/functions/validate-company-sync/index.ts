/**
 * Edge Function: validate-company-sync
 * Valida pré-envio (read-only) — verifica CNPJ, nome, endereço, cidade mapeada,
 * vendedor com código ERP e usuário com código ERP. Não chama ERP, não enfileira.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateCompanyForSync, type CompanyValidationResult } from '../_shared/projedata/company-validator.ts';
import { getSegmentoBySetor } from '../_shared/projedata/company-mapper.ts';
import { envFlagEnabled, disabledIntegrationResponse } from '../_shared/integration-gates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  if (!envFlagEnabled('ERP_INTEGRATION_ENABLED', false)) {
    return disabledIntegrationResponse('ERP', corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const companyId: string | undefined = body?.company_id;

    if (!companyId) {
      return jsonResponse({ error: 'company_id é obrigatório' }, 400);
    }

    // 1. Carregar empresa
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id, name, cnpj, tipo_pessoa, address, zip_code, city, state, tenant_id, sales_rep_id, created_by, setor_id, segmento_id, setores(nome), segmentos(erp_code)')
      .eq('id', companyId)
      .single();

    if (companyErr || !company) {
      return jsonResponse({ error: 'Cliente não encontrado' }, 404);
    }

    // 2. Cidade mapeada
    let cidadeCodigo = 0;
    if (company.city && company.state && (company as any).tenant_id) {
      const { data: codeData } = await supabase.rpc('lookup_erp_city', {
        p_tenant: (company as any).tenant_id,
        p_nome: company.city,
        p_uf: company.state,
      });
      cidadeCodigo = typeof codeData === 'number' ? codeData : (codeData ?? 0);
    }


    // 3. Vendedor com código ERP
    let salesRepName: string | null = null;
    let salesRepErpCode: number | null = null;
    const hasSalesRep = !!company.sales_rep_id;
    if (company.sales_rep_id) {
      const { data: rep } = await supabase
        .from('sales_reps')
        .select('name, erp_vendor_code')
        .eq('id', company.sales_rep_id)
        .maybeSingle();
      salesRepName = rep?.name ?? null;
      salesRepErpCode = rep?.erp_vendor_code ? Number(rep.erp_vendor_code) : null;
    }

    // 4. Usuário ERP via vendedor → user_sales_reps → profiles
    let erpUserName: string | null = null;
    let erpUserCode: number | null = null;
    let hasErpUser = false;
    if (company.sales_rep_id) {
      const { data: link } = await supabase
        .from('user_sales_reps')
        .select('user_id')
        .eq('sales_rep_id', company.sales_rep_id)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (link?.user_id) {
        hasErpUser = true;
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, erp_user_code')
          .eq('user_id', link.user_id)
          .maybeSingle();
        erpUserName = profile?.full_name ?? null;
        erpUserCode = profile?.erp_user_code ? Number(profile.erp_user_code) : null;
      }
    }
    // Fallback: created_by
    if (!hasErpUser && company.created_by) {
      hasErpUser = true;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, erp_user_code')
        .eq('user_id', company.created_by)
        .maybeSingle();
      erpUserName = profile?.full_name ?? null;
      erpUserCode = profile?.erp_user_code ? Number(profile.erp_user_code) : null;
    }

    // 5. Inferir tipo_pessoa
    const cnpjDigits = (company.cnpj || '').replace(/\D/g, '');
    const tipoPessoa = company.tipo_pessoa || (cnpjDigits.length === 11 ? 'PF' : 'PJ');

    const { data: erpFinancial } = await supabase
      .from('company_erp_financial')
      .select('banco_padrao_erp')
      .eq('company_id', companyId)
      .maybeSingle();
    const setorNome = ((company as any).setores as any)?.nome;
    const segmentoMercado = getSegmentoBySetor(setorNome);
    const subsegmentoMercado = Number(((company as any).segmentos as any)?.erp_code) || 0;

    // 6. Validar
    const result: CompanyValidationResult = validateCompanyForSync({
      cnpj: company.cnpj,
      name: company.name,
      tipo_pessoa: tipoPessoa,
      cidade_codigo: cidadeCodigo,
      city: company.city,
      state: company.state,
      address: company.address,
      zip_code: company.zip_code,
      banco_padrao: erpFinancial?.banco_padrao_erp ?? 999,
      segmento_mercado: segmentoMercado,
      subsegmento_mercado: subsegmentoMercado,
      has_sales_rep: hasSalesRep,
      sales_rep_name: salesRepName,
      sales_rep_erp_code: salesRepErpCode,
      has_erp_user: hasErpUser,
      erp_user_name: erpUserName,
      erp_user_code: erpUserCode,
    });

    return jsonResponse({
      valid: result.valid,
      errors: result.errors,
      fields: result.fields,
      company_id: companyId,
      company_name: company.name,
    });
  } catch (err: any) {
    console.error('[validate-company-sync] error:', err.message);
    return jsonResponse({ error: err.message }, 500);
  }
});
