import { useCallback, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Building2, CheckCircle2, FileSpreadsheet, Loader2, Package, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ImportCompanyRow } from '@/types/imports';

type CustomerStep = 'upload' | 'preview' | 'importing' | 'done';
type ProductStep = 'upload' | 'preview' | 'importing' | 'done';

interface CustomerImportResult {
  total_received: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors?: string[];
}

interface ProductImportResult {
  total_lines: number;
  parsed: number;
  inserted: number;
  insert_errors: number;
  warnings?: string[];
  insert_error_details?: string[];
}

const CUSTOMER_FIELD_MAP: Record<string, string> = {
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
  vendedor: 'vendedor_nome',
};

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function decodeFileBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text: string;

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder('utf-16le').decode(buffer);
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder('utf-16be').decode(buffer);
  } else {
    text = new TextDecoder('utf-8').decode(buffer);
  }

  return text
    .replace(/^\uFEFF/, '')
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      cols.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  cols.push(current.trim());
  return cols;
}

function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t', '|'];
  let selected = ';';
  let maxColumns = 1;

  for (const candidate of candidates) {
    const parsed = parseDelimitedLine(headerLine, candidate);
    if (parsed.length > maxColumns) {
      maxColumns = parsed.length;
      selected = candidate;
    }
  }

  return selected;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; delimiter: string } {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { headers: [], rows: [], delimiter: ';' };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = parseDelimitedLine(line, delimiter);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = (cols[index] ?? '').trim();
      return acc;
    }, {});
  });

  return { headers, rows, delimiter };
}

