import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExportPDFButtonProps {
  containerId: string;
  title?: string;
  className?: string;
  /** HTML opcional inserido logo abaixo do título no cabeçalho do PDF (ex.: filtros aplicados). */
  headerExtraHtml?: string;
  /** Label customizado para o botão. */
  label?: string;
  /** Desabilita o botão (ex.: enquanto blocos principais carregam). */
  disabled?: boolean;
  /** Mensagem exibida como tooltip quando desabilitado. */
  disabledReason?: string;
  /** HTML opcional de capa executiva, renderizada como primeira página antes do conteúdo. */
  coverHtml?: string;
  /** Texto curto exibido no rodapé fixo de todas as páginas. */
  footerLabel?: string;
}

export function ExportPDFButton({
  containerId,
  title = 'Relatório',
  className,
  headerExtraHtml,
  label,
  disabled,
  disabledReason,
  coverHtml,
  footerLabel = 'CRM · Central de BI',
}: ExportPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        toast.error('Conteúdo não encontrado para exportação');
        return;
      }

      // Detecta se o conteúdo já está dentro do escopo .bi-executive (relatórios compostos)
      const isExecutive =
        container.classList.contains('bi-executive') ||
        !!container.querySelector('.bi-executive');

      // Collect stylesheets from the current page
      const styles = Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join('\n');
          } catch {
            return '';
          }
        })
        .join('\n');

      const generatedAt = new Date().toLocaleString('pt-BR');

      // Estilos premium aplicados APENAS dentro de .bi-executive (não afeta relatórios clássicos)
      const executiveStyles = `
        .bi-executive { color: #0F172A; }
        .bi-executive h1, .bi-executive h2, .bi-executive h3, .bi-executive h4 { color: #0F172A; }
        .bi-executive .bi-section,
        .bi-executive .bi-kpi-card {
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 10px !important;
          box-shadow: none !important;
        }
        .bi-executive .bi-kpi-card { border-left-width: 3px !important; }
        .bi-executive table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .bi-executive thead th {
          background: #EFF4FB !important;
          color: #334155 !important;
          font-weight: 600;
          font-size: 9.5pt;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid #E2E8F0 !important;
          padding: 7px 8px;
          text-align: left;
        }
        .bi-executive tbody td {
          padding: 6px 8px;
          border-bottom: 1px solid #F1F5F9;
          color: #1F2937;
        }
        .bi-executive tbody tr:nth-child(even) td { background: #F8FAFC !important; }
        .bi-executive .recharts-cartesian-grid line { stroke: #CBD5E1 !important; }
        .bi-executive .recharts-text { fill: #64748B !important; }
      `;

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title>${title}</title>
<style>
${styles}
@page {
  margin: 16mm 14mm 18mm 14mm;
  @bottom-center {
    content: "${footerLabel.replace(/"/g, '\\"')} · ${generatedAt} · página " counter(page) " / " counter(pages);
    font-size: 9pt;
    color: #94A3B8;
    font-family: system-ui, -apple-system, sans-serif;
  }
}
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
body {
  background: ${isExecutive ? '#F8FAFC' : 'white'} !important;
  color: #111827 !important;
  padding: 0;
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 11pt;
  line-height: 1.45;
}
.print-root { padding: 8px 4px; }

