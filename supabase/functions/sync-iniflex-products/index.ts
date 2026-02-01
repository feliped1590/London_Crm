import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Data padrão para primeira carga
const DEFAULT_SYNC_DATE = '01/01/2000 00:00:00';

interface SyncRequest {
  baseUrl: string;
  token: string;
}

interface CRMProduct {
  external_id: string;
  descricao: string | null;
  versao: string | null;
  sku: string | null;
  unidade: string | null;
  ativo: boolean;
  data_alteracao_erp: string | null;
  raw_data: unknown;
  synced_at: string;
}

// Converte S/N para boolean
function snToBoolean(value: unknown): boolean {
  return value === 'S' || value === 's' || value === true || value === 1;
}

// Converte qualquer valor para string ou null
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

// Mapeia produto do Iniflex para CRM
function mapInflexProductToCRM(raw: unknown): CRMProduct {
  const p = raw as Record<string, unknown>;
  
  const external_id = String(p.codigo_erp || p.codigo || p.id || '');
  const versao = toStringOrNull(p.versao);
  
  // SKU: usar codigo_sku se existir, senão compor external_id-versao
  const sku = toStringOrNull(p.codigo_sku) ?? 
    (versao ? `${external_id}-${versao}` : external_id);
  
  return {
    external_id,
    descricao: toStringOrNull(p.descricao || p.nome),
    versao,
    sku,
    unidade: toStringOrNull(p.unidade || p.un),
    ativo: snToBoolean(p.ativo ?? true),
    data_alteracao_erp: toStringOrNull(p.data_alteracao),
    raw_data: p,
    synced_at: new Date().toISOString(),
  };
}

// Compara datas no formato DD/MM/YYYY HH24:MI:SS
function parseErpDate(dateStr: string): Date {
  // Formato: DD/MM/YYYY HH24:MI:SS
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hour, minute, second] = (timePart || '00:00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

function isNewerDate(dateA: string, dateB: string): boolean {
  try {
    return parseErpDate(dateA) > parseErpDate(dateB);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validar request
    const body = await req.json() as SyncRequest;
    
    if (!body.baseUrl || !body.token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais obrigatórias: baseUrl e token',
          entity: 'produtos',
          processed: 0
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Ler last_sync_at de erp_sync_control (entity = 'produtos')
    const { data: syncControl } = await supabase
      .from('erp_sync_control')
      .select('last_sync_at')
      .eq('entity', 'produtos')
      .maybeSingle();

    // Converter TIMESTAMPTZ para formato ERP (DD/MM/YYYY HH24:MI:SS)
    let lastSyncAt = DEFAULT_SYNC_DATE;
    if (syncControl?.last_sync_at) {
      const d = new Date(syncControl.last_sync_at);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      const second = String(d.getSeconds()).padStart(2, '0');
      lastSyncAt = `${day}/${month}/${year} ${hour}:${minute}:${second}`;
    }

    console.log('[sync-products] data_alteracao enviada:', lastSyncAt);

    // 3. Chamar API Iniflex com EXP_PRODUTOS_V1
    const apiUrl = body.baseUrl.replace(/\/+$/, '');
    const cleanToken = body.token.trim();

    const payload = {
      tipoComando: 'ASDCOMANDO',
      grupoComando: 'EXP_PRODUTOS_V1',
      data_alteracao: lastSyncAt,
    };

    console.log('[sync-products] Chamando Iniflex:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sync-products] Erro HTTP:', response.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro HTTP ${response.status}: ${errorText.substring(0, 200)}`,
          entity: 'produtos',
          processed: 0,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await response.json();
    
    // Extrair array de produtos (pode vir em diferentes formatos)
    let products: unknown[] = [];
    if (Array.isArray(responseData)) {
      products = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      products = responseData.data;
    } else if (responseData?.produtos && Array.isArray(responseData.produtos)) {
      products = responseData.produtos;
    } else if (responseData?.versoes && Array.isArray(responseData.versoes)) {
      products = responseData.versoes;
    }

    console.log('[sync-products] registros recebidos:', products.length);

    // Se não houver produtos, retornar sucesso sem processar
    if (products.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          entity: 'produtos',
          processed: 0,
          created: 0,
          updated: 0,
          last_sync_at: lastSyncAt,
          message: 'Nenhum produto novo ou alterado encontrado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Processar produtos
    let created = 0;
    let updated = 0;
    let maxDataAlteracao = lastSyncAt;

    for (const rawProduct of products) {
      try {
        const productData = mapInflexProductToCRM(rawProduct);
        
        if (!productData.external_id) {
          console.warn('[sync-products] Produto sem external_id, pulando');
          continue;
        }

        // Atualizar maior data de alteração
        if (productData.data_alteracao_erp && isNewerDate(productData.data_alteracao_erp, maxDataAlteracao)) {
          maxDataAlteracao = productData.data_alteracao_erp;
        }

        // Verificar se produto já existe (por external_id + versao)
        const { data: existingProduct } = await supabase
          .from('crm_products')
          .select('id')
          .eq('external_id', productData.external_id)
          .eq('versao', productData.versao ?? '')
          .maybeSingle();

        // UPSERT produto
        // Usar raw SQL para o upsert com índice composto
        const { error: upsertError } = await supabase
          .from('crm_products')
          .upsert({
            ...productData,
            // Garantir que versao vazia seja string vazia para o índice único
            versao: productData.versao ?? '',
          }, { 
            onConflict: 'external_id,versao',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('[sync-products] Erro ao salvar produto:', productData.external_id, upsertError);
          continue;
        }

        if (existingProduct) {
          updated++;
        } else {
          created++;
        }

      } catch (productError) {
        console.error('[sync-products] Erro ao processar produto:', productError);
      }
    }

    console.log('[sync-products] maior data_alteracao:', maxDataAlteracao);

    // 5. Atualizar controle de sincronização
    const parsedMaxDate = parseErpDate(maxDataAlteracao);
    
    await supabase
      .from('erp_sync_control')
      .upsert({
        entity: 'produtos',
        last_sync_at: parsedMaxDate.toISOString(),
        last_sync_count: products.length,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entity' });

    // 6. Retornar resumo
    return new Response(
      JSON.stringify({
        success: true,
        entity: 'produtos',
        processed: created + updated,
        created,
        updated,
        last_sync_at: maxDataAlteracao,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-products] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        entity: 'produtos',
        processed: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
