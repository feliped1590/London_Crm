import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envFlagEnabled, disabledIntegrationResponse } from "../_shared/integration-gates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!envFlagEnabled('GOOGLE_CALENDAR_INTEGRATION_ENABLED', false)) {
    return disabledIntegrationResponse('Google Calendar', corsHeaders);
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Check if Google Calendar is configured
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ 
          error: 'Google Calendar integration is not configured',
          configured: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, taskId, eventData } = await req.json();

    // Get user's Google Calendar connection
    const { data: connection, error: connError } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'No Google Calendar connection found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!connection.sync_enabled) {
      return new Response(
        JSON.stringify({ error: 'Sync is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper function to get valid access token
    async function getAccessToken(): Promise<string> {
      const now = new Date();
      const expiresAt = new Date(connection.token_expires_at);
      
      // If token is expired or about to expire, refresh it
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

        // Update stored token
        await supabase
          .from('google_calendar_connections')
          .update({
            access_token_encrypted: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq('user_id', user!.id);

        return tokens.access_token;
      }

      return connection.access_token_encrypted;
    }

    // Helper function to log sync activity
    async function logSync(taskId: string | null, googleEventId: string | null, action: string, direction: string, status: string, errorMessage?: string, metadata?: Record<string, unknown>) {
      await supabase.from('google_calendar_sync_logs').insert({
        user_id: user!.id,
        task_id: taskId,
        google_event_id: googleEventId,
        action,
        direction,
        status,
        error_message: errorMessage,
        metadata,
      });
    }

    if (action === 'sync') {
      // Full bidirectional sync
      const accessToken = await getAccessToken();
      
      let syncedCount = 0;
      let errorCount = 0;

      // 1. Sync CRM tasks to Google Calendar
      const { data: tasksToSync } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .not('due_time', 'is', null) // Only tasks with time
        .or('calendar_source.is.null,calendar_source.eq.crm');

      for (const task of tasksToSync || []) {
        try {
          const eventBody = {
            summary: task.title,
            description: task.description || '',
            start: {
              dateTime: `${task.due_date}T${task.due_time}:00`,
              timeZone: 'America/Sao_Paulo',
            },
            end: {
              dateTime: `${task.due_date}T${task.due_time}:00`,
              timeZone: 'America/Sao_Paulo',
            },
          };

          let response;
          if (task.google_event_id) {
            // Update existing event
            response = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events/${task.google_event_id}`,
              {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventBody),
              }
            );
          } else {
            // Create new event
            response = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventBody),
              }
            );
          }

          if (response.ok) {
            const event = await response.json();
            
            // Update task with Google event ID
            await supabase
              .from('tasks')
              .update({
                google_event_id: event.id,
                calendar_source: 'crm',
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', task.id);

            await logSync(task.id, event.id, task.google_event_id ? 'update' : 'create', 'crm_to_google', 'success');
            syncedCount++;
          } else {
            const errorData = await response.json();
            await logSync(task.id, null, 'sync', 'crm_to_google', 'error', errorData.error?.message);
            errorCount++;
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          await logSync(task.id, null, 'sync', 'crm_to_google', 'error', errorMessage);
          errorCount++;
        }
      }

      // 2. Fetch events from Google Calendar and create tasks
      try {
        const now = new Date();
        const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Last 7 days
        const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Next 30 days

        const eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          
          for (const event of eventsData.items || []) {
            // Check if event already exists as a task
            const { data: existingTask } = await supabase
              .from('tasks')
              .select('id, last_synced_at')
              .eq('google_event_id', event.id)
              .single();

            if (!existingTask) {
              // Create new task from Google event
              const startDate = event.start.dateTime 
                ? event.start.dateTime.split('T')[0]
                : event.start.date;
              const startTime = event.start.dateTime
                ? event.start.dateTime.split('T')[1].substring(0, 5)
                : null;

              const { data: newTask, error: insertError } = await supabase
                .from('tasks')
                .insert({
                  title: event.summary || 'Evento do Google Calendar',
                  description: event.description || null,
                  due_date: startDate,
                  due_time: startTime,
                  assigned_to: user.id,
                  status: 'pending',
                  google_event_id: event.id,
                  calendar_source: 'google',
                  last_synced_at: new Date().toISOString(),
                })
                .select()
                .single();

              if (!insertError) {
                await logSync(newTask.id, event.id, 'create', 'google_to_crm', 'success');
                syncedCount++;
              }
            } else {
              // Check if Google event was updated after last sync
              const eventUpdated = new Date(event.updated);
              const lastSynced = existingTask.last_synced_at ? new Date(existingTask.last_synced_at) : new Date(0);

              if (eventUpdated > lastSynced) {
                // Update task from Google event
                const startDate = event.start.dateTime 
                  ? event.start.dateTime.split('T')[0]
                  : event.start.date;
                const startTime = event.start.dateTime
                  ? event.start.dateTime.split('T')[1].substring(0, 5)
                  : null;

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

                await logSync(existingTask.id, event.id, 'update', 'google_to_crm', 'success');
                syncedCount++;
              }
            }
          }
        }
      } catch (err: unknown) {
        console.error('Error fetching Google events:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        await logSync(null, null, 'fetch', 'google_to_crm', 'error', errorMessage);
        errorCount++;
      }

      // Update last sync timestamp
      await supabase
        .from('google_calendar_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: syncedCount, 
          errors: errorCount 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'push_task') {
      // Push a single task to Google Calendar
      if (!taskId) {
        return new Response(
          JSON.stringify({ error: 'Task ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        return new Response(
          JSON.stringify({ error: 'Task not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!task.due_time) {
        return new Response(
          JSON.stringify({ error: 'Task has no time defined, cannot sync to Google Calendar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const accessToken = await getAccessToken();
      
      const eventBody = {
        summary: task.title,
        description: task.description || '',
        start: {
          dateTime: `${task.due_date}T${task.due_time}:00`,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: `${task.due_date}T${task.due_time}:00`,
          timeZone: 'America/Sao_Paulo',
        },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventBody),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        await logSync(taskId, null, 'create', 'crm_to_google', 'error', error.error?.message);
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to create event' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const event = await response.json();

      await supabase
        .from('tasks')
        .update({
          google_event_id: event.id,
          calendar_source: 'crm',
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      await logSync(taskId, event.id, 'create', 'crm_to_google', 'success');

      return new Response(
        JSON.stringify({ success: true, eventId: event.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in google-calendar-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