/* ===== Capa executiva premium ===== */
.print-cover {
  min-height: 96vh;
  display: grid;
  grid-template-columns: 28% 1fr;
  page-break-after: always;
  break-after: page;
  border-radius: 0;
  overflow: hidden;
}
.print-cover-side {
  background: #0F172A;
  color: #ffffff;
  padding: 32px 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.print-cover-side .eyebrow {
  text-transform: uppercase; letter-spacing: 0.16em;
  font-size: 9pt; color: #93C5FD;
}
.print-cover-side .stripe-title {
  font-size: 18pt; font-weight: 700; line-height: 1.15; margin-top: 14px;
}
.print-cover-side .stripe-mark {
  font-size: 9pt; color: #CBD5E1; letter-spacing: 0.12em; text-transform: uppercase;
  border-top: 1px solid rgba(255,255,255,0.15);
  padding-top: 14px;
}
.print-cover-side .stripe-mono {
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px;
  border: 1.5px solid rgba(255,255,255,0.4);
  border-radius: 12px;
  font-size: 18pt; font-weight: 700; letter-spacing: 0.04em;
  color: #ffffff;
}
.print-cover-main {
  padding: 40px 36px;
  display: flex; flex-direction: column; justify-content: space-between;
  background: #FFFFFF;
}
.print-cover-logo-frame {
  display: inline-flex; align-items: center; justify-content: center;
  height: 64px; max-width: 220px;
  padding: 8px 12px;
  border: 1px solid #E2E8F0; border-radius: 10px;
  background: #FFFFFF;
}
.print-cover-logo { max-height: 48px; max-width: 200px; object-fit: contain; }
.print-cover-title {
  font-size: 30pt; font-weight: 700; line-height: 1.1; margin: 24px 0 10px;
  color: #0F172A;
}
.print-cover-subtitle { font-size: 13pt; color: #475569; margin: 0 0 24px; }
.print-cover-meta {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.print-cover-meta .row {
  border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 2px; background: #F8FAFC;
}
.print-cover-meta .label {
  font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; font-weight: 600;
}
.print-cover-meta .value { font-size: 11pt; color: #0F172A; font-weight: 600; }
.print-cover-bottom { font-size: 9pt; color: #94A3B8; margin-top: 20px; border-top: 1px solid #E2E8F0; padding-top: 10px; }

/* ===== Cabeçalho a partir da página 2 (compacto) ===== */
.print-header {
  text-align: left;
  margin-bottom: 18px;
  padding-bottom: 10px;
  border-bottom: 2px solid #0F172A;
}
.print-header h2 { font-size: 14pt; font-weight: 700; margin: 0; color: #0F172A; }
.print-header .meta-inline {
  margin-top: 6px; font-size: 9pt; color: #64748B;
  display: flex; flex-wrap: wrap; gap: 4px 14px;
}
.print-header .meta-inline strong { color: #0F172A; font-weight: 600; }

/* ===== Layout do conteúdo executivo ===== */
.print-content { padding: 0 4px; }
.print-content > * + * { margin-top: 14px; }

/* Esconde controles internos durante a impressão */
[data-export-hide="true"] { display: none !important; }

${executiveStyles}

/* Quebras de página */
[class*="card"],
.bi-section,
.bi-kpi-card,
.recharts-wrapper,
.recharts-responsive-container,
table,
thead, tr,
[data-export-block="true"] {
  break-inside: avoid;
  page-break-inside: avoid;
}
h1, h2, h3, h4 {
  break-after: avoid;
  page-break-after: avoid;
}
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
p, li { orphans: 3; widows: 3; }
</style>
</head>
<body>
  <div class="print-root ${isExecutive ? 'bi-executive' : ''}">
    ${coverHtml ? `<section class="print-cover">${coverHtml}</section>` : ''}
    <div class="print-header">
      <h2>${title}</h2>
      ${headerExtraHtml ? `<div class="meta-inline">${headerExtraHtml}</div>` : ''}
    </div>
    <div class="print-content">${container.innerHTML}</div>
  </div>
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 400); };
  </script>
</body>
</html>`;

      // Usa Blob URL com charset explícito UTF-8 — garante renderização correta de
      // acentos, ç, ã, º, ª etc. Evita o problema de encoding visto em document.write().
      const blob = new Blob(['\ufeff', html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        URL.revokeObjectURL(url);
        toast.error('Pop-up bloqueado. Permita pop-ups para exportar.');
        return;
      }
      // Libera memória após a janela ter tido tempo de carregar.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      toast.success('PDF pronto! Use Ctrl+P / Cmd+P para salvar.');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erro ao exportar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = isExporting || !!disabled;

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isDisabled}
      className={className}
    >
      <Download className="mr-2 h-4 w-4" />
      {label ?? 'Exportar PDF'}
    </Button>
  );

  if (isDisabled && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          {/* span wrapper para permitir tooltip em botão desabilitado */}
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex">{button}</span>
          </TooltipTrigger>
          <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
