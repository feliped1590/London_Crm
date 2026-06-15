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

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Pop-up bloqueado. Permita pop-ups para exportar.');
        return;
      }

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

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            ${styles}
            @page {
              margin: 16mm 14mm 18mm 14mm;
              @bottom-center {
                content: "${footerLabel.replace(/"/g, '\\"')} · ${generatedAt} · página " counter(page) " / " counter(pages);
                font-size: 9pt;
                color: #9ca3af;
                font-family: system-ui, -apple-system, sans-serif;
              }
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body {
              background: white !important;
              color: #111827 !important;
              padding: 0;
              margin: 0;
              font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
              font-size: 11pt;
              line-height: 1.45;
            }
            .print-root { padding: 8px 4px; }

            /* ===== Capa executiva ===== */
            .print-cover {
              min-height: 92vh;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 24px 8px;
              page-break-after: always;
              break-after: page;
            }
            .print-cover-top { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
            .print-cover-brand { display: flex; align-items: center; gap: 14px; }
            .print-cover-logo {
              max-height: 56px; max-width: 200px; object-fit: contain;
            }
            .print-cover-source {
              font-size: 10pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em;
            }
            .print-cover-main { padding: 40px 0; }
            .print-cover-eyebrow {
              text-transform: uppercase; letter-spacing: 0.14em; color: #6b7280;
              font-size: 10pt; margin-bottom: 12px;
            }
            .print-cover-title {
              font-size: 32pt; font-weight: 700; line-height: 1.1; margin: 0 0 16px;
              color: #0f172a;
            }
            .print-cover-subtitle { font-size: 14pt; color: #334155; margin: 0 0 28px; }
            .print-cover-meta {
              display: grid; grid-template-columns: 1fr 1fr; gap: 10px 32px;
              border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;
              padding: 16px 0;
            }
            .print-cover-meta .row { display: flex; flex-direction: column; gap: 2px; }
            .print-cover-meta .label { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
            .print-cover-meta .value { font-size: 11pt; color: #111827; font-weight: 500; }
            .print-cover-bottom { font-size: 9pt; color: #9ca3af; }

            /* ===== Cabeçalho a partir da página 2 (compacto) ===== */
            .print-header {
              text-align: left;
              margin-bottom: 18px;
              padding-bottom: 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .print-header h2 { font-size: 14pt; font-weight: 600; margin: 0; color: #0f172a; }
            .print-header .meta-inline {
              margin-top: 6px; font-size: 9pt; color: #6b7280;
              display: flex; flex-wrap: wrap; gap: 4px 14px;
            }
            .print-header .meta-inline strong { color: #374151; font-weight: 600; }

            /* ===== Layout do conteúdo executivo ===== */
            .print-content { padding: 0 4px; }
            .print-content > * + * { margin-top: 14px; }

            /* Cards e seções */
            [class*="card"] {
              border: 1px solid #e5e7eb !important;
              background: #ffffff !important;
              box-shadow: none !important;
              border-radius: 8px !important;
            }
            [class*="card"] h3 { font-size: 11.5pt; font-weight: 600; color: #0f172a; }

            /* Tabelas / rankings */
            table { width: 100%; border-collapse: collapse; font-size: 10pt; }
            thead th {
              background: #f8fafc !important;
              color: #334155 !important;
              font-weight: 600;
              border-bottom: 1px solid #e5e7eb !important;
              padding: 6px 8px;
              text-align: left;
            }
            tbody td {
              padding: 6px 8px;
              border-bottom: 1px solid #f1f5f9;
              color: #1f2937;
            }
            tbody tr:nth-child(even) td { background: #fafafa !important; }

            /* KPIs grid: força contraste limpo */
            .recharts-wrapper text { fill: #334155 !important; }

            /* Quebras de página */
            [data-export-hide="true"] { display: none !important; }
            [class*="card"],
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
          </style>
        </head>
        <body>
          <div class="print-root">
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
        </html>
      `;


      printWindow.document.write(html);
      printWindow.document.close();
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
