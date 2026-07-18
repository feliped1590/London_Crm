import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { envFlagEnabled, disabledIntegrationResponse } from "../_shared/integration-gates.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!envFlagEnabled("EMAIL_INTEGRATION_ENABLED", false)) {
    return disabledIntegrationResponse("Email/Resend", corsHeaders);
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch scheduled emails that are due
    const { data: scheduledEmails, error: fetchError } = await serviceClient
      .from('email_logs')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      console.log("No scheduled emails to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing ${scheduledEmails.length} scheduled emails`);

    let sent = 0;
    let failed = 0;

    for (const email of scheduledEmails) {
      try {
        const emailResponse = await resend.emails.send({
          from: "CRM <onboarding@resend.dev>",
          to: [email.to_email],
          subject: email.subject,
          html: email.body,
        });

        if (emailResponse.error) {
          console.error(`Failed to send scheduled email ${email.id}:`, emailResponse.error);
          
          await serviceClient
            .from('email_logs')
            .update({ 
              status: 'failed',
              metadata: { ...email.metadata, error: emailResponse.error.message }
            })
            .eq('id', email.id);
          
          failed++;
        } else {
          await serviceClient
            .from('email_logs')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString(),
              metadata: { ...email.metadata, resend_id: emailResponse.data?.id }
            })
            .eq('id', email.id);
          
          sent++;
        }
      } catch (emailError: any) {
        console.error(`Error processing scheduled email ${email.id}:`, emailError);
        
        await serviceClient
          .from('email_logs')
          .update({ 
            status: 'failed',
            metadata: { ...email.metadata, error: emailError.message }
          })
          .eq('id', email.id);
        
        failed++;
      }
    }

    console.log(`Processed scheduled emails: sent=${sent}, failed=${failed}`);

    return new Response(
      JSON.stringify({ success: true, processed: scheduledEmails.length, sent, failed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in process-scheduled-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
