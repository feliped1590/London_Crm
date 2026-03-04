import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const MAX_FAILED_ATTEMPTS = 10;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get client IP for rate limiting and audit
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    const { token } = await req.json();
    const tokenPrefix = token ? token.substring(0, 8) : null;

    // Helper function to log access attempts
    const logAccess = async (proposalId: string | null, actionType: string, success: boolean) => {
      try {
        await supabase.from('proposal_access_logs').insert({
          proposal_id: proposalId,
          ip_address: clientIp,
          action: actionType,
          success,
          token_prefix: tokenPrefix,
        });
      } catch (logError) {
        console.error('Failed to log access attempt:', logError);
      }
    };

    // Check rate limiting - count failed attempts in last hour
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: failedAttempts } = await supabase
      .from('proposal_access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', clientIp)
      .eq('success', false)
      .gte('created_at', oneHourAgo);

    if (failedAttempts && failedAttempts >= MAX_FAILED_ATTEMPTS) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      await logAccess(null, 'rate_limited', false);
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Por favor, aguarde antes de tentar novamente.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!token) {
      await logAccess(null, 'invalid_request', false);
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching proposal with token prefix:', tokenPrefix);

    // Fetch proposal by approval token
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        id,
        number,
        status,
        validity_date,
        payment_terms,
        delivery_terms,
        observations,
        total_value,
        created_at,
        approval_token_expires_at,
        approved_at,
        legal_entity_id,
        company:companies(id, name, cnpj, address, city, state, phone, email),
        contact:contacts(id, first_name, last_name, email, phone),
        legal_entity:legal_entities(id, name, trade_name, cnpj, logo_url, phone, email, address, city, state)
      `)
      .eq('approval_token', token)
      .single();

    if (proposalError || !proposal) {
      console.error('Error fetching proposal:', proposalError);
      await logAccess(null, 'invalid_token', false);
      return new Response(
        JSON.stringify({ error: 'Proposta não encontrada ou link inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already processed
    if (proposal.status === 'aprovada') {
      await logAccess(proposal.id, 'view_approved', true);
      return new Response(
        JSON.stringify({ 
          error: 'Esta proposta já foi aprovada',
          status: 'aprovada',
          approved_at: proposal.approved_at
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (proposal.status === 'recusada') {
      await logAccess(proposal.id, 'view_rejected', true);
      return new Response(
        JSON.stringify({ 
          error: 'Esta proposta já foi recusada',
          status: 'recusada'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if link expired
    if (proposal.approval_token_expires_at) {
      const expiresAt = new Date(proposal.approval_token_expires_at);
      if (expiresAt < new Date()) {
        await logAccess(proposal.id, 'expired_token', false);
        return new Response(
          JSON.stringify({ error: 'O link de aprovação expirou' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch proposal items
    const { data: items, error: itemsError } = await supabase
      .from('proposal_items')
      .select(`
        id,
        description,
        quantity,
        unit_price,
        width,
        length,
        thickness,
        discount_percent,
        subtotal,
        product:products(id, sku, name)
      `)
      .eq('proposal_id', proposal.id)
      .order('sort_order');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    }

    // Log successful view
    await logAccess(proposal.id, 'view', true);

    return new Response(
      JSON.stringify({
        success: true,
        proposal: {
          ...proposal,
          items: items || []
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in proposal-public-view:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
