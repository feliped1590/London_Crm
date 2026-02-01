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

interface CRMClient {
  external_id: string;
  tipo_pessoa: string | null;
  cnpj_cpf: string | null;
  rg: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  telefone: string | null;
  celular: string | null;
  emails: string[];
  tipo_cliente: string | null;
  tipo_fornecedor: string | null;
  tipo_transportador: string | null;
  tipo_representante: string | null;
  segmento: string | null;
  subsegmento: string | null;
  regiao: string | null;
  subregiao: string | null;
  contribui_icms: boolean;
  possui_titulos: boolean;
  insc_estadual: string | null;
  destino_mercadoria: string | null;
  data_alteracao_erp: string | null;
  usuario_alteracao_erp: string | null;
  raw_data: unknown;
  synced_at: string;
}

interface ClientAddress {
  client_id: string;
  tipo: 'LOCAL' | 'ENTREGA' | 'COBRANCA';
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  codigo_cidade: string | null;
  cidade: string | null;
  uf: string | null;
}

// Extrai emails de uma string separada por ;
function extractEmails(emailStr: unknown): string[] {
  if (!emailStr || typeof emailStr !== 'string') return [];
  return emailStr
    .split(';')
    .map(e => e.trim())
    .filter(e => e.length > 0 && e.includes('@'));
}

// Converte S/N para boolean
function snToBoolean(value: unknown): boolean {
  return value === 'S' || value === 's';
}

// Converte qualquer valor para string ou null
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

// Mapeia cliente do Iniflex para CRM
function mapInflexClientToCRM(raw: unknown): CRMClient {
  const c = raw as Record<string, unknown>;
  
  return {
    external_id: String(c.codigo_erp || c.codigo || c.id || ''),
    tipo_pessoa: toStringOrNull(c.tipo_pessoa),
    cnpj_cpf: toStringOrNull(c.cnpj_cpf),
    rg: toStringOrNull(c.rg),
    razao_social: toStringOrNull(c.nome),
    nome_fantasia: toStringOrNull(c.nome_fantasia),
    telefone: toStringOrNull(c.fone),
    celular: toStringOrNull(c.celular),
    emails: extractEmails(c.se_mail),
    tipo_cliente: toStringOrNull(c.tipo_cliente),
    tipo_fornecedor: toStringOrNull(c.tipo_fornecedor),
    tipo_transportador: toStringOrNull(c.tipo_transportador),
    tipo_representante: toStringOrNull(c.tipo_representante),
    segmento: toStringOrNull(c.desc_segmento_mercado),
    subsegmento: toStringOrNull(c.desc_subsegmentomerc_descricao),
    regiao: toStringOrNull(c.desc_regiao),
    subregiao: toStringOrNull(c.desc_subregiao),
    contribui_icms: snToBoolean(c.contribui_icms),
    possui_titulos: snToBoolean(c.possui_titulos),
    insc_estadual: toStringOrNull(c.insc_estadual),
    destino_mercadoria: toStringOrNull(c.destino_mercadoria),
    data_alteracao_erp: toStringOrNull(c.data_alteracao),
    usuario_alteracao_erp: toStringOrNull(c.usuario_alteracao),
    raw_data: c,
    synced_at: new Date().toISOString(),
  };
}

