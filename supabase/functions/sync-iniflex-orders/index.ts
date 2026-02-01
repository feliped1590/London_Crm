import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Data padrão para primeira carga
const DEFAULT_SYNC_DATE = '01/01/2025 00:00:00';

interface SyncRequest {
  baseUrl: string;
  token: string;
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

    // 2. Ler last_sync_at de erp_sync_control (entity = 'pedidos')
    const { data: syncControl } = await supabase
      .from('erp_sync_control')
      .select('last_sync_at')
      .eq('entity', 'pedidos')
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

    console.log('[sync-orders] data_alteracao enviada:', lastSyncAt);

    // 3. Chamar API Iniflex com EXP_PEDIDO_V1
    // ⚠️ Comando obrigatório: ASDCOMANDOJSONTMP (diferente de clientes/produtos)
    const apiUrl = body.baseUrl.replace(/\/+$/, '');
    const cleanToken = body.token.trim();

    const payload = {
      tipoComando: 'ASDCOMANDOJSONTMP',
      grupoComando: 'EXP_PEDIDO_V1',
      data_alteracao: lastSyncAt,
    };

    console.log('[sync-orders] Chamando Iniflex:', apiUrl, 'payload:', JSON.stringify(payload));

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
    let orders: unknown[] = [];
    if (Array.isArray(responseData)) {
      orders = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      orders = responseData.data;
    } else if (responseData?.pedidos && Array.isArray(responseData.pedidos)) {
      orders = responseData.pedidos;
    }

    console.log('[sync-orders] pedidos recebidos:', orders.length);

    // Se não houver pedidos, retornar sucesso sem processar
    if (orders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          entity: 'pedidos',
          processed: 0,
          created: 0,
          updated: 0,
          last_sync_at: lastSyncAt,
          message: 'Nenhum pedido novo ou alterado encontrado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Processar pedidos
    let created = 0;
    let updated = 0;
    let maxDataAlteracao = lastSyncAt;

    for (const rawOrder of orders) {
      try {
        const orderData = mapInflexOrderToCRM(rawOrder);
        
        if (!orderData.external_id) {
          console.warn('[sync-orders] Pedido sem external_id, pulando');
          continue;
        }

        // Atualizar maior data de alteração
        if (orderData.data_alteracao_erp && isNewerDate(orderData.data_alteracao_erp, maxDataAlteracao)) {
          maxDataAlteracao = orderData.data_alteracao_erp;
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
            continue;
          }
          orderId = existingOrder.id;
          updated++;
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
            continue;
          }
          orderId = insertedOrder.id;
          created++;
        }

        // 5. Processar itens do pedido
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

      } catch (orderError) {
        console.error('[sync-orders] Erro ao processar pedido:', orderError);
      }
    }

    console.log('[sync-orders] maior data_alteracao:', maxDataAlteracao);

    // 6. Atualizar controle de sincronização
    const parsedMaxDate = parseErpDate(maxDataAlteracao);
    
    await supabase
      .from('erp_sync_control')
      .upsert({
        entity: 'pedidos',
        last_sync_at: parsedMaxDate.toISOString(),
        last_sync_count: orders.length,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entity' });

    // 7. Retornar resumo
    return new Response(
      JSON.stringify({
        success: true,
        entity: 'pedidos',
        processed: created + updated,
        created,
        updated,
        last_sync_at: maxDataAlteracao,
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
