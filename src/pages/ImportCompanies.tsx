import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Column mapping from XLSX headers to DB fields
const COLUMN_MAP: Record<string, string> = {
  'Razão Social': 'name',
  'Contato': 'contact_name',
  'Telefone': 'phone',
  'Fax': 'fax',
  'Endereço': 'address',
  'Bairro': 'neighborhood',
  'Cidade': 'city',
  'UF': 'state',
  'CEP': 'zip_code',
  'CNPJ/CPF': 'cnpj',
  'Inscrição Estadual': 'inscricao_estadual',
  'Nome Fantasia': 'fantasia',
  'Número': 'address_number',
  'Origem': 'origin',
};

interface ImportResult {
  total_received: number;
  to_insert: number;
  inserted: number;
  skipped: number;
  errors?: string[];
}

export default function ImportCompanies() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResults(null);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      // Map columns
      const mapped = jsonData.map((row) => {
        const mappedRow: Record<string, any> = {};
        for (const [xlsHeader, dbField] of Object.entries(COLUMN_MAP)) {
          // Try exact match first, then partial
          const key = Object.keys(row).find(
            (k) => k.trim() === xlsHeader || k.trim().toLowerCase().includes(xlsHeader.toLowerCase())
          );
          mappedRow[dbField] = key ? String(row[key] ?? '').trim() : '';
        }
        return mappedRow;
      }).filter((r) => r.name && r.cnpj);

      setParsedRows(mapped);
      setStep('preview');
      toast.success(`${mapped.length} registros encontrados no arquivo`);
    } catch (err) {
      toast.error('Erro ao ler o arquivo. Verifique se é um XLSX válido.');
      console.error(err);
    }
  }, []);

  const startImport = useCallback(async () => {
    if (parsedRows.length === 0) return;

    setImporting(true);
    setStep('importing');
    setProgress(0);

    const BATCH_SIZE = 200;
    const totalBatches = Math.ceil(parsedRows.length / BATCH_SIZE);
    let totalInserted = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = parsedRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      try {
        const { data, error } = await supabase.functions.invoke('import-companies-from-file', {
          body: { rows: batch },
        });

        if (error) {
          allErrors.push(`Lote ${i + 1}: ${error.message}`);
        } else if (data) {
          totalInserted += data.inserted || 0;
          totalSkipped += data.skipped || 0;
          if (data.errors) allErrors.push(...data.errors);
        }
      } catch (err: any) {
        allErrors.push(`Lote ${i + 1}: ${err.message}`);
      }

      setProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    setResults({
      total_received: parsedRows.length,
      to_insert: totalInserted + totalSkipped,
      inserted: totalInserted,
      skipped: totalSkipped,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });

    setImporting(false);
    setStep('done');
    toast.success(`Importação concluída: ${totalInserted} empresas inseridas`);
  }, [parsedRows]);

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setResults(null);
    setProgress(0);
    setStep('upload');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Empresas</h1>
        <p className="text-muted-foreground">Faça upload de um arquivo XLSX para importar empresas em lote</p>
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload do Arquivo
            </CardTitle>
            <CardDescription>
              Selecione um arquivo .xlsx com os dados das empresas. Colunas esperadas: Razão Social, CNPJ/CPF, Cidade, UF, etc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-border">
              <div className="flex flex-col items-center">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Clique para selecionar</span> ou arraste o arquivo
                </p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx até 20MB</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Prévia do Arquivo
            </CardTitle>
            <CardDescription>
              {file?.name} — {parsedRows.length} registros válidos encontrados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Razão Social</th>
                    <th className="px-3 py-2 text-left font-medium">CNPJ</th>
                    <th className="px-3 py-2 text-left font-medium">Cidade</th>
                    <th className="px-3 py-2 text-left font-medium">UF</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 truncate max-w-[200px]">{row.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{row.cnpj}</td>
                      <td className="px-3 py-1.5">{row.city}</td>
                      <td className="px-3 py-1.5">{row.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 20 && (
                <p className="text-center text-xs text-muted-foreground py-2">
                  ... e mais {parsedRows.length - 20} registros
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={startImport} className="gap-2">
                <Upload className="h-4 w-4" />
                Iniciar Importação ({parsedRows.length} registros)
              </Button>
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing Step */}
      {step === 'importing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Importando...
            </CardTitle>
            <CardDescription>
              Processando {parsedRows.length} registros em lotes de 200
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />
            <p className="text-sm text-muted-foreground text-center">{progress}% concluído</p>
          </CardContent>
        </Card>
      )}

      {/* Done Step */}
      {step === 'done' && results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{results.total_received}</p>
                <p className="text-xs text-muted-foreground">Total no arquivo</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <p className="text-2xl font-bold text-green-600">{results.inserted}</p>
                <p className="text-xs text-muted-foreground">Inseridos</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                <p className="text-2xl font-bold text-yellow-600">{results.skipped}</p>
                <p className="text-xs text-muted-foreground">Ignorados (duplicados)</p>
              </div>
              {results.errors && (
                <div className="text-center p-3 rounded-lg bg-destructive/10">
                  <p className="text-2xl font-bold text-destructive">{results.errors.length}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              )}
            </div>

            {results.errors && results.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 p-3">
                <p className="text-sm font-medium flex items-center gap-1 text-destructive mb-2">
                  <AlertCircle className="h-4 w-4" /> Erros encontrados:
                </p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {results.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={reset} variant="outline">
              Importar outro arquivo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
