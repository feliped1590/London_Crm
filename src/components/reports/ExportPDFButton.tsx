import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface ExportPDFButtonProps {
  containerId: string;
  title?: string;
  className?: string;
  /** HTML opcional inserido logo abaixo do título no cabeçalho do PDF (ex.: filtros aplicados). */
  headerExtraHtml?: string;
  /** Label customizado para o botão. */
  label?: string;
}

export function ExportPDFButton({ containerId, title = 'Relatório', className, headerExtraHtml, label }: ExportPDFButtonProps) {
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

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            ${styles}
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body {
              background: white !important;
              color: black !important;
              padding: 24px;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .print-header {
              text-align: center;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 2px solid #e5e7eb;
            }
            .print-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
            .print-header p { font-size: 0.875rem; color: #6b7280; margin: 4px 0 0; }
            /* Force visible colors for print */
            [class*="card"] { break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${title}</h1>
            <p>Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
          ${container.innerHTML}
          <script>
            window.onload = function() { window.print(); };
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

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className={className}
    >
      <Download className="mr-2 h-4 w-4" />
      Exportar PDF
    </Button>
  );
}
