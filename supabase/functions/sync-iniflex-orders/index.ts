import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Data padrão para primeira carga
const DEFAULT_SYNC_DATE = '01/01/2025 00:00:00';

// Timeout estendido para API de pedidos (90 segundos)
const API_TIMEOUT_MS = 90000;

// Tamanho do lote para processamento
const BATCH_SIZE = 50;

interface SyncRequest {
  baseUrl: string;
  token: string;
  // Parâmetros para processamento em lotes
  batch_index?: number;
  run_id?: string;
  cached_orders?: unknown[];
  max_data_alteracao?: string;
  total_created?: number;
  total_updated?: number;
}

interface CRMOrder {
  external_id: string;
  empresa: number | null;
  client_external_id: string | null;
  numero_pedido: string | null;
  tipo_pedido: string | null;
  status: string | null;
  situacao: string | null;
  data_emissao: string | null;
  data_entrega: string | null;
  data_alteracao_erp: string | null;
  valor_total: number | null;
  valor_desconto: number | null;
  valor_frete: number | null;
  raw_data: unknown;
  synced_at: string;
}

interface CRMOrderItem {
  product_external_id: string | null;
  descricao: string | null;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  raw_data: unknown;
}

// Converte qualquer valor para string ou null
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

// Converte qualquer valor para número ou null
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// Mapeia pedido do Iniflex para CRM
function mapInflexOrderToCRM(raw: unknown): CRMOrder {
  const p = raw as Record<string, unknown>;
  
  // external_id = numero_pedido (conforme ajuste recomendado)
  const numeroPedido = toStringOrNull(p.numero_pedido || p.numero || p.pedido || p.id);
  const external_id = numeroPedido || '';
  
  // Cliente - usar codigo_cliente ou similar
  const clientExternalId = toStringOrNull(p.codigo_cliente || p.cliente || p.cod_cliente);
  
  return {
    external_id,
    empresa: toNumberOrNull(p.empresa) as number | null,
    client_external_id: clientExternalId,
    numero_pedido: numeroPedido,
    tipo_pedido: toStringOrNull(p.tipo_pedido || p.tipo),
    status: toStringOrNull(p.status),
    situacao: toStringOrNull(p.situacao),
    data_emissao: toStringOrNull(p.data_emissao),
    data_entrega: toStringOrNull(p.data_entrega),
    data_alteracao_erp: toStringOrNull(p.data_alteracao),
    valor_total: toNumberOrNull(p.valor_total || p.total),
    valor_desconto: toNumberOrNull(p.valor_desconto || p.desconto),
    valor_frete: toNumberOrNull(p.valor_frete || p.frete),
    raw_data: p,
    synced_at: new Date().toISOString(),
  };
}

// Mapeia item do pedido
function mapInflexOrderItem(raw: unknown): CRMOrderItem {
  const i = raw as Record<string, unknown>;
  
  // product_external_id = produto/versao do ERP
  const productExternalId = toStringOrNull(i.produto || i.codigo_produto || i.cod_produto);
  
  return {
    product_external_id: productExternalId,
    descricao: toStringOrNull(i.descricao || i.desc_produto || i.nome_produto),
    quantidade: toNumberOrNull(i.quantidade || i.qtd),
    unidade: toStringOrNull(i.unidade || i.un),
    valor_unitario: toNumberOrNull(i.valor_unitario || i.preco_unitario || i.vlr_unitario),
    valor_total: toNumberOrNull(i.valor_total || i.vlr_total || i.total),
    raw_data: i,
  };
}

