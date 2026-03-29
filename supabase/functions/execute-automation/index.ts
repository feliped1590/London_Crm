import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// --- Validation helpers ---
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

const VALID_TRIGGER_TYPES = ['stage_enter', 'stage_exit'];

interface AutomationRequest {
  deal_id: string;
  trigger_type: 'stage_enter' | 'stage_exit';
  trigger_stage: string;
}

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_stage: string;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =========================================================================
    // 1. AUTENTICAÇÃO — validar usuário real via getUser()
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

    // =========================================================================
    // 2. INPUT VALIDATION
    // =========================================================================
    const body = await req.json();
    const { deal_id, trigger_type, trigger_stage } = body as AutomationRequest;

    if (!deal_id || !isValidUUID(deal_id)) {
      return new Response(
        JSON.stringify({ error: 'deal_id must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trigger_type || !VALID_TRIGGER_TYPES.includes(trigger_type)) {
      return new Response(
        JSON.stringify({ error: 'trigger_type must be stage_enter or stage_exit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trigger_stage || typeof trigger_stage !== 'string' || trigger_stage.length > 200) {
      return new Response(
        JSON.stringify({ error: 'trigger_stage is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 3. SERVICE CLIENT — criado APÓS autenticação
    // =========================================================================
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =========================================================================
    // 4. RATE LIMIT — max 50 requests/min
    // =========================================================================
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentRequests } = await supabase
      .from('request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('function_name', 'execute-automation')
      .gte('created_at', oneMinuteAgo);

    if (recentRequests && recentRequests > 50) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Try again in a minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('request_logs').insert({
      user_id: userId,
      function_name: 'execute-automation',
    });

    // =========================================================================
    // 5. AUTORIZAÇÃO — anti-enumeração: resposta unificada 404
    // =========================================================================
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });

    const { data: dealCheck } = await supabase
      .from('deals')
      .select('id, owner_id, created_by')
      .eq('id', deal_id)
      .maybeSingle();

    let hasAccess = !!isAdmin;

    if (!hasAccess && dealCheck) {
      hasAccess = dealCheck.owner_id === userId || dealCheck.created_by === userId;

      if (!hasAccess) {
        const { data: participant } = await supabase
          .from('deal_participants')
          .select('id')
          .eq('deal_id', deal_id)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();
        hasAccess = !!participant;
      }
    }

    // Resposta unificada: não revela se o deal existe ou se é acesso negado
    if (!dealCheck || !hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 6. LÓGICA DE NEGÓCIO (mantida integralmente)
    // =========================================================================
    console.log('Processing automation', { trigger_type, trigger_stage });

    const { data: automations, error: automationsError } = await supabase
      .from('pipeline_automations')
      .select('*')
      .eq('trigger_type', trigger_type)
      .eq('trigger_stage', trigger_stage)
      .eq('is_active', true);

    if (automationsError) {
      console.error('Error fetching automations:', automationsError);
      throw automationsError;
    }

    if (!automations || automations.length === 0) {
      console.log('No active automations found for this trigger');
      return new Response(
        JSON.stringify({ success: true, message: 'No automations to execute', executed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${automations.length} automations to execute`);

    const { data: dealFull, error: dealError } = await supabase
      .from('deals')
      .select('*, contacts(id, first_name, last_name, email, mobile, phone), companies(id, name)')
      .eq('id', deal_id)
      .single();

    if (dealError) {
      console.error('Error fetching deal:', dealError);
      throw dealError;
    }

    const results: { automation: string; action: string; success: boolean; error?: string }[] = [];

    for (const automation of automations as Automation[]) {
      console.log(`Executing automation: ${automation.name} (${automation.action_type})`);
      
      try {
        switch (automation.action_type) {
          case 'send_whatsapp':
            await executeWhatsAppAction(supabase, dealFull, automation.action_config);
            results.push({ automation: automation.name, action: 'send_whatsapp', success: true });
            break;

          case 'create_task':
            await executeCreateTaskAction(supabase, dealFull, automation.action_config);
            results.push({ automation: automation.name, action: 'create_task', success: true });
            break;

          case 'add_tag':
            await executeAddTagAction(supabase, dealFull, automation.action_config);
            results.push({ automation: automation.name, action: 'add_tag', success: true });
            break;

          case 'send_email':
            await executeSendEmailAction(supabase, dealFull, automation.action_config);
            results.push({ automation: automation.name, action: 'send_email', success: true });
            break;

          default:
            console.warn(`Unknown action type: ${automation.action_type}`);
            results.push({ automation: automation.name, action: automation.action_type, success: false, error: 'Unknown action type' });
        }
      } catch (actionError) {
        console.error(`Error executing automation ${automation.name}:`, actionError);
        results.push({ 
          automation: automation.name, 
          action: automation.action_type, 
          success: false, 
          error: actionError instanceof Error ? actionError.message : 'Unknown error' 
        });
      }
    }

    console.log('Automation execution results:', results);

    return new Response(
      JSON.stringify({ success: true, executed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in execute-automation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to replace template variables
function replaceTemplateVars(template: string, deal: any): string {
  const contact = deal.contacts;
  const company = deal.companies;
  
  return template
    .replace(/\{\{deal_name\}\}/g, deal.name || '')
    .replace(/\{\{deal_value\}\}/g, deal.value ? `R$ ${Number(deal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '')
    .replace(/\{\{contact_name\}\}/g, contact ? `${contact.first_name} ${contact.last_name || ''}`.trim() : '')
    .replace(/\{\{contact_first_name\}\}/g, contact?.first_name || '')
    .replace(/\{\{contact_email\}\}/g, contact?.email || '')
    .replace(/\{\{company_name\}\}/g, company?.name || '')
    .replace(/\{\{nome\}\}/g, contact?.first_name || '')
    .replace(/\{\{empresa\}\}/g, company?.name || '');
}

async function executeWhatsAppAction(supabase: any, deal: any, config: Record<string, unknown>) {
  const contact = deal.contacts;
  if (!contact) throw new Error('Deal has no contact associated');

  const phone = contact.mobile || contact.phone;
  if (!phone) throw new Error('Contact has no phone number');

  const messageTemplate = config.message_template as string || 'Olá {{contact_name}}!';
  const message = replaceTemplateVars(messageTemplate, deal);

  const { data: instances, error: instanceError } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('status', 'connected')
    .limit(1);

  if (instanceError || !instances || instances.length === 0) {
    throw new Error('No connected WhatsApp instance found');
  }

  const instance = instances[0];
  const zapiUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/send-text`;
  
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  const response = await fetch(zapiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': Deno.env.get('ZAPI_CLIENT_TOKEN') || '',
    },
    body: JSON.stringify({ phone: formattedPhone, message }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error: ${errorText}`);
  }

  await supabase.from('whatsapp_messages').insert({
    phone: formattedPhone,
    content: message,
    direction: 'outbound',
    message_type: 'text',
    status: 'sent',
    contact_id: contact.id,
    company_id: deal.company_id,
    instance_id: instance.id,
  });

  console.log(`WhatsApp message sent to ${formattedPhone}`);
}

async function executeCreateTaskAction(supabase: any, deal: any, config: Record<string, unknown>) {
  const titleTemplate = config.title as string || 'Nova tarefa para {{deal_name}}';
  const title = replaceTemplateVars(titleTemplate, deal);
  const priority = config.priority as string || 'media';
  const dueDays = config.due_days as number || 1;
  const description = config.description ? replaceTemplateVars(config.description as string, deal) : null;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const { error } = await supabase.from('tasks').insert({
    title,
    description,
    priority,
    due_date: dueDate.toISOString(),
    deal_id: deal.id,
    contact_id: deal.contact_id,
    company_id: deal.company_id,
    status: 'pendente',
  });

  if (error) throw error;
  console.log(`Task created: ${title}`);
}

async function executeAddTagAction(supabase: any, deal: any, config: Record<string, unknown>) {
  const tag = config.tag as string;
  if (!tag) throw new Error('Tag not specified in config');

  const currentFields = deal.custom_fields || {};
  const currentTags = (currentFields.tags as string[]) || [];

  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    currentFields.tags = currentTags;

    const { error } = await supabase
      .from('deals')
      .update({ custom_fields: currentFields })
      .eq('id', deal.id);

    if (error) throw error;
    console.log(`Tag added: ${tag}`);
  } else {
    console.log(`Tag already exists: ${tag}`);
  }
}

async function executeSendEmailAction(supabase: any, deal: any, config: Record<string, unknown>) {
  const contact = deal.contacts;
  if (!contact?.email) throw new Error('Contact has no email address');

  const templateId = config.template_id as string;
  let subject: string;
  let body: string;

  if (templateId) {
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) throw new Error('Email template not found');

    subject = replaceTemplateVars(template.subject, deal);
    body = replaceTemplateVars(template.body, deal);
  } else {
    subject = config.subject as string || `Atualização: ${deal.name}`;
    body = config.body as string || `Olá ${contact.first_name}!`;
    subject = replaceTemplateVars(subject, deal);
    body = replaceTemplateVars(body, deal);
  }

  const { error } = await supabase.functions.invoke('send-email', {
    body: {
      to_email: contact.email,
      subject,
      body,
      contact_id: contact.id,
      deal_id: deal.id,
      template_id: templateId,
    },
  });

  if (error) throw error;
  console.log(`Email sent to ${contact.email}`);
}
