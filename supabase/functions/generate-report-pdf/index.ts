import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =========================================================================
    // 1. AUTENTICAÇÃO — validar usuário real via getUser()
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // 2. INPUT VALIDATION — validar widgets
    // =========================================================================
    const body = await req.json();
    const { widgets, data, title, format } = body;

    if (!Array.isArray(widgets) || widgets.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid widgets: must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (widgets.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Too many widgets: maximum is 50' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (title && typeof title !== 'string') {
      return new Response(
        JSON.stringify({ error: 'title must be a string' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar payload total (evitar payloads excessivos > 5MB)
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Payload too large' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // 3. LÓGICA DE NEGÓCIO (mantida integralmente)
    // =========================================================================
    console.log("Generating report PDF", { widgetCount: widgets?.length, format, title });

    const now = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const generateWidgetHTML = (widget: any, widgetData: any) => {
      const chartType = widget.chartType;
      
      if (chartType === "number") {
        return `
          <div class="widget-number">
            <div class="value">${widgetData.value || "-"}</div>
            <div class="subtitle">${widgetData.subtitle || ""}</div>
          </div>
        `;
      }

      if (widgetData.chartData && widgetData.chartData.length > 0) {
        if (format === "list") {
          return `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                ${widgetData.chartData
                  .map(
                    (item: any) => `
                    <tr>
                      <td>${item.name}</td>
                      <td>${item.value}</td>
                    </tr>
                  `
                  )
                  .join("")}
              </tbody>
            </table>
          `;
        }

        const maxValue = Math.max(...widgetData.chartData.map((d: any) => d.value));
        const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

        if (chartType === "bar") {
          const barHeight = 25;
          const svgHeight = widgetData.chartData.length * (barHeight + 10) + 20;
          return `
            <svg viewBox="0 0 400 ${svgHeight}" class="chart-svg">
              ${widgetData.chartData
                .map((item: any, i: number) => {
                  const width = maxValue > 0 ? (item.value / maxValue) * 300 : 0;
                  const y = i * (barHeight + 10) + 10;
                  return `
                    <text x="0" y="${y + 17}" class="bar-label">${item.name.substring(0, 15)}</text>
                    <rect x="100" y="${y}" width="${width}" height="${barHeight}" fill="${colors[i % colors.length]}" rx="3"/>
                    <text x="${105 + width}" y="${y + 17}" class="bar-value">${item.value}</text>
                  `;
                })
                .join("")}
            </svg>
          `;
        }

        if (chartType === "pie") {
          const total = widgetData.chartData.reduce((sum: number, d: any) => sum + d.value, 0);
          let currentAngle = 0;
          const radius = 80;
          const cx = 100;
          const cy = 100;

          const slices = widgetData.chartData.map((item: any, i: number) => {
            const percentage = total > 0 ? item.value / total : 0;
            const angle = percentage * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (endAngle - 90) * (Math.PI / 180);

            const x1 = cx + radius * Math.cos(startRad);
            const y1 = cy + radius * Math.sin(startRad);
            const x2 = cx + radius * Math.cos(endRad);
            const y2 = cy + radius * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;

            return `<path d="M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z" fill="${colors[i % colors.length]}"/>`;
          });

          return `
            <div class="pie-container">
              <svg viewBox="0 0 200 200" class="pie-svg">
                ${slices.join("")}
              </svg>
              <div class="pie-legend">
                ${widgetData.chartData
                  .map(
                    (item: any, i: number) => `
                    <div class="legend-item">
                      <span class="legend-color" style="background: ${colors[i % colors.length]}"></span>
                      <span>${item.name}: ${item.value}</span>
                    </div>
                  `
                  )
                  .join("")}
              </div>
            </div>
          `;
        }

        return `
          <table class="data-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${widgetData.chartData
                .map(
                  (item: any) => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.value}</td>
                  </tr>
                `
                )
                .join("")}
            </tbody>
          </table>
        `;
      }

      return `<div class="no-data">Sem dados</div>`;
    };

    const widgetSize = (size: string) => {
      switch (size) {
        case "sm": return "widget-sm";
        case "md": return "widget-md";
        case "lg": return "widget-lg";
        case "xl": return "widget-xl";
        default: return "widget-sm";
      }
    };

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title || "Relatório"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1f2937; background: white; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .header h1 { font-size: 24px; color: #111827; }
    .header .date { color: #6b7280; font-size: 14px; }
    .widgets-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .widget { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; break-inside: avoid; }
    .widget-sm { grid-column: span 1; }
    .widget-md { grid-column: span 2; }
    .widget-lg { grid-column: span 3; }
    .widget-xl { grid-column: span 4; }
    .widget-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f3f4f6; }
    .widget-number { text-align: center; padding: 20px 0; }
    .widget-number .value { font-size: 32px; font-weight: 700; color: #111827; }
    .widget-number .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .data-table th, .data-table td { padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .data-table th { background: #f9fafb; font-weight: 600; }
    .chart-svg { width: 100%; height: auto; }
    .bar-label { font-size: 11px; fill: #374151; }
    .bar-value { font-size: 11px; fill: #6b7280; }
    .pie-container { display: flex; align-items: center; gap: 20px; }
    .pie-svg { width: 120px; height: 120px; }
    .pie-legend { flex: 1; }
    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
    .legend-color { width: 12px; height: 12px; border-radius: 2px; }
    .no-data { color: #9ca3af; text-align: center; padding: 20px; }
    @media print { body { padding: 20px; } .widget { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title || "Relatório do Dashboard"}</h1>
    <div class="date">Gerado em: ${now}</div>
  </div>
  <div class="widgets-grid">
    ${widgets
      .map((widget: any) => {
        const widgetData = data[widget.id] || {};
        return `
          <div class="widget ${widgetSize(widget.size)}">
            <div class="widget-title">${widget.title}</div>
            ${generateWidgetHTML(widget, widgetData)}
          </div>
        `;
      })
      .join("")}
  </div>
</body>
</html>
    `;

    return new Response(
      JSON.stringify({ html }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("generate-report-pdf failed", { code: (error as any)?.code });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
