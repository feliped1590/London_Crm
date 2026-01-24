import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, client-token',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Log all headers for debugging
    console.log('Webhook called - All headers:', JSON.stringify(Object.fromEntries(req.headers.entries())))
    
    // Try to get token from multiple sources (Z-API sends it in z-api-token header)
    const url = new URL(req.url)
    const clientToken = req.headers.get('z-api-token')
      || req.headers.get('Z-Api-Token')
      || req.headers.get('client-token') 
      || req.headers.get('Client-Token')
      || req.headers.get('x-client-token')
      || req.headers.get('X-Client-Token')
      || url.searchParams.get('token')
      || url.searchParams.get('client-token')
    
    // Get token from environment - no fallback for security
    const expectedToken = Deno.env.get('ZAPI_CLIENT_TOKEN')
    
    if (!expectedToken) {
      console.error('ZAPI_CLIENT_TOKEN not configured - webhook authentication disabled')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Token received:', clientToken ? `${clientToken.substring(0, 5)}...` : 'null')
    console.log('Token expected:', expectedToken ? `${expectedToken.substring(0, 5)}...` : 'null')

    // Case-insensitive comparison for token validation
    if (!clientToken || clientToken.toLowerCase() !== expectedToken.toLowerCase()) {
      console.error('Invalid client token - received:', clientToken, 'expected:', expectedToken)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Token validated successfully')

    const body = await req.json()
    console.log('Received webhook payload:', JSON.stringify(body))
    console.log('Payload keys:', Object.keys(body).join(', '))

    // Initialize Supabase client with service role for webhook processing
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Z-API can send different payload structures depending on the event type
    // Common fields: instanceId, phone, isFromMe, messageId, text, image, etc.
    // Also check for alternative field names used by Z-API
    const instanceId = body.instanceId || body.instance_id || body.zapiInstanceId
    const phone = body.phone || body.from || body.chatId || body.sender
    const isFromMe = body.isFromMe ?? body.fromMe ?? false
    const messageId = body.messageId || body.id || body.msgId
    
    console.log('Extracted fields - instanceId:', instanceId, 'phone:', phone, 'isFromMe:', isFromMe, 'messageId:', messageId)

    // Destructure message content fields
    const { text, image, document, audio, video, sticker } = body

    if (!instanceId || !phone) {
      console.log('Missing required fields after extraction - instanceId:', instanceId, 'phone:', phone)
      console.log('Available top-level keys:', Object.keys(body).join(', '))
      return new Response(
        JSON.stringify({ success: true, message: 'Skipped - missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the instance in our database
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('instance_id', instanceId)
      .single()

    if (instanceError || !instance) {
      console.log('Instance not found:', instanceId)
      return new Response(
        JSON.stringify({ success: true, message: 'Instance not registered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone number (remove @c.us or @g.us suffix)
    const normalizedPhone = phone.replace(/@c\.us|@g\.us/g, '')

    // Determine message type and content
    let messageType = 'text'
    let content = ''
    let mediaUrl = null

    if (text?.message) {
      messageType = 'text'
      content = text.message
    } else if (image) {
      messageType = 'image'
      content = image.caption || ''
      mediaUrl = image.imageUrl || image.thumbnailUrl
    } else if (document) {
      messageType = 'document'
      content = document.fileName || ''
      mediaUrl = document.documentUrl
    } else if (audio) {
      messageType = 'audio'
      mediaUrl = audio.audioUrl
    } else if (video) {
      messageType = 'video'
      content = video.caption || ''
      mediaUrl = video.videoUrl
    } else if (sticker) {
      messageType = 'sticker'
      mediaUrl = sticker.stickerUrl
    }

    // Create phone variations to search (with and without 55 prefix)
    const phoneWithoutCountry = normalizedPhone.startsWith('55') 
      ? normalizedPhone.slice(2) 
      : normalizedPhone
    const phoneWithCountry = normalizedPhone.startsWith('55') 
      ? normalizedPhone 
      : `55${normalizedPhone}`

    // Check if we have a contact linked to this phone number - try multiple formats
    const { data: whatsappContact } = await supabase
      .from('whatsapp_contacts')
      .select('contact_id')
      .or(`phone_number.eq.${phoneWithCountry},phone_number.eq.${phoneWithoutCountry}`)
      .limit(1)
      .maybeSingle()

    // Also check the contacts table for phone/mobile match
    let contactId = whatsappContact?.contact_id || null
    let companyId = null

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

        // Create the link in whatsapp_contacts
        await supabase
          .from('whatsapp_contacts')
          .upsert({
            contact_id: contactId,
            phone_number: normalizedPhone,
            profile_name: body.senderName || null
          }, { onConflict: 'phone_number' })
      }
    }

    // Insert the message
    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        instance_id: instance.id,
        contact_id: contactId,
        company_id: companyId,
        phone: normalizedPhone,
        direction: isFromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        content: content,
        media_url: mediaUrl,
        status: 'received',
        zapi_message_id: messageId,
        is_read: isFromMe // Messages sent by us are considered read
      })

    if (insertError) {
      console.error('Error inserting message:', insertError)
      throw insertError
    }

    // If it's a new contact (no existing link), create a whatsapp_contact entry
    if (!whatsappContact && !contactId) {
      await supabase
        .from('whatsapp_contacts')
        .upsert({
          phone_number: normalizedPhone,
          profile_name: body.senderName || null,
          profile_picture_url: body.senderPhoto || null
        }, { onConflict: 'phone_number' })
    }

    console.log('Message processed successfully')
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
