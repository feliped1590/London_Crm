import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-channel-token, x-goog-resource-id, x-goog-resource-state, x-goog-resource-uri, x-goog-message-number',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Check if Google Calendar is configured
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.log('Google Calendar integration is not configured');
      return new Response(
        JSON.stringify({ configured: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // This is a push notification from Google Calendar
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    const resourceId = req.headers.get('x-goog-resource-id');
    const channelToken = req.headers.get('x-goog-channel-token'); // Contains user_id

    console.log('Received webhook:', { channelId, resourceState, resourceId, channelToken });

    // Sync notification - Google is confirming the watch was set up
    if (resourceState === 'sync') {
      console.log('Sync notification received, channel setup confirmed');
      return new Response(
        JSON.stringify({ success: true, message: 'Sync notification acknowledged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only process if we have valid channel info
    if (!channelId || !channelToken) {
      console.log('Missing channel info');
      return new Response(
        JSON.stringify({ error: 'Missing channel info' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get user connection by channel token (which should be user_id)
    const { data: connection, error: connError } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', channelToken)
      .eq('webhook_channel_id', channelId)
      .single();

    if (connError || !connection) {
      console.log('Connection not found for channel:', channelId);
      return new Response(
        JSON.stringify({ error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!connection.sync_enabled) {
      console.log('Sync disabled for user:', connection.user_id);
      return new Response(
        JSON.stringify({ message: 'Sync disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get valid access token
    async function getAccessToken(): Promise<string> {
      const now = new Date();
      const expiresAt = new Date(connection.token_expires_at);
      
      if (expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            refresh_token: connection.refresh_token_encrypted,
            grant_type: 'refresh_token',
          }),
        });

        const tokens = await tokenResponse.json();
        
        if (tokens.error) {
          throw new Error(`Token refresh failed: ${tokens.error}`);
        }

        await supabase
          .from('google_calendar_connections')
          .update({
            access_token_encrypted: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq('user_id', connection.user_id);

        return tokens.access_token;
      }

      return connection.access_token_encrypted;
    }

    // Process the change notification
    if (resourceState === 'exists' || resourceState === 'update') {
      console.log('Processing change notification for user:', connection.user_id);

      const accessToken = await getAccessToken();

      // Fetch recent changes using sync token or time-based query
      const now = new Date();
      const timeMin = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // Last 10 minutes

      const eventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events?timeMin=${timeMin}&updatedMin=${timeMin}&singleEvents=true&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!eventsResponse.ok) {
        const error = await eventsResponse.json();
        console.error('Failed to fetch events:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch events' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const eventsData = await eventsResponse.json();
      console.log('Fetched events:', eventsData.items?.length || 0);

      let processedCount = 0;

      for (const event of eventsData.items || []) {
        // Skip cancelled events for now
        if (event.status === 'cancelled') continue;

        // Check if event exists as task
        const { data: existingTask } = await supabase
          .from('tasks')
          .select('id, last_synced_at')
          .eq('google_event_id', event.id)
          .single();

        if (!existingTask) {
          // Create new task from Google event
          const startDate = event.start?.dateTime 
            ? event.start.dateTime.split('T')[0]
            : event.start?.date;
          const startTime = event.start?.dateTime
            ? event.start.dateTime.split('T')[1].substring(0, 5)
            : null;

          if (startDate) {
            const { error: insertError } = await supabase
              .from('tasks')
              .insert({
                title: event.summary || 'Evento do Google Calendar',
                description: event.description || null,
                due_date: startDate,
                due_time: startTime,
                assigned_to: connection.user_id,
                status: 'pending',
                google_event_id: event.id,
                calendar_source: 'google',
                last_synced_at: new Date().toISOString(),
              });

            if (!insertError) {
              processedCount++;
              console.log('Created task for event:', event.id);
            }
          }
        } else {
          // Update existing task if Google event is newer
          const eventUpdated = new Date(event.updated);
          const lastSynced = existingTask.last_synced_at ? new Date(existingTask.last_synced_at) : new Date(0);

          if (eventUpdated > lastSynced) {
            const startDate = event.start?.dateTime 
              ? event.start.dateTime.split('T')[0]
              : event.start?.date;
            const startTime = event.start?.dateTime
              ? event.start.dateTime.split('T')[1].substring(0, 5)
              : null;

            if (startDate) {
              await supabase
                .from('tasks')
                .update({
                  title: event.summary || 'Evento do Google Calendar',
                  description: event.description || null,
                  due_date: startDate,
                  due_time: startTime,
                  last_synced_at: new Date().toISOString(),
                })
                .eq('id', existingTask.id);

              processedCount++;
              console.log('Updated task for event:', event.id);
            }
          }
        }
      }

      // Update last sync timestamp
      await supabase
        .from('google_calendar_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', connection.user_id);

      return new Response(
        JSON.stringify({ success: true, processed: processedCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown resource state
    console.log('Unknown resource state:', resourceState);
    return new Response(
      JSON.stringify({ message: 'Unknown resource state' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in google-calendar-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
