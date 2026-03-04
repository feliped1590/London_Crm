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

    const { token, action, approver_name, rejection_reason } = await req.json();
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

    if (!action || !['approve', 'reject'].includes(action)) {
      await logAccess(null, 'invalid_request', false);
      return new Response(
        JSON.stringify({ error: 'Ação deve ser "approve" ou "reject"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve' && !approver_name) {
      await logAccess(null, 'invalid_request', false);
      return new Response(
        JSON.stringify({ error: 'Nome do responsável é obrigatório para aprovação' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing approval for token prefix:', tokenPrefix, 'action:', action);

    // Fetch proposal by approval token
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
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
    if (proposal.status === 'aprovada' || proposal.status === 'recusada') {
      await logAccess(proposal.id, 'already_processed', false);
      return new Response(
        JSON.stringify({ error: 'Esta proposta já foi processada' }),
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

    const now = new Date().toISOString();

    if (action === 'approve') {
      // Update proposal to approved
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          status: 'aprovada',
          approved_at: now,
          approved_by_name: approver_name,
          approved_by_ip: clientIp,
          approval_token: null, // Invalidate token after use
        })
        .eq('id', proposal.id);

      if (updateError) {
        console.error('Error updating proposal:', updateError);
        await logAccess(proposal.id, 'approve_error', false);
        throw updateError;
      }

      // Log successful approval
      await logAccess(proposal.id, 'approve', true);

      // Fetch deal data to get legal_entity_id and tenant_id
      let legalEntityId = proposal.legal_entity_id;
      let tenantId = proposal.tenant_id;

      if (proposal.deal_id) {
        const { data: dealData } = await supabase
          .from('deals')
          .select('legal_entity_id, tenant_id')
          .eq('id', proposal.deal_id)
          .single();

        if (dealData) {
          if (!legalEntityId) legalEntityId = dealData.legal_entity_id;
          if (!tenantId) tenantId = dealData.tenant_id;
        }
      }

      // Fallback: get first active legal entity
      if (!legalEntityId) {
        const { data: fallbackEntity } = await supabase
          .from('legal_entities')
          .select('id')
          .eq('is_active', true)
          .order('is_headquarters', { ascending: false })
          .limit(1)
          .single();

        if (fallbackEntity) legalEntityId = fallbackEntity.id;
      }

      // Create order from approved proposal
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          number: '', // Auto-generated by trigger
          proposal_id: proposal.id,
          company_id: proposal.company_id,
          contact_id: proposal.contact_id,
          status: 'pendente',
          total_value: proposal.total_value,
          observations: proposal.observations,
          legal_entity_id: legalEntityId,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        // Don't throw - proposal is still approved even if order creation fails
      } else if (newOrder) {
        // Copy proposal items to order items
        const { data: proposalItems } = await supabase
          .from('proposal_items')
          .select('*')
          .eq('proposal_id', proposal.id);

        if (proposalItems && proposalItems.length > 0) {
          const orderItems = proposalItems.map((item: any) => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            width: item.width,
            length: item.length,
            thickness: item.thickness,
            subtotal: item.subtotal,
            sort_order: item.sort_order,
          }));

          await supabase.from('order_items').insert(orderItems);
        }
      }

      // Move deal to "fechado_ganho" if proposal is linked to a deal
      if (proposal.deal_id) {
        // Get current deal stage for audit log
        const { data: currentDeal } = await supabase
          .from('deals')
          .select('stage')
          .eq('id', proposal.deal_id)
          .single();

        const { error: dealUpdateError } = await supabase
          .from('deals')
          .update({
            stage: 'fechado_ganho',
            closed_at: now,
          })
          .eq('id', proposal.deal_id);

        if (!dealUpdateError) {
          // Record in deal audit log (system as author - null changed_by)
          await supabase.from('deal_audit_log').insert({
            deal_id: proposal.deal_id,
            field_name: 'stage',
            field_label: 'Etapa',
            old_value: currentDeal?.stage || null,
            new_value: 'fechado_ganho',
            changed_by: null, // System action via client approval
          });

          console.log('Deal moved to fechado_ganho:', proposal.deal_id);
        } else {
          console.error('Error updating deal stage:', dealUpdateError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Proposta aprovada com sucesso!',
          order_number: newOrder?.number,
          deal_closed: !!proposal.deal_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Reject proposal
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          status: 'recusada',
          rejection_reason: rejection_reason || null,
          approval_token: null, // Invalidate token after use
        })
        .eq('id', proposal.id);

      if (updateError) {
        console.error('Error updating proposal:', updateError);
        await logAccess(proposal.id, 'reject_error', false);
        throw updateError;
      }

      // Log successful rejection
      await logAccess(proposal.id, 'reject', true);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Proposta recusada'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Error in proposal-approve:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
