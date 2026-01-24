import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, client-token',
}

// Generate all phone variations for matching (with/without 55, with/without 9th digit)
function generatePhoneVariations(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variations = new Set<string>();
  
  // Base: with and without 55 prefix
  const without55 = digits.startsWith('55') ? digits.slice(2) : digits;
  const with55 = digits.startsWith('55') ? digits : `55${digits}`;
  
  variations.add(without55);
  variations.add(with55);
  
  // Handle 9th digit (position 2 after DDD for mobile numbers)
  if (without55.length === 11) {
    // Has 11 digits (DDD + 9 + 8 digits), try removing the 9
    const without9 = without55.slice(0, 2) + without55.slice(3);
    variations.add(without9);
    variations.add(`55${without9}`);
  } else if (without55.length === 10) {
    // Has 10 digits (DDD + 8 digits), try adding the 9
    const with9 = without55.slice(0, 2) + '9' + without55.slice(2);
    variations.add(with9);
    variations.add(`55${with9}`);
  }
  
  return Array.from(variations);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Log all headers for debugging
    console.log('Webhook called - All headers:', JSON.stringify(Object.fromEntries(req.headers.entries())))
    
    // Initialize Supabase client with service role for webhook processing
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Z-API sends the Instance Token in the z-api-token header
    // We validate against tokens registered in our database (whatsapp_instances.instance_token)
    const instanceToken = req.headers.get('z-api-token')
      || req.headers.get('Z-Api-Token')
      || req.headers.get('client-token') 
      || req.headers.get('Client-Token')
    
    console.log('Token received:', instanceToken ? `${instanceToken.substring(0, 8)}...` : 'null')

    if (!instanceToken) {
      console.error('No token provided in request headers')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate token against registered instances in database
    const { data: instanceByToken, error: tokenLookupError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_id, name')
      .eq('instance_token', instanceToken)
      .maybeSingle()

    if (tokenLookupError) {
      console.error('Error looking up instance token:', tokenLookupError)
      return new Response(
        JSON.stringify({ error: 'Server error during authentication' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!instanceByToken) {
      console.error('Token not found in registered instances:', instanceToken.substring(0, 8) + '...')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Token not registered' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Token validated successfully for instance:', instanceByToken.name, '(', instanceByToken.instance_id, ')')

    const body = await req.json()
    console.log('Received webhook payload:', JSON.stringify(body))
    console.log('Payload keys:', Object.keys(body).join(', '))

    // Z-API can send different payload structures depending on the event type
    // Common fields: instanceId, phone, isFromMe, messageId, text, image, etc.
    const instanceIdFromPayload = body.instanceId || body.instance_id || body.zapiInstanceId
    const phone = body.phone || body.from || body.chatId || body.sender
    const isFromMe = body.isFromMe ?? body.fromMe ?? false
    const messageId = body.messageId || body.id || body.msgId
    
    console.log('Extracted fields - instanceId from payload:', instanceIdFromPayload, 'phone:', phone, 'isFromMe:', isFromMe, 'messageId:', messageId)

    // Use the instance we found via token validation
    const instance = instanceByToken

    if (!phone) {
      console.log('Missing phone field - available keys:', Object.keys(body).join(', '))
      return new Response(
        JSON.stringify({ success: true, message: 'Skipped - missing phone field' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Destructure message content fields
    const { text, image, document, audio, video, sticker } = body

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

    // Generate all phone variations for better matching
    const phoneVariations = generatePhoneVariations(normalizedPhone)
    console.log('Phone variations for matching:', phoneVariations)

    // Check if we have a contact linked to this phone number - try multiple formats
    const phoneOrConditions = phoneVariations.map(v => `phone_number.eq.${v}`).join(',')
    const { data: whatsappContact } = await supabase
      .from('whatsapp_contacts')
      .select('contact_id')
      .or(phoneOrConditions)
      .limit(1)
      .maybeSingle()

    // Also check the contacts table for phone/mobile match
    let contactId = whatsappContact?.contact_id || null
    let companyId = null

    if (!contactId) {
      // Build OR conditions for all variations
      const contactOrConditions = phoneVariations.flatMap(v => [
        `phone.eq.${v}`,
        `mobile.eq.${v}`
      ]).join(',')
      
      const { data: crmContact } = await supabase
        .from('contacts')
        .select('id, company_id')
        .or(contactOrConditions)
        .limit(1)
        .maybeSingle()

      if (crmContact) {
        contactId = crmContact.id
        companyId = crmContact.company_id
        console.log('Found CRM contact:', contactId, 'company:', companyId)

        // Create the link in whatsapp_contacts
        await supabase
          .from('whatsapp_contacts')
          .upsert({
            contact_id: contactId,
            phone_number: normalizedPhone,
            profile_name: body.senderName || null
          }, { onConflict: 'phone_number' })
      } else {
        console.log('No CRM contact found for phone variations:', phoneVariations)
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
