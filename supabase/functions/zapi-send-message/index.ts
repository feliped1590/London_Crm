import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { envFlagEnabled, disabledIntegrationResponse } from '../_shared/integration-gates.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!envFlagEnabled('ZAPI_INTEGRATION_ENABLED', false)) {
    return disabledIntegrationResponse('Z-API', corsHeaders)
  }

  try {
    // Validate Authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { instanceId, phone, message, messageType = 'text' } = body

    if (!instanceId || !phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: instanceId, phone, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format phone number for Z-API (should be just numbers)
    const formattedPhone = phone.replace(/\D/g, '')

    // Send message via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/send-text`
    
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': Deno.env.get('ZAPI_CLIENT_TOKEN')!
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message
      })
    })

    const zapiResult = await zapiResponse.json()
    console.log('Z-API response:', zapiResult)

    if (!zapiResponse.ok) {
      throw new Error(zapiResult.error || 'Failed to send message via Z-API')
    }

    // Create phone variations to search (with and without 55 prefix)
    const phoneWithoutCountry = formattedPhone.startsWith('55') 
      ? formattedPhone.slice(2) 
      : formattedPhone
    const phoneWithCountry = formattedPhone.startsWith('55') 
      ? formattedPhone 
      : `55${formattedPhone}`
    
    // Get linked contact if exists - try multiple phone formats
    const { data: whatsappContact } = await supabase
      .from('whatsapp_contacts')
      .select('contact_id')
      .or(`phone_number.eq.${phoneWithCountry},phone_number.eq.${phoneWithoutCountry}`)
      .limit(1)
      .maybeSingle()

    let contactId = whatsappContact?.contact_id || null
    let companyId = null

    // If not found in whatsapp_contacts, search in CRM contacts table
    if (!contactId) {
      const { data: crmContact } = await supabase
        .from('contacts')
        .select('id, company_id')
        .or(`phone.eq.${phoneWithCountry},phone.eq.${phoneWithoutCountry},mobile.eq.${phoneWithCountry},mobile.eq.${phoneWithoutCountry}`)
        .limit(1)
        .maybeSingle()
      
      if (crmContact) {
        contactId = crmContact.id
        companyId = crmContact.company_id
      }
    } else if (contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('company_id')
        .eq('id', contactId)
        .single()
      
      companyId = contact?.company_id || null
    }

    // Save the outbound message
    const { data: savedMessage, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        instance_id: instanceId,
        contact_id: contactId,
        company_id: companyId,
        phone: formattedPhone,
        direction: 'outbound',
        message_type: messageType,
        content: message,
        status: 'sent',
        zapi_message_id: zapiResult.messageId || zapiResult.zapiMessageId,
        is_read: true
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving message:', saveError)
      // Don't fail the request, message was sent successfully
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: zapiResult.messageId || zapiResult.zapiMessageId,
        savedMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Send message error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
