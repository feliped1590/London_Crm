import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching proposal with token:', token);

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
        company:companies(id, name, cnpj, address, city, state, phone, email),
        contact:contacts(id, first_name, last_name, email, phone)
      `)
      .eq('approval_token', token)
      .single();

    if (proposalError || !proposal) {
      console.error('Error fetching proposal:', proposalError);
      return new Response(
        JSON.stringify({ error: 'Proposta não encontrada ou link inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already processed
    if (proposal.status === 'aprovada') {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