// Compara datas no formato DD/MM/YYYY HH24:MI:SS
function parseErpDate(dateStr: string): Date {
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

// Processa um único pedido e retorna created/updated
async function processOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rawOrder: unknown,
  maxDataAlteracao: { value: string }
): Promise<{ created: number; updated: number }> {
  const orderData = mapInflexOrderToCRM(rawOrder);
  
  if (!orderData.external_id) {
    console.warn('[sync-orders] Pedido sem external_id, pulando');
    return { created: 0, updated: 0 };
  }

  // Atualizar maior data de alteração
  if (orderData.data_alteracao_erp && isNewerDate(orderData.data_alteracao_erp, maxDataAlteracao.value)) {
    maxDataAlteracao.value = orderData.data_alteracao_erp;
  }

  // Tentar vincular client_id (não falhar se não encontrar)
  let clientId: string | null = null;
  if (orderData.client_external_id) {
    const { data: clientData } = await supabase
      .from('crm_clients')
      .select('id')
      .eq('external_id', orderData.client_external_id)
      .maybeSingle();
    
    if (clientData?.id) {
      clientId = clientData.id;
    }
  }

  // Verificar se pedido já existe
  const { data: existingOrder } = await supabase
    .from('crm_orders')
    .select('id')
    .eq('external_id', orderData.external_id)
    .maybeSingle();

  let orderId: string;
  let created = 0;
  let updated = 0;

  if (existingOrder) {
    // UPDATE
    const { error: updateError } = await supabase
      .from('crm_orders')
      .update({
        ...orderData,
        client_id: clientId,
      })
      .eq('id', existingOrder.id);

    if (updateError) {
      console.error('[sync-orders] Erro ao atualizar pedido:', orderData.external_id, updateError);
      return { created: 0, updated: 0 };
    }
    orderId = existingOrder.id;
    updated = 1;
  } else {
    // INSERT
    const { data: insertedOrder, error: insertError } = await supabase
      .from('crm_orders')
      .insert({
        ...orderData,
        client_id: clientId,
      })
      .select('id')
      .single();

    if (insertError || !insertedOrder) {
      console.error('[sync-orders] Erro ao inserir pedido:', orderData.external_id, insertError);
      return { created: 0, updated: 0 };
    }
    orderId = insertedOrder.id;
    created = 1;
  }

  // Processar itens do pedido
  const rawOrderRecord = rawOrder as Record<string, unknown>;
  const items = (rawOrderRecord.itens || rawOrderRecord.items || rawOrderRecord.produtos || []) as unknown[];
  
  if (items.length > 0) {
    // Remover itens antigos do pedido
    await supabase
      .from('crm_order_items')
      .delete()
      .eq('order_id', orderId);

    // Inserir novos itens
    for (const rawItem of items) {
      try {
        const itemData = mapInflexOrderItem(rawItem);
        
        // Tentar vincular product_id (não falhar se não encontrar)
        let productId: string | null = null;
        if (itemData.product_external_id) {
          const { data: productData } = await supabase
            .from('crm_products')
            .select('id')
            .eq('external_id', itemData.product_external_id)
            .maybeSingle();
          
          if (productData?.id) {
            productId = productData.id;
          }
        }

        await supabase
          .from('crm_order_items')
          .insert({
            order_id: orderId,
            product_id: productId,
            ...itemData,
          });

      } catch (itemError) {
        console.error('[sync-orders] Erro ao processar item:', itemError);
      }
    }
  }

  return { created, updated };
}