// Extrai endereços do cliente
function extractAddresses(raw: Record<string, unknown>): Array<Omit<ClientAddress, 'client_id'>> {
  const addresses: Array<Omit<ClientAddress, 'client_id'>> = [];
  
  // LOCAL (loc_*)
  if (raw.loc_endereco || raw.loc_cidade) {
    addresses.push({
      tipo: 'LOCAL',
      endereco: toStringOrNull(raw.loc_endereco),
      numero: toStringOrNull(raw.loc_numero),
      complemento: toStringOrNull(raw.loc_complemento),
      bairro: toStringOrNull(raw.loc_bairro),
      cep: toStringOrNull(raw.loc_cep),
      codigo_cidade: toStringOrNull(raw.loc_codigo_cidade),
      cidade: toStringOrNull(raw.loc_cidade),
      uf: toStringOrNull(raw.loc_uf),
    });
  }
  
  // ENTREGA (ent_*)
  if (raw.ent_endereco || raw.ent_cidade) {
    addresses.push({
      tipo: 'ENTREGA',
      endereco: toStringOrNull(raw.ent_endereco),
      numero: toStringOrNull(raw.ent_numero),
      complemento: toStringOrNull(raw.ent_complemento),
      bairro: toStringOrNull(raw.ent_bairro),
      cep: toStringOrNull(raw.ent_cep),
      codigo_cidade: toStringOrNull(raw.ent_codigo_cidade),
      cidade: toStringOrNull(raw.ent_cidade),
      uf: toStringOrNull(raw.ent_uf),
    });
  }
  
  // COBRANCA (cob_*)
  if (raw.cob_endereco || raw.cob_cidade) {
    addresses.push({
      tipo: 'COBRANCA',
      endereco: toStringOrNull(raw.cob_endereco),
      numero: toStringOrNull(raw.cob_numero),
      complemento: toStringOrNull(raw.cob_complemento),
      bairro: toStringOrNull(raw.cob_bairro),
      cep: toStringOrNull(raw.cob_cep),
      codigo_cidade: toStringOrNull(raw.cob_codigo_cidade),
      cidade: toStringOrNull(raw.cob_cidade),
      uf: toStringOrNull(raw.cob_uf),
    });
  }
  
  return addresses;
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
          entity: 'clientes',
          processed: 0
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Ler last_sync_at
    const { data: syncControl } = await supabase
      .from('erp_sync_control')
      .select('last_sync_at')
      .eq('entity', 'clientes')
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

    console.log('[sync-clients] data_alteracao enviada:', lastSyncAt);

    // 3. Chamar API Iniflex
    // baseUrl já contém o endpoint completo (ex: https://iniflex.novafix.ind.br/api/v1/runtime/endpoint/integracao/iniflex/json)
    const apiUrl = body.baseUrl.replace(/\/+$/, '');
    const cleanToken = body.token.trim();

    const payload = {
      tipoComando: 'ASDCOMANDO',
      grupoComando: 'EXP_CLIENTES_V1',
      data_alteracao: lastSyncAt,
    };

    console.log('[sync-clients] Chamando Iniflex:', apiUrl);
    console.log('[sync-clients] Auth header format: Authorization: Bearer <TOKEN>');

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
      console.error('[sync-clients] Erro HTTP:', response.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro HTTP ${response.status}: ${errorText.substring(0, 200)}`,
          entity: 'clientes',
          processed: 0,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await response.json();
    
    // Extrair array de clientes (pode vir em diferentes formatos)
    let clients: unknown[] = [];
    if (Array.isArray(responseData)) {
      clients = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      clients = responseData.data;
    } else if (responseData?.clientes && Array.isArray(responseData.clientes)) {
      clients = responseData.clientes;
    }

    console.log('[sync-clients] registros recebidos:', clients.length);

    // Se não houver clientes, retornar sucesso sem processar
    if (clients.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          entity: 'clientes',
          processed: 0,
          created: 0,
          updated: 0,
          last_sync_at: lastSyncAt,
          message: 'Nenhum cliente novo ou alterado encontrado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Processar clientes
    let created = 0;
    let updated = 0;
    let maxDataAlteracao = lastSyncAt;

    for (const rawClient of clients) {
      try {
        const clientData = mapInflexClientToCRM(rawClient);
        
        if (!clientData.external_id) {
          console.warn('[sync-clients] Cliente sem external_id, pulando');
          continue;
        }

        // Atualizar maior data de alteração
        if (clientData.data_alteracao_erp && isNewerDate(clientData.data_alteracao_erp, maxDataAlteracao)) {
          maxDataAlteracao = clientData.data_alteracao_erp;
        }

        // Verificar se cliente já existe
        const { data: existingClient } = await supabase
          .from('crm_clients')
          .select('id')
          .eq('external_id', clientData.external_id)
          .maybeSingle();

        // UPSERT cliente
        const { data: upsertedClient, error: upsertError } = await supabase
          .from('crm_clients')
          .upsert(clientData, { onConflict: 'external_id' })
          .select('id')
          .single();

        if (upsertError) {
          console.error('[sync-clients] Erro ao salvar cliente:', clientData.external_id, upsertError);
          continue;
        }

        if (existingClient) {
          updated++;
        } else {
          created++;
        }

        // Processar endereços
        const rawRecord = rawClient as Record<string, unknown>;
        const addresses = extractAddresses(rawRecord);
        
        for (const addr of addresses) {
          const addressData: ClientAddress = {
            ...addr,
            client_id: upsertedClient.id,
          };

          await supabase
            .from('crm_client_addresses')
            .upsert(addressData, { onConflict: 'client_id,tipo' });
        }

      } catch (clientError) {
        console.error('[sync-clients] Erro ao processar cliente:', clientError);
      }
    }

    console.log('[sync-clients] maior data_alteracao:', maxDataAlteracao);

    // 5. Atualizar controle de sincronização
    // Converter data ERP para TIMESTAMPTZ
    const parsedMaxDate = parseErpDate(maxDataAlteracao);
    
    await supabase
      .from('erp_sync_control')
      .upsert({
        entity: 'clientes',
        last_sync_at: parsedMaxDate.toISOString(),
        last_sync_count: clients.length,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entity' });

    // 6. Retornar resumo
    return new Response(
      JSON.stringify({
        success: true,
        entity: 'clientes',
        processed: created + updated,
        created,
        updated,
        last_sync_at: maxDataAlteracao,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-clients] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        entity: 'clientes',
        processed: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
