import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Normaliza cabeçalho: remove acentos, lowercase, remove não-alfanuméricos
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]/gi, '')
    .trim();
}

// Dicionário inteligente: chave normalizada → campo do banco
const FIELD_MAP: Record<string, string> = {
  razaosocial: 'name',
  contato: 'contact_name',
  telefone: 'phone',
  telefone1: 'phone',
  telefone2: 'phone2',
  fax: 'fax',
  email: 'email',
  rua: 'address',
  endereco: 'address',
  bairro: 'neighborhood',
  municipio: 'city',
  cidade: 'city',
  uf: 'state',
  estado: 'state',
  cep: 'zip_code',
  cnpjcpf: 'cnpj',
  cnpj: 'cnpj',
  inscricaoestadual: 'inscricao_estadual',
  nomefantasia: 'fantasia',
  fantasia: 'fantasia',
  numero: 'address_number',
  origem: 'origin',
  tipodecorrentista: 'origin',
  ramo: 'industry',
  ramoatividade: 'industry',
  segmento: 'industry',
  vendedor: 'vendedor_nome', // resolvido para owner_id na edge function
  aberturacnpj: 'abertura_cnpj', // campo informativo, não salvo no DB por padrão
};

interface ImportResult {
  total_received: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors?: string[];
  import_log_id?: string;
}

export default function ImportCompanies() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ row: number; message: string }[]>([]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResults(null);
    setUnmappedHeaders([]);
    setValidationErrors([]);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (jsonData.length === 0) {
        toast.error('Arquivo vazio ou sem dados válidos.');
        return;
      }

      // Detectar cabeçalhos não mapeados
      const originalHeaders = Object.keys(jsonData[0]);
      const unmapped: string[] = [];
      const headerToDbField: Record<string, string> = {};

      for (const header of originalHeaders) {
        const normalized = normalizeHeader(header);
        const dbField = FIELD_MAP[normalized];
        if (dbField) {
          headerToDbField[header] = dbField;
        } else {
          unmapped.push(header);
        }
      }
      setUnmappedHeaders(unmapped);

      // Mapear dados usando dicionário inteligente
      const errors: { row: number; message: string }[] = [];
      const mapped = jsonData.map((row, index) => {
        const mappedRow: Record<string, any> = {};
        for (const [originalHeader, dbField] of Object.entries(headerToDbField)) {
          if (dbField === 'abertura_cnpj') continue; // campo informativo, não salvar
          const val = row[originalHeader];
          mappedRow[dbField] = val != null ? String(val).trim() : '';
        }

        // Validação de campos obrigatórios
        if (!mappedRow.cnpj && !mappedRow.name) {
          errors.push({ row: index + 2, message: 'CNPJ e Nome ausentes' });
        } else if (!mappedRow.cnpj) {
          errors.push({ row: index + 2, message: 'CNPJ ausente' });
        } else if (!mappedRow.name) {
          errors.push({ row: index + 2, message: 'Nome (Razão Social) ausente' });
        }

        return mappedRow;
      }).filter((r) => r.name && r.cnpj);

      setValidationErrors(errors);
      setParsedRows(mapped);
      setStep('preview');

      const msg = `${mapped.length} registros válidos encontrados`;
      if (errors.length > 0) {
        toast.warning(`${msg}. ${errors.length} linhas ignoradas por falta de dados obrigatórios.`);
      } else {
        toast.success(msg);
      }
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
    let totalUpdated = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = parsedRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      try {
        const { data, error } = await supabase.functions.invoke('import-companies-from-file', {
          body: {
            rows: batch,
            file_name: file?.name || 'unknown',
            batch_index: i,
            total_batches: totalBatches,
          },
        });

        if (error) {
          allErrors.push(`Lote ${i + 1}: ${error.message}`);
        } else if (data) {
          totalInserted += data.inserted || 0;
          totalUpdated += data.updated || 0;
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
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });

    setImporting(false);
    setStep('done');
    toast.success(`Importação concluída: ${totalInserted} inseridos, ${totalUpdated} atualizados`);
  }, [parsedRows, file]);

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setResults(null);
    setProgress(0);
    setStep('upload');
    setUnmappedHeaders([]);
    setValidationErrors([]);
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
              Selecione um arquivo .xlsx com os dados das empresas. Cabeçalhos aceitos: Razão Social, CNPJ/CPF, Município/Cidade, UF/Estado, Rua/Endereço, Bairro, Número, CEP, Ramo, etc.
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
            {/* Unmapped headers warning */}
            {unmappedHeaders.length > 0 && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                <p className="text-sm font-medium text-yellow-600 mb-1">Colunas não mapeadas (ignoradas):</p>
                <div className="flex flex-wrap gap-1">
                  {unmappedHeaders.map((h) => (
                    <Badge key={h} variant="outline" className="text-xs">{h}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive mb-1">
                  {validationErrors.length} linhas ignoradas por falta de dados obrigatórios:
                </p>
                <ul className="text-xs space-y-0.5 text-muted-foreground max-h-20 overflow-auto">
                  {validationErrors.slice(0, 10).map((e, i) => (
                    <li key={i}>Linha {e.row}: {e.message}</li>
                  ))}
                  {validationErrors.length > 10 && (
                    <li>... e mais {validationErrors.length - 10}</li>
                  )}
                </ul>
              </div>
            )}

            <div className="rounded-lg border overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Razão Social</th>
                    <th className="px-3 py-2 text-left font-medium">CNPJ</th>
                    <th className="px-3 py-2 text-left font-medium">Ramo</th>
                    <th className="px-3 py-2 text-left font-medium">Cidade</th>
                    <th className="px-3 py-2 text-left font-medium">UF</th>
                    <th className="px-3 py-2 text-left font-medium">Endereço</th>
                    <th className="px-3 py-2 text-left font-medium">Bairro</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 truncate max-w-[200px]">{row.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{row.cnpj}</td>
                      <td className="px-3 py-1.5">{row.industry}</td>
                      <td className="px-3 py-1.5">{row.city}</td>
                      <td className="px-3 py-1.5">{row.state}</td>
                      <td className="px-3 py-1.5 truncate max-w-[150px]">{row.address}</td>
                      <td className="px-3 py-1.5">{row.neighborhood}</td>
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
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <p className="text-2xl font-bold text-blue-600">{results.updated}</p>
                <p className="text-xs text-muted-foreground">Atualizados</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                <p className="text-2xl font-bold text-yellow-600">{results.skipped}</p>
                <p className="text-xs text-muted-foreground">Ignorados</p>
              </div>
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
