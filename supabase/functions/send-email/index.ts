import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to_email: string;
  subject: string;
  body: string;
  contact_id?: string;
  deal_id?: string;
  template_id?: string;
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

    const requestData: SendEmailRequest = await req.json();
    const { to_email, subject, body, contact_id, deal_id, template_id, scheduled_for, from_name } = requestData;

    if (!to_email || !subject || !body) {
      throw new Error("to_email, subject, and body are required");
    }

    let contact = null;
    let company = null;

    if (contact_id) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('*, companies(name)')
        .eq('id', contact_id)
        .single();
      
      if (contactData) {
        contact = contactData;
        company = (contactData as any).companies;
      }
    }

    const processedSubject = replaceVariables(subject, contact, company);
    const processedBody = replaceVariables(body, contact, company);

    // If scheduled_for is set, save as scheduled and return
    if (scheduled_for) {
      const scheduledDate = new Date(scheduled_for);
      const now = new Date();
      // Allow 1 minute buffer for processing time and timezone differences
      const bufferMs = 60 * 1000;
      if (scheduledDate.getTime() <= now.getTime() - bufferMs) {
        throw new Error("Scheduled time must be in the future");
      }

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { error: insertError } = await serviceClient.from('email_logs').insert({
        to_email,
        subject: processedSubject,
        body: processedBody,
        contact_id,
        deal_id,
        template_id,
        sent_by: user.id,
        status: 'scheduled',
        scheduled_for,
        sent_at: null,
      });

      if (insertError) {
        console.error("Error scheduling email:", insertError);
        throw insertError;
      }

      console.log(`Email scheduled for ${scheduled_for} to ${to_email}`);

      return new Response(
        JSON.stringify({ success: true, status: 'scheduled', scheduled_for }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email immediately
    const fromEmail = from_name ? `${from_name} <onboarding@resend.dev>` : "CRM <onboarding@resend.dev>";
    
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [to_email],
      subject: processedSubject,
      html: processedBody,
    });

    console.log("Email sent:", emailResponse);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const status = emailResponse.error ? 'failed' : 'sent';
    
    const { error: logError } = await serviceClient.from('email_logs').insert({
      to_email,
      subject: processedSubject,
      body: processedBody,
      contact_id,
      deal_id,
      template_id,
      sent_by: user.id,
      status,
      sent_at: new Date().toISOString(),
      metadata: { resend_id: emailResponse.data?.id },
    });

    if (logError) {
      console.error("Error logging email:", logError);
    }

    if (emailResponse.error) {
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, status: 'sent', resend_id: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
