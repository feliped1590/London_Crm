import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  contact_ids: string[];
  template_id?: string;
  subject?: string;
  body?: string;
  scheduled_for?: string;
  from_name?: string;
}

function replaceVariables(text: string, contact: any, company: any): string {
  if (!text) return text;
  
  return text
    .replace(/\{\{nome\}\}/gi, contact?.first_name || '')
    .replace(/\{\{sobrenome\}\}/gi, contact?.last_name || '')
    .replace(/\{\{empresa\}\}/gi, company?.name || '')
    .replace(/\{\{cargo\}\}/gi, contact?.job_title || '')
    .replace(/\{\{email\}\}/gi, contact?.email || '')
    .replace(/\{\{telefone\}\}/gi, contact?.phone || contact?.mobile || '');
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const requestData: BulkEmailRequest = await req.json();
    const { contact_ids, template_id, subject: customSubject, body: customBody, scheduled_for, from_name } = requestData;

    if (!contact_ids || contact_ids.length === 0) {
      throw new Error("contact_ids array is required");
    }

    let templateSubject = customSubject;
    let templateBody = customBody;

    // If template_id is provided, fetch the template
    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (templateError || !template) {
        throw new Error("Template not found");
      }

      templateSubject = customSubject || template.subject;
      templateBody = customBody || template.body;
    }

    if (!templateSubject || !templateBody) {
      throw new Error("Subject and body are required (either from template or custom)");
    }

    // Fetch all contacts with their companies
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*, companies(name)')
      .in('id', contact_ids);

    if (contactsError) {
      throw contactsError;
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let sent = 0;
    let failed = 0;
    let noEmail = 0;
    let scheduled = 0;
    const results: any[] = [];

    const isScheduled = !!scheduled_for;
    if (isScheduled) {
      const scheduledDate = new Date(scheduled_for!);
      if (scheduledDate <= new Date()) {
        throw new Error("Scheduled time must be in the future");
      }
    }

    for (const contact of contacts || []) {
      if (!contact.email) {
        noEmail++;
        results.push({ contact_id: contact.id, status: 'no_email' });
        continue;
      }

      const company = (contact as any).companies;
      const processedSubject = replaceVariables(templateSubject, contact, company);
      const processedBody = replaceVariables(templateBody, contact, company);

      try {
        if (isScheduled) {
          // Schedule the email
          const { error: insertError } = await serviceClient.from('email_logs').insert({
            to_email: contact.email,
            subject: processedSubject,
            body: processedBody,
            contact_id: contact.id,
            template_id,
            sent_by: user.id,
            status: 'scheduled',
            scheduled_for,
            sent_at: null,
          });

          if (insertError) {
            console.error(`Error scheduling email to ${contact.email}:`, insertError);
            failed++;
            results.push({ contact_id: contact.id, status: 'failed', error: insertError.message });
          } else {
            scheduled++;
            results.push({ contact_id: contact.id, status: 'scheduled' });
          }
        } else {
          // Send immediately
          const fromEmail = from_name ? `${from_name} <onboarding@resend.dev>` : "CRM <onboarding@resend.dev>";
          
          const emailResponse = await resend.emails.send({
            from: fromEmail,
            to: [contact.email],
            subject: processedSubject,
            html: processedBody,
          });

          const status = emailResponse.error ? 'failed' : 'sent';

          await serviceClient.from('email_logs').insert({
            to_email: contact.email,
            subject: processedSubject,
            body: processedBody,
            contact_id: contact.id,
            template_id,
            sent_by: user.id,
            status,
            sent_at: new Date().toISOString(),
            metadata: { resend_id: emailResponse.data?.id },
          });

          if (emailResponse.error) {
            failed++;
            results.push({ contact_id: contact.id, status: 'failed', error: emailResponse.error.message });
          } else {
            sent++;
            results.push({ contact_id: contact.id, status: 'sent', resend_id: emailResponse.data?.id });
          }
        }
      } catch (emailError: any) {
        console.error(`Error sending email to ${contact.email}:`, emailError);
        failed++;
        results.push({ contact_id: contact.id, status: 'failed', error: emailError.message });
      }
    }

    console.log(`Bulk email: sent=${sent}, scheduled=${scheduled}, failed=${failed}, noEmail=${noEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent, 
        scheduled,
        failed, 
        no_email: noEmail,
        total: contact_ids.length,
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