export default function ImportData() {
  const [activeTab, setActiveTab] = useState('customers');

  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [customerRows, setCustomerRows] = useState<ImportCompanyRow[]>([]);
  const [customerStep, setCustomerStep] = useState<CustomerStep>('upload');
  const [customerProgress, setCustomerProgress] = useState(0);
  const [customerImporting, setCustomerImporting] = useState(false);
  const [customerUnmappedHeaders, setCustomerUnmappedHeaders] = useState<string[]>([]);
  const [customerValidationErrors, setCustomerValidationErrors] = useState<{ row: number; message: string }[]>([]);
  const [customerDelimiter, setCustomerDelimiter] = useState<string>(';');
  const [customerResult, setCustomerResult] = useState<CustomerImportResult | null>(null);

  const [productFile, setProductFile] = useState<File | null>(null);
  const [productCsvContent, setProductCsvContent] = useState('');
  const [productStep, setProductStep] = useState<ProductStep>('upload');
  const [productDelimiter, setProductDelimiter] = useState<string>(';');
  const [productPreviewLines, setProductPreviewLines] = useState(0);
  const [productImporting, setProductImporting] = useState(false);
  const [productResult, setProductResult] = useState<ProductImportResult | null>(null);

  const customerDelimiterLabel = useMemo(
    () => (customerDelimiter === '\t' ? 'TAB' : customerDelimiter),
    [customerDelimiter],
  );

  const productDelimiterLabel = useMemo(
    () => (productDelimiter === '\t' ? 'TAB' : productDelimiter),
    [productDelimiter],
  );

  const resetCustomers = () => {
    setCustomerFile(null);
    setCustomerRows([]);
    setCustomerStep('upload');
    setCustomerProgress(0);
    setCustomerImporting(false);
    setCustomerUnmappedHeaders([]);
    setCustomerValidationErrors([]);
    setCustomerResult(null);
    setCustomerDelimiter(';');
  };

  const resetProducts = () => {
    setProductFile(null);
    setProductCsvContent('');
    setProductStep('upload');
    setProductPreviewLines(0);
    setProductImporting(false);
    setProductResult(null);
    setProductDelimiter(';');
  };

  const handleCustomersFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCustomerFile(file);
    setCustomerResult(null);
    setCustomerValidationErrors([]);
    setCustomerUnmappedHeaders([]);

    try {
      const text = decodeFileBuffer(await file.arrayBuffer());
      const { headers, rows, delimiter } = parseCsv(text);

      if (headers.length === 0 || rows.length === 0) {
        toast.error('Arquivo CSV vazio ou sem linhas válidas.');
        return;
      }

      setCustomerDelimiter(delimiter);

      const headerToDbField: Record<string, string> = {};
      const unmapped: string[] = [];

      for (const header of headers) {
        const dbField = CUSTOMER_FIELD_MAP[normalizeHeader(header)];
        if (dbField) {
          headerToDbField[header] = dbField;
        } else {
          unmapped.push(header);
        }
      }

      const validationErrors: { row: number; message: string }[] = [];
      const mappedRows = rows
        .map((row, index) => {
          const mapped: Record<string, string> = {};
          for (const [originalHeader, dbField] of Object.entries(headerToDbField)) {
            mapped[dbField] = row[originalHeader] ?? '';
          }

          if (!mapped.cnpj && !mapped.name) {
            validationErrors.push({ row: index + 2, message: 'CNPJ e Nome ausentes' });
          } else if (!mapped.cnpj) {
            validationErrors.push({ row: index + 2, message: 'CNPJ ausente' });
          } else if (!mapped.name) {
            validationErrors.push({ row: index + 2, message: 'Nome (Razão Social) ausente' });
          }

          return mapped;
        })
        .filter((row): row is ImportCompanyRow => Boolean(row.name && row.cnpj));

      if (mappedRows.length === 0) {
        toast.error('Nenhuma linha válida encontrada para importar clientes.');
        return;
      }

      setCustomerRows(mappedRows);
      setCustomerValidationErrors(validationErrors);
      setCustomerUnmappedHeaders(unmapped);
      setCustomerStep('preview');

      const baseMessage = `${mappedRows.length} clientes válidos encontrados`;
      if (validationErrors.length > 0) {
        toast.warning(`${baseMessage}. ${validationErrors.length} linhas foram ignoradas.`);
      } else {
        toast.success(baseMessage);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao ler o CSV de clientes.');
    } finally {
      if (event.target) event.target.value = '';
    }
  }, []);

  const startCustomersImport = useCallback(async () => {
    if (customerRows.length === 0) return;

    setCustomerImporting(true);
    setCustomerStep('importing');
    setCustomerProgress(0);

    const batchSize = 200;
    const totalBatches = Math.ceil(customerRows.length / batchSize);
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    for (let index = 0; index < totalBatches; index++) {
      const batch = customerRows.slice(index * batchSize, (index + 1) * batchSize);

      try {
        const { data, error } = await supabase.functions.invoke('import-companies-from-file', {
          body: {
            rows: batch,
            file_name: customerFile?.name || 'unknown',
            batch_index: index,
            total_batches: totalBatches,
          },
        });

        if (error) {
          allErrors.push(`Lote ${index + 1}: ${error.message}`);
        } else if (data) {
          totalInserted += data.inserted || 0;
          totalUpdated += data.updated || 0;
          totalSkipped += data.skipped || 0;
          if (data.errors) allErrors.push(...data.errors);
        }
      } catch (error: unknown) {
        allErrors.push(`Lote ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }

      setCustomerProgress(Math.round(((index + 1) / totalBatches) * 100));
    }

    setCustomerResult({
      total_received: customerRows.length,
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });

    setCustomerImporting(false);
    setCustomerStep('done');
    toast.success(`Importação de clientes concluída: ${totalInserted} inseridos, ${totalUpdated} atualizados`);
  }, [customerRows, customerFile]);

  const handleProductsFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProductFile(file);
    setProductResult(null);

    try {
      const text = decodeFileBuffer(await file.arrayBuffer());
      const { delimiter } = parseCsv(text);
      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

      if (lines.length < 2) {
        toast.error('Arquivo CSV de produtos vazio ou inválido.');
        return;
      }

      setProductCsvContent(text);
      setProductDelimiter(delimiter);
      setProductPreviewLines(Math.max(0, lines.length - 1));
      setProductStep('preview');
      toast.success(`Arquivo de produtos carregado com ${Math.max(0, lines.length - 1)} linhas.`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao ler o CSV de produtos.');
    } finally {
      if (event.target) event.target.value = '';
    }
  }, []);

  const startProductsImport = useCallback(async () => {
    if (!productCsvContent) return;

    setProductImporting(true);
    setProductStep('importing');

    try {
      const { data, error } = await supabase.functions.invoke('import-products-csv', {
        body: { csvContent: productCsvContent },
      });

      if (error) throw error;

      const result = data as ProductImportResult;
      setProductResult(result);
      setProductStep('done');

      if (result.inserted > 0) {
        toast.success(`Importação de produtos concluída: ${result.inserted} inseridos.`);
      } else {
        toast.info('Importação finalizada sem novos produtos inseridos.');
      }
      if (result.insert_errors > 0) {
        toast.warning(`${result.insert_errors} erros de inserção foram reportados.`);
      }
      if (result.warnings?.length) {
        toast.info(`${result.warnings.length} avisos foram gerados no processamento.`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      toast.error(`Erro na importação de produtos: ${message}`);
      setProductStep('preview');
    } finally {
      setProductImporting(false);
    }
  }, [productCsvContent]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importação por CSV</h1>
        <p className="text-muted-foreground">
          Importe clientes e produtos em lote por arquivo CSV em uma única tela.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="customers" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Importar Clientes (CSV)
              </CardTitle>
              <CardDescription>
                Aceita colunas como Razão Social, CNPJ/CPF, Nome Fantasia, Cidade, UF, Endereço, Vendedor e Ramo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customerStep === 'upload' && (
                <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-border">
                  <div className="flex flex-col items-center">
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Clique para selecionar</span> o CSV de clientes
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">.csv ou .txt até 20MB</p>
                  </div>
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCustomersFile} />
                </label>
              )}

              {customerStep === 'preview' && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{customerRows.length} válidos</Badge>
                    <Badge variant="outline">Delimitador: {customerDelimiterLabel}</Badge>
                    {customerFile?.name && <Badge variant="secondary">{customerFile.name}</Badge>}
                  </div>

                  {customerUnmappedHeaders.length > 0 && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                      <p className="text-sm font-medium text-yellow-600 mb-1">Colunas não mapeadas (ignoradas):</p>
                      <div className="flex flex-wrap gap-1">
                        {customerUnmappedHeaders.map((header) => (
                          <Badge key={header} variant="outline" className="text-xs">
                            {header}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {customerValidationErrors.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-sm font-medium text-destructive mb-1">
                        {customerValidationErrors.length} linhas ignoradas:
                      </p>
                      <ul className="text-xs space-y-0.5 text-muted-foreground max-h-20 overflow-auto">
                        {customerValidationErrors.slice(0, 10).map((item, index) => (
                          <li key={index}>
                            Linha {item.row}: {item.message}
                          </li>
                        ))}
                        {customerValidationErrors.length > 10 && <li>... e mais {customerValidationErrors.length - 10}</li>}
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
                          <th className="px-3 py-2 text-left font-medium">Cidade</th>
                          <th className="px-3 py-2 text-left font-medium">UF</th>
                          <th className="px-3 py-2 text-left font-medium">Vendedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerRows.slice(0, 20).map((row, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-1.5 text-muted-foreground">{index + 1}</td>
                            <td className="px-3 py-1.5 truncate max-w-[260px]">{row.name}</td>
                            <td className="px-3 py-1.5 font-mono text-xs">{row.cnpj}</td>
                            <td className="px-3 py-1.5">{row.city || '-'}</td>
                            <td className="px-3 py-1.5">{row.state || '-'}</td>
                            <td className="px-3 py-1.5">{row.vendedor_nome || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {customerRows.length > 20 && (
                      <p className="text-center text-xs text-muted-foreground py-2">... e mais {customerRows.length - 20} registros</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={startCustomersImport} className="gap-2" disabled={customerImporting}>
                      <Upload className="h-4 w-4" />
                      Iniciar Importação ({customerRows.length})
                    </Button>
                    <Button variant="outline" onClick={resetCustomers} disabled={customerImporting}>
                      Limpar
                    </Button>
                  </div>
                </>
              )}

              {customerStep === 'importing' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando clientes...
                  </p>
                  <Progress value={customerProgress} className="h-3" />
                  <p className="text-xs text-muted-foreground">{customerProgress}% concluído</p>
                </div>
              )}

              {customerStep === 'done' && customerResult && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <p className="text-xl font-bold">{customerResult.total_received}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="rounded-lg bg-green-500/10 p-3 text-center">
                      <p className="text-xl font-bold text-green-600">{customerResult.inserted}</p>
                      <p className="text-xs text-muted-foreground">Inseridos</p>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                      <p className="text-xl font-bold text-blue-600">{customerResult.updated}</p>
                      <p className="text-xs text-muted-foreground">Atualizados</p>
                    </div>
                    <div className="rounded-lg bg-yellow-500/10 p-3 text-center">
                      <p className="text-xl font-bold text-yellow-600">{customerResult.skipped}</p>
                      <p className="text-xs text-muted-foreground">Ignorados</p>
                    </div>
                  </div>

                  {customerResult.errors && customerResult.errors.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 p-3">
                      <p className="text-sm font-medium flex items-center gap-1 text-destructive mb-1">
                        <AlertCircle className="h-4 w-4" />
                        Erros reportados:
                      </p>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {customerResult.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>- {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button variant="outline" onClick={resetCustomers}>
                    Importar outro CSV de clientes
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Importar Produtos (CSV)
              </CardTitle>
              <CardDescription>
                Carrega o arquivo CSV e executa a função de importação de produtos em lote.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {productStep === 'upload' && (
                <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-border">
                  <div className="flex flex-col items-center">
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Clique para selecionar</span> o CSV de produtos
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">.csv ou .txt até 20MB</p>
                  </div>
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleProductsFile} />
                </label>
              )}

              {productStep === 'preview' && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{productPreviewLines} linhas de dados</Badge>
                    <Badge variant="outline">Delimitador detectado: {productDelimiterLabel}</Badge>
                    {productFile?.name && <Badge variant="secondary">{productFile.name}</Badge>}
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    A importação usa a função <code>import-products-csv</code>. Se o arquivo usar delimitador diferente do esperado pelo
                    parser no backend, a função pode retornar avisos.
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={startProductsImport} className="gap-2" disabled={productImporting}>
                      <Upload className="h-4 w-4" />
                      Iniciar Importação ({productPreviewLines} linhas)
                    </Button>
                    <Button variant="outline" onClick={resetProducts} disabled={productImporting}>
                      Limpar
                    </Button>
                  </div>
                </>
              )}

              {productStep === 'importing' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando produtos...
                  </p>
                  <p className="text-xs text-muted-foreground">Processamento em andamento no backend.</p>
                </div>
              )}

              {productStep === 'done' && productResult && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <p className="text-xl font-bold">{productResult.total_lines}</p>
                      <p className="text-xs text-muted-foreground">Linhas no CSV</p>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                      <p className="text-xl font-bold text-blue-600">{productResult.parsed}</p>
                      <p className="text-xs text-muted-foreground">Parseadas</p>
                    </div>
                    <div className="rounded-lg bg-green-500/10 p-3 text-center">
                      <p className="text-xl font-bold text-green-600">{productResult.inserted}</p>
                      <p className="text-xs text-muted-foreground">Inseridas</p>
                    </div>
                    <div className="rounded-lg bg-yellow-500/10 p-3 text-center">
                      <p className="text-xl font-bold text-yellow-600">{productResult.insert_errors}</p>
                      <p className="text-xs text-muted-foreground">Erros</p>
                    </div>
                  </div>

                  {productResult.warnings && productResult.warnings.length > 0 && (
                    <div className="rounded-lg border border-yellow-500/30 p-3">
                      <p className="text-sm font-medium mb-1">Avisos ({productResult.warnings.length}):</p>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {productResult.warnings.slice(0, 5).map((warning, index) => (
                          <li key={index}>- {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {productResult.insert_error_details && productResult.insert_error_details.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 p-3">
                      <p className="text-sm font-medium flex items-center gap-1 text-destructive mb-1">
                        <AlertCircle className="h-4 w-4" />
                        Erros de inserção:
                      </p>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {productResult.insert_error_details.slice(0, 5).map((error, index) => (
                          <li key={index}>- {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Importação concluída.
                  </div>

                  <Button variant="outline" onClick={resetProducts}>
                    Importar outro CSV de produtos
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