// Fetch com timeout customizável
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
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
          entity: 'pedidos',
          processed: 0
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se é uma chamada de continuação de lote
    const isBatchContinuation = body.batch_index !== undefined && body.batch_index > 0;
    
    let orders: unknown[] = [];
    let lastSyncAt = DEFAULT_SYNC_DATE;
    let maxDataAlteracao: { value: string };
    let totalCreated = body.total_created || 0;
    let totalUpdated = body.total_updated || 0;

    if (isBatchContinuation && body.cached_orders) {
      // Continuação de lote - usar dados já buscados
      orders = body.cached_orders;
      maxDataAlteracao = { value: body.max_data_alteracao || DEFAULT_SYNC_DATE };
      console.log(`[sync-orders] Continuando lote ${body.batch_index}, pedidos restantes: ${orders.length}`);
    } else {
      // Nova sincronização - buscar dados do ERP
      
      // 2. Ler last_sync_at de erp_sync_control (entity = 'pedidos')
      const { data: syncControl } = await supabase
        .from('erp_sync_control')
        .select('last_sync_at')
        .eq('entity', 'pedidos')
        .maybeSingle();

      // Converter TIMESTAMPTZ para formato ERP (DD/MM/YYYY HH24:MI:SS)
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

      maxDataAlteracao = { value: lastSyncAt };

      console.log('[sync-orders] data_alteracao enviada:', lastSyncAt);

      // 3. Chamar API Iniflex com EXP_PEDIDO_V1 e timeout estendido
      const apiUrl = body.baseUrl.replace(/\/+$/, '');
      const cleanToken = body.token.trim();

      const payload = {
        tipoComando: 'ASDCOMANDOJSONTMP',
        grupoComando: 'EXP_PEDIDO_V1',
        data_alteracao: lastSyncAt,
      };

      console.log('[sync-orders] Chamando Iniflex com timeout de', API_TIMEOUT_MS, 'ms');

      let response: Response;
      try {
        response = await fetchWithTimeout(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanToken}`,
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        }, API_TIMEOUT_MS);
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timeout: API não respondeu em ${API_TIMEOUT_MS / 1000} segundos. Tente novamente em horários de menor carga ou contate o suporte do ERP.`,
              entity: 'pedidos',
              processed: 0,
            }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw fetchError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[sync-orders] Erro HTTP:', response.status, errorText);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Erro HTTP ${response.status}: ${errorText.substring(0, 200)}`,
            entity: 'pedidos',
            processed: 0,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const responseData = await response.json();
      
      // Extrair array de pedidos (pode vir em diferentes formatos)
      if (Array.isArray(responseData)) {
        orders = responseData;
      } else if (responseData?.data && Array.isArray(responseData.data)) {
        orders = responseData.data;
      } else if (responseData?.pedidos && Array.isArray(responseData.pedidos)) {
        orders = responseData.pedidos;
      }

      console.log('[sync-orders] Total de pedidos recebidos:', orders.length);
    }

    // Se não houver pedidos, retornar sucesso sem processar
    if (orders.length === 0) {
      // Se é o final de um lote, atualizar controle de sincronização
      if (isBatchContinuation && (totalCreated > 0 || totalUpdated > 0)) {
        const parsedMaxDate = parseErpDate(maxDataAlteracao.value);
        await supabase
          .from('erp_sync_control')
          .upsert({
            entity: 'pedidos',
            last_sync_at: parsedMaxDate.toISOString(),
            last_sync_count: totalCreated + totalUpdated,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'entity' });
      }

      return new Response(
        JSON.stringify({
          success: true,
          entity: 'pedidos',
          processed: totalCreated + totalUpdated,
          created: totalCreated,
          updated: totalUpdated,
          last_sync_at: maxDataAlteracao.value,
          message: isBatchContinuation 
            ? 'Sincronização de lotes concluída' 
            : 'Nenhum pedido novo ou alterado encontrado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Processar lote de pedidos
    const batch = orders.slice(0, BATCH_SIZE);
    const remaining = orders.slice(BATCH_SIZE);

    console.log(`[sync-orders] Processando lote de ${batch.length} pedidos, ${remaining.length} restantes`);

    for (const rawOrder of batch) {
      try {
        const result = await processOrder(supabase, rawOrder, maxDataAlteracao);
        totalCreated += result.created;
        totalUpdated += result.updated;
      } catch (orderError) {
        console.error('[sync-orders] Erro ao processar pedido:', orderError);
      }
    }

    // 5. Se ainda há pedidos, encadear próximo lote
    if (remaining.length > 0) {
      console.log(`[sync-orders] Encadeando próximo lote, ${remaining.length} pedidos restantes`);
      
      // Fire-and-forget para próximo lote
      const nextBatchIndex = (body.batch_index || 0) + 1;
      
      fetch(`${supabaseUrl}/functions/v1/sync-iniflex-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          baseUrl: body.baseUrl,
          token: body.token,
          batch_index: nextBatchIndex,
          run_id: body.run_id || crypto.randomUUID(),
          cached_orders: remaining,
          max_data_alteracao: maxDataAlteracao.value,
          total_created: totalCreated,
          total_updated: totalUpdated,
        }),
      }).catch(err => console.error('[sync-orders] Erro ao encadear lote:', err));

      return new Response(
        JSON.stringify({
          success: true,
          entity: 'pedidos',
          processed: totalCreated + totalUpdated,
          created: totalCreated,
          updated: totalUpdated,
          remaining: remaining.length,
          batch_index: nextBatchIndex,
          status: 'processing',
          message: `Processando em lotes. Lote ${(body.batch_index || 0) + 1} concluído, ${remaining.length} pedidos restantes.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Último lote - atualizar controle de sincronização
    console.log('[sync-orders] Todos os lotes processados. Created:', totalCreated, 'Updated:', totalUpdated);
    
    const parsedMaxDate = parseErpDate(maxDataAlteracao.value);
    
    await supabase
      .from('erp_sync_control')
      .upsert({
        entity: 'pedidos',
        last_sync_at: parsedMaxDate.toISOString(),
        last_sync_count: totalCreated + totalUpdated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entity' });

    // 7. Retornar resumo final
    return new Response(
      JSON.stringify({
        success: true,
        entity: 'pedidos',
        processed: totalCreated + totalUpdated,
        created: totalCreated,
        updated: totalUpdated,
        last_sync_at: maxDataAlteracao.value,
        status: 'completed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-orders] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        entity: 'pedidos',
        processed: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
