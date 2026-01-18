import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface Deal {
  id: string;
  name: string;
  value: number | null;
  contact_id: string | null;
  company_id: string | null;
  custom_fields: Record<string, unknown> | null;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { deal_id, trigger_type, trigger_stage }: AutomationRequest = await req.json();

    console.log(`Processing automation for deal ${deal_id}, trigger: ${trigger_type}, stage: ${trigger_stage}`);

    // Fetch active automations matching the trigger
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

    // Fetch deal details with contact and company
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*, contacts(id, first_name, last_name, email, mobile, phone), companies(id, name)')
      .eq('id', deal_id)
      .single();

    if (dealError) {
      console.error('Error fetching deal:', dealError);
      throw dealError;
    }

    const results: { automation: string; action: string; success: boolean; error?: string }[] = [];

    // Execute each automation
    for (const automation of automations as Automation[]) {
      console.log(`Executing automation: ${automation.name} (${automation.action_type})`);
      
      try {
        switch (automation.action_type) {
          case 'send_whatsapp':
            await executeWhatsAppAction(supabase, deal, automation.action_config);
            results.push({ automation: automation.name, action: 'send_whatsapp', success: true });
            break;

          case 'create_task':
            await executeCreateTaskAction(supabase, deal, automation.action_config);
            results.push({ automation: automation.name, action: 'create_task', success: true });
            break;

          case 'add_tag':
            await executeAddTagAction(supabase, deal, automation.action_config);
            results.push({ automation: automation.name, action: 'add_tag', success: true });
            break;

          case 'send_email':
            await executeSendEmailAction(supabase, deal, automation.action_config);
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
  if (!contact) {
    throw new Error('Deal has no contact associated');
  }

  const phone = contact.mobile || contact.phone;
  if (!phone) {
    throw new Error('Contact has no phone number');
  }

  const messageTemplate = config.message_template as string || 'Olá {{contact_name}}!';
  const message = replaceTemplateVars(messageTemplate, deal);

  // Get a connected WhatsApp instance
  const { data: instances, error: instanceError } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('status', 'connected')
    .limit(1);

  if (instanceError || !instances || instances.length === 0) {
    throw new Error('No connected WhatsApp instance found');
  }

  const instance = instances[0];

  // Send message via Z-API
  const zapiUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/send-text`;
  
  // Clean phone number
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  const response = await fetch(zapiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': Deno.env.get('ZAPI_CLIENT_TOKEN') || '',
    },
    body: JSON.stringify({
      phone: formattedPhone,
      message: message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error: ${errorText}`);
  }

  // Log the message
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

  if (error) {
    throw error;
  }

  console.log(`Task created: ${title}`);
}

async function executeAddTagAction(supabase: any, deal: any, config: Record<string, unknown>) {
  const tag = config.tag as string;
  if (!tag) {
    throw new Error('Tag not specified in config');
  }

  // Get current custom_fields
  const currentFields = deal.custom_fields || {};
  const currentTags = (currentFields.tags as string[]) || [];

  // Add tag if not already present
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    currentFields.tags = currentTags;

    const { error } = await supabase
      .from('deals')
      .update({ custom_fields: currentFields })
      .eq('id', deal.id);

    if (error) {
      throw error;
    }

    console.log(`Tag added: ${tag}`);
  } else {
    console.log(`Tag already exists: ${tag}`);
  }
}

async function executeSendEmailAction(supabase: any, deal: any, config: Record<string, unknown>) {
  const contact = deal.contacts;
  if (!contact?.email) {
    throw new Error('Contact has no email address');
  }

  const templateId = config.template_id as string;
  let subject: string;
  let body: string;

  if (templateId) {
    // Fetch email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new Error('Email template not found');
    }

    subject = replaceTemplateVars(template.subject, deal);
    body = replaceTemplateVars(template.body, deal);
  } else {
    subject = config.subject as string || `Atualização: ${deal.name}`;
    body = config.body as string || `Olá ${contact.first_name}!`;
    subject = replaceTemplateVars(subject, deal);
    body = replaceTemplateVars(body, deal);
  }

  // Call send-email function
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

  if (error) {
    throw error;
  }

  console.log(`Email sent to ${contact.email}`);
}
