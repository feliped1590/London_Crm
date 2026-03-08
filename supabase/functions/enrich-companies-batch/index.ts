import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BrasilAPIResponse {
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  ddd_telefone_1: string;
  email?: string;
  situacao_cadastral?: number;
}

async function fetchCNPJ(cnpj: string): Promise<BrasilAPIResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasPlaceholder(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes('*');
}

function needsEnrichment(company: any): boolean {
  // Check if any enrichable field is null/empty or contains asterisk placeholders
  const fieldsToCheck = ['fantasia', 'address', 'city', 'state', 'zip_code', 'phone', 'email', 'neighborhood', 'address_number'];
  for (const field of fieldsToCheck) {
    if (!company[field]) return true;
  }
  // Check for asterisk placeholders in text fields
  const textFields = ['name', 'fantasia', 'address', 'city', 'neighborhood'];
  for (const field of textFields) {
    if (hasPlaceholder(company[field])) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader! } }
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'desenvolvedor');
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Apenas administradores podem executar enriquecimento em lote' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 200);
    const offset = body.offset || 0;
    const mode = body.mode || 'enrich'; // 'enrich' or 'scan'
    const salesRepId = body.sales_rep_id || null;
    const prioritizeAsterisks = body.prioritize_asterisks !== false; // default true

    // Fetch companies with valid CNPJ in pages
    let query = supabase
      .from('companies')
      .select('id, name, cnpj, fantasia, address, city, state, phone, email, zip_code, neighborhood, address_number, address_complement')
      .not('cnpj', 'is', null)
      .order('name', { ascending: true })
      .range(offset, offset + limit * 3 - 1); // Fetch more to filter down

    if (salesRepId) {
      query = query.eq('sales_rep_id', salesRepId);
    }

    const { data: companies, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    // Filter: valid CNPJ (14 digits) AND needs enrichment
    const eligible = (companies || []).filter(c => {
      const digits = c.cnpj?.replace(/\D/g, '') || '';
      return digits.length === 14 && needsEnrichment(c);
    }).slice(0, limit);

    const totalScanned = companies?.length || 0;
    const hasMore = totalScanned >= limit * 3; // More pages available

    if (mode === 'scan') {
      // Scan mode: just report how many need enrichment without calling API
      const pending = (companies || []).filter(c => {
        const digits = c.cnpj?.replace(/\D/g, '') || '';
        return digits.length === 14 && needsEnrichment(c);
      });

      // Count total pending across all pages
      let totalPending = pending.length;
      let scanOffset = offset + limit * 3;
      
      // Scan up to 5 more pages to estimate total
      for (let i = 0; i < 5 && hasMore; i++) {
        const { data: moreCos } = await supabase
          .from('companies')
          .select('id, name, cnpj, fantasia, address, city, state, phone, email, zip_code, neighborhood, address_number')
          .not('cnpj', 'is', null)
          .order('name', { ascending: true })
          .range(scanOffset, scanOffset + 999);
        
        if (!moreCos || moreCos.length === 0) break;
        totalPending += moreCos.filter(c => {
          const digits = c.cnpj?.replace(/\D/g, '') || '';
          return digits.length === 14 && needsEnrichment(c);
        }).length;
        scanOffset += 1000;
        if (moreCos.length < 1000) break;
      }

      return new Response(JSON.stringify({
        success: true,
        mode: 'scan',
        total_pending: totalPending,
        sample: pending.slice(0, 10).map(c => ({
          id: c.id,
          name: c.name,
          missing_fields: getMissingFields(c),
        })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (eligible.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum cliente com dados faltantes encontrado neste lote',
        enriched: 0,
        failed: 0,
        total_checked: totalScanned,
        has_more: hasMore,
        next_offset: offset + limit * 3,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let enriched = 0;
    let failed = 0;
    const details: { id: string; name: string; status: string; fields_updated: string[] }[] = [];

    for (const company of eligible) {
      const cnpjClean = company.cnpj!.replace(/\D/g, '');
      const apiData = await fetchCNPJ(cnpjClean);

      if (!apiData) {
        failed++;
        details.push({ id: company.id, name: company.name, status: 'api_error', fields_updated: [] });
        await sleep(600);
        continue;
      }

      const updates: Record<string, any> = {};
      const fieldsUpdated: string[] = [];

      // Replace name if it contains asterisks
      if (hasPlaceholder(company.name) && apiData.razao_social) {
        updates.name = apiData.razao_social;
        fieldsUpdated.push('name');
      }
      if ((!company.fantasia || hasPlaceholder(company.fantasia)) && apiData.nome_fantasia) {
        updates.fantasia = apiData.nome_fantasia;
        fieldsUpdated.push('fantasia');
      }
      if ((!company.address || hasPlaceholder(company.address)) && apiData.logradouro) {
        updates.address = apiData.logradouro;
        fieldsUpdated.push('address');
      }
      if (!company.address_number && apiData.numero) {
        updates.address_number = apiData.numero;
        fieldsUpdated.push('address_number');
      }
      if (!company.address_complement && apiData.complemento) {
        updates.address_complement = apiData.complemento;
        fieldsUpdated.push('address_complement');
      }
      if ((!company.neighborhood || hasPlaceholder(company.neighborhood)) && apiData.bairro) {
        updates.neighborhood = apiData.bairro;
        fieldsUpdated.push('neighborhood');
      }
      if ((!company.city || hasPlaceholder(company.city)) && apiData.municipio) {
        updates.city = apiData.municipio;
        fieldsUpdated.push('city');
      }
      if (!company.state && apiData.uf) {
        updates.state = apiData.uf;
        fieldsUpdated.push('state');
      }
      if (!company.zip_code && apiData.cep) {
        updates.zip_code = apiData.cep?.replace(/\D/g, '');
        fieldsUpdated.push('zip_code');
      }
      if (!company.phone && apiData.ddd_telefone_1) {
        updates.phone = apiData.ddd_telefone_1?.replace(/\D/g, '');
        fieldsUpdated.push('phone');
      }
      if (!company.email && apiData.email) {
        updates.email = apiData.email;
        fieldsUpdated.push('email');
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('companies')
          .update(updates)
          .eq('id', company.id);

        if (updateError) {
          failed++;
          details.push({ id: company.id, name: company.name, status: 'update_error', fields_updated: [] });
        } else {
          enriched++;
          details.push({ id: company.id, name: updates.name || company.name, status: 'enriched', fields_updated: fieldsUpdated });
        }
      } else {
        details.push({ id: company.id, name: company.name, status: 'no_update_needed', fields_updated: [] });
      }

      await sleep(600);
    }

    console.log(`[enrich-companies-batch] Enriched: ${enriched}, Failed: ${failed}, Total: ${eligible.length}, Offset: ${offset}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Enriquecimento concluído: ${enriched} atualizados, ${failed} com erro`,
      enriched,
      failed,
      total_checked: eligible.length,
      has_more: hasMore,
      next_offset: offset + limit * 3,
      details,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[enrich-companies-batch] Error:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getMissingFields(company: any): string[] {
  const missing: string[] = [];
  const labels: Record<string, string> = {
    name: 'Razão Social', fantasia: 'Nome Fantasia', address: 'Endereço',
    city: 'Cidade', state: 'UF', zip_code: 'CEP', phone: 'Telefone',
    email: 'E-mail', neighborhood: 'Bairro', address_number: 'Número',
  };
  
  for (const [field, label] of Object.entries(labels)) {
    if (!company[field] || hasPlaceholder(company[field])) {
      missing.push(label);
    }
  }
  return missing;
}