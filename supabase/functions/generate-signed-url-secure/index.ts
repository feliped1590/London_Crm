import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =========================================================================
    // 1. AUTENTICAÇÃO
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // =========================================================================
    // 2. SERVICE CLIENT
    // =========================================================================
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =========================================================================
    // 3. INPUT VALIDATION
    // =========================================================================
    const body = await req.json();
    const { bucket, file_path, company_id } = body;

    if (!bucket || typeof bucket !== 'string') {
      return new Response(
        JSON.stringify({ error: 'bucket is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!file_path || typeof file_path !== 'string') {
      return new Response(
        JSON.stringify({ error: 'file_path is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 4. AUTORIZAÇÃO — admin ou vendedor vinculado
    // =========================================================================
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });

    if (!isAdmin && company_id && UUID_REGEX.test(company_id)) {
      const { data: hasAccess } = await supabase
        .from('companies')
        .select('id')
        .eq('id', company_id)
        .eq('sales_rep_id', (
          await supabase
            .from('user_sales_reps')
            .select('sales_rep_id')
            .eq('user_id', userId)
        ).data?.map((r: any) => r.sales_rep_id) || []
        )
        .limit(1)
        .maybeSingle();

      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: 'File not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =========================================================================
    // 5. GERAR SIGNED URL
    // =========================================================================
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(file_path, 300);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: 'File not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 6. AUDIT LOG
    // =========================================================================
    const fileName = file_path.split('/').pop() || file_path;
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'document.download',
      entity_type: 'credit_document',
      entity_id: company_id && UUID_REGEX.test(company_id) ? company_id : null,
      metadata: { file_name: fileName, bucket, file_path },
      ip_address: ip,
    }).then(() => {}, () => {});

    return new Response(
      JSON.stringify({ signedUrl: signedUrlData.signedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('generate-signed-url-secure failed', { code: (error as any)?.code });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
