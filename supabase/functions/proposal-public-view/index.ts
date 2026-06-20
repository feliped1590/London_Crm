import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const MAX_FAILED_ATTEMPTS = 10;
const TOKEN_MIN_LENGTH = 16;
const TOKEN_MAX_LENGTH = 180;
const TOKEN_FORMAT_REGEX = /^[A-Za-z0-9._-]+$/;
const GENERIC_INVALID_LINK_ERROR = 'Link inválido ou expirado';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(
    JSON.stringify(payload),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function sanitizeToken(rawToken: unknown): string | null {
  if (typeof rawToken !== 'string') return null;

  const token = rawToken.trim();
  if (!token) return null;
  if (token.length < TOKEN_MIN_LENGTH || token.length > TOKEN_MAX_LENGTH) return null;
  if (!TOKEN_FORMAT_REGEX.test(token)) return null;
  return token;
}

function tokenHint(token: string | null) {
  if (!token) return null;
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}***${token.slice(-2)}`;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: { ...corsHeaders, 'Allow': 'POST, OPTIONS' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get client IP for rate limiting and audit
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    let rawBody: Record<string, unknown> | null = null;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: GENERIC_INVALID_LINK_ERROR }, 404);
    }

    const token = sanitizeToken(rawBody?.token);
    const maskedToken = tokenHint(token);

    // Helper function to log access attempts (without persisting raw token data)
    const logAccess = async (
      proposalId: string | null,
      actionType: string,
      success: boolean,
      tokenHashPrefix: string | null = null,
    ) => {
      try {
        await supabase.from('proposal_access_logs').insert({
          proposal_id: proposalId,
          ip_address: clientIp,
          action: actionType,
          success,
          token_prefix: tokenHashPrefix,
        });
      } catch (logError) {
        console.error('Failed to log access attempt', { code: (logError as { code?: string })?.code });
      }
    };

    // Check rate limiting - count failed attempts in last hour
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: failedAttempts, error: rateLimitError } = await supabase
      .from('proposal_access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', clientIp)
      .eq('success', false)
      .gte('created_at', oneHourAgo);

    if (rateLimitError) {
      console.error('Rate limit check failed', { code: rateLimitError.code });
      return jsonResponse({ error: 'Serviço temporariamente indisponível' }, 503);
    }

    if (failedAttempts && failedAttempts >= MAX_FAILED_ATTEMPTS) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      await logAccess(null, 'rate_limited', false);
      return jsonResponse({ error: 'Muitas tentativas. Por favor, aguarde antes de tentar novamente.' }, 429);
    }

    if (!token) {
      await logAccess(null, 'invalid_token_format', false);
      return jsonResponse({ error: GENERIC_INVALID_LINK_ERROR }, 404);
    }

    const tokenHash = await sha256Hex(token);
    const tokenHashPrefix = tokenHash.slice(0, 8);

    console.log('Fetching proposal by token hint', { token: maskedToken, ip: clientIp });

    // Fetch active public link by token hash (never query with raw token)
    const nowIso = new Date().toISOString();
    const { data: publicLink, error: publicLinkError } = await supabase
      .from('proposal_public_links')
      .select('id, proposal_id, status, expires_at, revoked_at, access_count, max_access_count')
      .eq('token_hash', tokenHash)
      .eq('token_hash_alg', 'sha256')
      .eq('status', 'active')
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .single();

    if (publicLinkError || !publicLink) {
      console.error('Public link fetch denied', { token: maskedToken, code: publicLinkError?.code });
      await logAccess(null, 'invalid_token', false, tokenHashPrefix);
      return jsonResponse({ error: GENERIC_INVALID_LINK_ERROR }, 404);
    }

    if (
      publicLink.max_access_count !== null &&
      publicLink.max_access_count !== undefined &&
      publicLink.access_count >= publicLink.max_access_count
    ) {
      await logAccess(publicLink.proposal_id, 'max_access_exceeded', false, tokenHashPrefix);
      return jsonResponse({ error: GENERIC_INVALID_LINK_ERROR }, 404);
    }

    // Fetch proposal by proposal_id resolved from public link
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
        subtotal_products,
        total_ipi,
        ipi_mode,
        created_at,
        approved_at,
        company:companies(name),
        contact:contacts(first_name, last_name),
        legal_entity:legal_entities(name, trade_name, logo_url)
      `)
      .eq('id', publicLink.proposal_id)
      .single();

    if (proposalError || !proposal) {
      console.error('Proposal fetch denied', { token: maskedToken, code: proposalError?.code });
      await logAccess(null, 'invalid_token', false, tokenHashPrefix);
      return jsonResponse({ error: GENERIC_INVALID_LINK_ERROR }, 404);
    }

    // Check if already processed
    if (proposal.status === 'aprovada') {
      await logAccess(proposal.id, 'view_approved', true, tokenHashPrefix);
      return jsonResponse(
        {
          error: 'Esta proposta já foi aprovada',
          status: 'aprovada',
          approved_at: proposal.approved_at
        },
        400
      );
    }

    if (proposal.status === 'recusada') {
      await logAccess(proposal.id, 'view_rejected', true, tokenHashPrefix);
      return jsonResponse(
        {
          error: 'Esta proposta já foi recusada',
          status: 'recusada'
        },
        400
      );
    }

    // Fetch proposal items
    const { data: items, error: itemsError } = await supabase
      .from('proposal_items')
      .select(`
        description,
        quantity,
        unit_price,
        discount_percent,
        subtotal_item,
        total_item,
        product:products(name)
      `)
      .eq('proposal_id', proposal.id)
      .order('sort_order');

    if (itemsError) {
      console.error('Error fetching proposal items', { token: maskedToken, code: itemsError.code });
    }

    // Log successful view
    await logAccess(proposal.id, 'view', true, tokenHashPrefix);

    const publicProposal = {
      number: proposal.number,
      status: proposal.status,
      validity_date: proposal.validity_date,
      payment_terms: proposal.payment_terms,
      delivery_terms: proposal.delivery_terms,
      observations: proposal.observations,
      total_value: proposal.total_value,
      subtotal_products: proposal.subtotal_products,
      total_ipi: proposal.total_ipi,
      ipi_mode: proposal.ipi_mode,
      created_at: proposal.created_at,
      approved_at: proposal.approved_at,
      company: proposal.company,
      contact: proposal.contact,
      legal_entity: proposal.legal_entity,
      items: items || [],
    };

    return jsonResponse({
      success: true,
      proposal: publicProposal
    });

  } catch (error: unknown) {
    console.error('Error in proposal-public-view', { code: (error as { code?: string })?.code });
    return jsonResponse({ error: 'Erro interno' }, 500);
  }
});
