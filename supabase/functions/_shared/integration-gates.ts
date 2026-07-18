export function envFlagEnabled(name: string, defaultValue = false): boolean {
  const raw = Deno.env.get(name);
  if (raw == null || raw.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function disabledIntegrationResponse(
  integrationName: string,
  corsHeaders: Record<string, string>,
  status = 403,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: `${integrationName} integration is disabled for this environment.`,
      integration: integrationName,
      disabled: true,
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
