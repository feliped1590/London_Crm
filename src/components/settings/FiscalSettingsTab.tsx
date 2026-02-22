import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransicaoTributariaPanel } from '@/components/fiscal/TransicaoTributariaPanel';
import { ImpostoSeletivoManager } from '@/components/fiscal/ImpostoSeletivoManager';
import { CreditoPresumidoManager } from '@/components/fiscal/CreditoPresumidoManager';
import { NCMManager } from '@/components/fiscal/NCMManager';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Lock, 
  Calculator, 
  FileText, 
  Gift, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  TrendingUp,
  Landmark,
  Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { useRegrasTributacao, useCreateRegraTributacao, useUpdateRegraTributacao, useDeleteRegraTributacao } from '@/hooks/useFiscalRules';
import { useBeneficiosFiscais, useCreateBeneficioFiscal, useUpdateBeneficioFiscal, useDeleteBeneficioFiscal } from '@/hooks/useBeneficiosFiscais';
import { 
  tipoOperacaoFiscalOptions, 
  tipoBeneficioFiscalOptions, 
  tributoAfetadoOptions,
  origemMercadoriaOptions 
} from '@/types/fiscal-extended';
import { regimeTributarioOptions, ufOptions } from '@/types/fiscal';
import type { Database } from '@/integrations/supabase/types';

type RegraInsert = Database['public']['Tables']['regras_tributacao']['Insert'];
type BeneficioInsert = Database['public']['Tables']['beneficios_fiscais']['Insert'];

export function FiscalSettingsTab() {
  const [activeSubTab, setActiveSubTab] = useState('regras');
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Fiscal / Tributário</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie regras de tributação, benefícios fiscais e cadastros auxiliares
        </p>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="regras" className="gap-2">
            <Calculator className="h-4 w-4" />
            Regras de Tributação
          </TabsTrigger>
          <TabsTrigger value="beneficios" className="gap-2">
            <Gift className="h-4 w-4" />
            Benefícios Fiscais
          </TabsTrigger>
          <TabsTrigger value="transicao" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Transição 2026
          </TabsTrigger>
          <TabsTrigger value="credito-presumido" className="gap-2">
            <Percent className="h-4 w-4" />
            Crédito Presumido
          </TabsTrigger>
          <TabsTrigger value="imposto-seletivo" className="gap-2">
            <Landmark className="h-4 w-4" />
            Imposto Seletivo
          </TabsTrigger>
          <TabsTrigger value="cadastros" className="gap-2">
            <FileText className="h-4 w-4" />
            Cadastros Base
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="mt-6">
          <RegrasTributacaoManager />
        </TabsContent>

        <TabsContent value="beneficios" className="mt-6">
          <BeneficiosFiscaisManager />
        </TabsContent>

        <TabsContent value="transicao" className="mt-6">
          <TransicaoTributariaPanel />
        </TabsContent>

        <TabsContent value="credito-presumido" className="mt-6">
          <CreditoPresumidoManager />
        </TabsContent>

        <TabsContent value="imposto-seletivo" className="mt-6">
          <ImpostoSeletivoManager />
        </TabsContent>

        <TabsContent value="cadastros" className="mt-6">
          <CadastrosBaseInfo />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================================
// Regras de Tributação Manager
// =============================================================================

function RegrasTributacaoManager() {
  const { data: regras, isLoading } = useRegrasTributacao();
  const createMutation = useCreateRegraTributacao();
  const updateMutation = useUpdateRegraTributacao();
  const deleteMutation = useDeleteRegraTributacao();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<RegraInsert>>({
    nome: '',
    cfop_resultante: '',
    prioridade: 0,
    is_active: true,
    valid_from: new Date().toISOString().split('T')[0],
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      cfop_resultante: '',
      prioridade: 0,
      is_active: true,
      valid_from: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (regra: any) => {
    setEditingId(regra.id);
    setFormData({
      nome: regra.nome,
      descricao: regra.descricao,
      codigo_interno: regra.codigo_interno,
      tipo_operacao: regra.tipo_operacao,
      uf_origem: regra.uf_origem,
      uf_destino: regra.uf_destino,
      regime_empresa: regra.regime_empresa,
      regime_cliente: regra.regime_cliente,
      ncm_code: regra.ncm_code,
      cfop: regra.cfop,
      cfop_resultante: regra.cfop_resultante,
      origem_mercadoria: regra.origem_mercadoria,
      icms_cst: regra.icms_cst,
      icms_csosn: regra.icms_csosn,
      icms_aliquota: regra.icms_aliquota,
      icms_reducao_base: regra.icms_reducao_base,
      ipi_cst: regra.ipi_cst,
      ipi_aliquota: regra.ipi_aliquota,
      pis_cst: regra.pis_cst,
      pis_aliquota: regra.pis_aliquota,
      cofins_cst: regra.cofins_cst,
      cofins_aliquota: regra.cofins_aliquota,
      prioridade: regra.prioridade,
      valid_from: regra.valid_from,
      valid_until: regra.valid_until,
      is_active: regra.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.cfop_resultante) {
      toast.error('Nome e CFOP resultante são obrigatórios');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData }, {
        onSuccess: resetForm,
      });
    } else {
      createMutation.mutate(formData as RegraInsert, {
        onSuccess: resetForm,
      });
    }
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Regras de tributação determinam automaticamente ICMS, IPI, PIS, COFINS e CFOP com base no contexto da operação.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Regra' : 'Nova Regra de Tributação'}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Identificação */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Identificação</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input 
                        value={formData.nome || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Ex: Venda SP para SP - Simples Nacional"
                      />
                    </div>
                    <div>
                      <Label>Código Interno</Label>
                      <Input 
                        value={formData.codigo_interno || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, codigo_interno: e.target.value }))}
                        placeholder="Ex: VENDA-SP-SP-SN"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea 
                      value={formData.descricao || ''} 
                      onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descrição detalhada da regra"
                    />
                  </div>
                </div>

                {/* Chaves de Decisão */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Chaves de Decisão (filtros)</h3>
                  <p className="text-xs text-muted-foreground">Deixe em branco para aplicar a qualquer valor</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Tipo de Operação</Label>
                      <Select 
                        value={formData.tipo_operacao || '_none'} 
                        onValueChange={v => setFormData(prev => ({ ...prev, tipo_operacao: v === '_none' ? undefined : v as any }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Qualquer</SelectItem>
                          {tipoOperacaoFiscalOptions.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>UF Origem</Label>
                      <Select 
                        value={formData.uf_origem || '_none'} 
                        onValueChange={v => setFormData(prev => ({ ...prev, uf_origem: v === '_none' ? undefined : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Qualquer</SelectItem>
                          {ufOptions.map(uf => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>UF Destino</Label>
                      <Select 
                        value={formData.uf_destino || '_none'} 
                        onValueChange={v => setFormData(prev => ({ ...prev, uf_destino: v === '_none' ? undefined : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Qualquer</SelectItem>
                          {ufOptions.map(uf => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Regime Empresa</Label>
                      <Select 
                        value={formData.regime_empresa || '_none'} 
                        onValueChange={v => setFormData(prev => ({ ...prev, regime_empresa: v === '_none' ? undefined : v as any }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Qualquer</SelectItem>
                          {regimeTributarioOptions.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Regime Cliente</Label>
                      <Select 
                        value={formData.regime_cliente || '_none'} 
                        onValueChange={v => setFormData(prev => ({ ...prev, regime_cliente: v === '_none' ? undefined : v as any }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Qualquer</SelectItem>
                          {regimeTributarioOptions.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>NCM (prefixo)</Label>
                      <Input 
                        value={formData.ncm_code || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, ncm_code: e.target.value || undefined }))}
                        placeholder="Ex: 3923 ou 39232110"
                        maxLength={8}
                      />
                    </div>
                  </div>
                </div>

                {/* Resultados */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Resultados da Regra</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>CFOP Resultante *</Label>
                      <Input 
                        value={formData.cfop_resultante || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, cfop_resultante: e.target.value }))}
                        placeholder="Ex: 5102"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <Label>Origem Mercadoria</Label>
                      <Select 
                        value={formData.origem_mercadoria || '0'} 
                        onValueChange={v => setFormData(prev => ({ ...prev, origem_mercadoria: v as any }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {origemMercadoriaOptions.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <Input 
                        type="number"
                        value={formData.prioridade || 0} 
                        onChange={e => setFormData(prev => ({ ...prev, prioridade: parseInt(e.target.value) || 0 }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Maior = mais específica</p>
                    </div>
                  </div>
                </div>

                {/* ICMS */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">ICMS</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>CST</Label>
                      <Input 
                        value={formData.icms_cst || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, icms_cst: e.target.value || undefined }))}
                        placeholder="00"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label>CSOSN</Label>
                      <Input 
                        value={formData.icms_csosn || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, icms_csosn: e.target.value || undefined }))}
                        placeholder="102"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <Label>Alíquota (%)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={formData.icms_aliquota || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, icms_aliquota: parseFloat(e.target.value) || undefined }))}
                        placeholder="18.00"
                      />
                    </div>
                    <div>
                      <Label>Redução BC (%)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={formData.icms_reducao_base || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, icms_reducao_base: parseFloat(e.target.value) || undefined }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* IPI / PIS / COFINS */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">IPI / PIS / COFINS</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>IPI CST</Label>
                      <Input 
                        value={formData.ipi_cst || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, ipi_cst: e.target.value || undefined }))}
                        placeholder="50"
                      />
                    </div>
                    <div>
                      <Label>IPI Alíquota (%)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={formData.ipi_aliquota || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, ipi_aliquota: parseFloat(e.target.value) || undefined }))}
                        placeholder="5.00"
                      />
                    </div>
                    <div>
                      <Label>PIS CST</Label>
                      <Input 
                        value={formData.pis_cst || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, pis_cst: e.target.value || undefined }))}
                        placeholder="01"
                      />
                    </div>
                    <div>
                      <Label>PIS Alíquota (%)</Label>
                      <Input 
                        type="number"
                        step="0.0001"
                        value={formData.pis_aliquota || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, pis_aliquota: parseFloat(e.target.value) || undefined }))}
                        placeholder="1.65"
                      />
                    </div>
                    <div>
                      <Label>COFINS CST</Label>
                      <Input 
                        value={formData.cofins_cst || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, cofins_cst: e.target.value || undefined }))}
                        placeholder="01"
                      />
                    </div>
                    <div>
                      <Label>COFINS Alíquota (%)</Label>
                      <Input 
                        type="number"
                        step="0.0001"
                        value={formData.cofins_aliquota || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, cofins_aliquota: parseFloat(e.target.value) || undefined }))}
                        placeholder="7.60"
                      />
                    </div>
                  </div>
                </div>

                {/* Vigência */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Vigência e Status</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Válido a partir de *</Label>
                      <Input 
                        type="date"
                        value={formData.valid_from || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Válido até</Label>
                      <Input 
                        type="date"
                        value={formData.valid_until || ''} 
                        onChange={e => setFormData(prev => ({ ...prev, valid_until: e.target.value || undefined }))}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch 
                        checked={formData.is_active ?? true}
                        onCheckedChange={checked => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <Label>Regra ativa</Label>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingId ? 'Salvar' : 'Criar Regra'}
                  </Button>
                </DialogFooter>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>CFOP</TableHead>
              <TableHead>ICMS</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regras?.map(regra => (
              <TableRow key={regra.id}>
                <TableCell>
                  <div className="font-medium">{regra.nome}</div>
                  {regra.codigo_interno && (
                    <code className="text-xs text-muted-foreground">{regra.codigo_interno}</code>
                  )}
                </TableCell>
                <TableCell>
                  {regra.tipo_operacao ? (
                    <Badge variant="outline" className="text-xs">
                      {tipoOperacaoFiscalOptions.find(o => o.value === regra.tipo_operacao)?.label || regra.tipo_operacao}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">Todas</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {regra.uf_origem || '*'} → {regra.uf_destino || '*'}
                  </span>
                </TableCell>
                <TableCell>
                  <code className="font-mono">{regra.cfop_resultante}</code>
                </TableCell>
                <TableCell>
                  {regra.icms_aliquota != null ? (
                    <span>{regra.icms_aliquota}%</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {regra.locked_at ? (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Bloqueada
                      </Badge>
                    ) : regra.is_active ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Ativa
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                    {regra.is_fallback && (
                      <Badge variant="outline" className="text-yellow-600">Fallback</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleEdit(regra)}
                      disabled={!!regra.locked_at}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!!regra.locked_at || regra.is_fallback}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Regra</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a regra "{regra.nome}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(regra.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {regras?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma regra cadastrada. Clique em "Nova Regra" para começar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// =============================================================================
// Benefícios Fiscais Manager
// =============================================================================

function BeneficiosFiscaisManager() {
  const { data: beneficios, isLoading } = useBeneficiosFiscais();
  const createMutation = useCreateBeneficioFiscal();
  const updateMutation = useUpdateBeneficioFiscal();
  const deleteMutation = useDeleteBeneficioFiscal();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BeneficioInsert>>({
    nome: '',
    tipo: 'isencao',
    tributo: 'icms',
    numero_documento: '',
    is_active: true,
    valid_from: new Date().toISOString().split('T')[0],
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: 'isencao',
      tributo: 'icms',
      numero_documento: '',
      is_active: true,
      valid_from: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (beneficio: any) => {
    setEditingId(beneficio.id);
    setFormData({
      nome: beneficio.nome,
      codigo: beneficio.codigo,
      tipo: beneficio.tipo,
      tributo: beneficio.tributo,
      percentual_reducao: beneficio.percentual_reducao,
      aliquota_resultante: beneficio.aliquota_resultante,
      numero_documento: beneficio.numero_documento,
      orgao_emissor: beneficio.orgao_emissor,
      data_documento: beneficio.data_documento,
      ncms_aplicaveis: beneficio.ncms_aplicaveis,
      valid_from: beneficio.valid_from,
      valid_until: beneficio.valid_until,
      is_active: beneficio.is_active,
      notes: beneficio.notes,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.numero_documento || !formData.tipo || !formData.tributo) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData }, {
        onSuccess: resetForm,
      });
    } else {
      createMutation.mutate(formData as BeneficioInsert, {
        onSuccess: resetForm,
      });
    }
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cadastre benefícios fiscais (isenções, reduções) que podem ser vinculados aos clientes.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Benefício
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Benefício' : 'Novo Benefício Fiscal'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome *</Label>
                  <Input 
                    value={formData.nome || ''} 
                    onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Isenção IPI - Lei 123/2020"
                  />
                </div>
                <div>
                  <Label>Código Interno</Label>
                  <Input 
                    value={formData.codigo || ''} 
                    onChange={e => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                    placeholder="Ex: ISEN-IPI-2020"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Benefício *</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={v => setFormData(prev => ({ ...prev, tipo: v as any }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tipoBeneficioFiscalOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tributo Afetado *</Label>
                  <Select 
                    value={formData.tributo} 
                    onValueChange={v => setFormData(prev => ({ ...prev, tributo: v as any }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tributoAfetadoOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.tipo === 'reducao_base' && (
                <div>
                  <Label>Percentual de Redução (%)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.percentual_reducao || ''} 
                    onChange={e => setFormData(prev => ({ ...prev, percentual_reducao: parseFloat(e.target.value) || undefined }))}
                    placeholder="Ex: 33.33"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Documento Legal *</Label>
                  <Input 
                    value={formData.numero_documento || ''} 
                    onChange={e => setFormData(prev => ({ ...prev, numero_documento: e.target.value }))}
                    placeholder="Ex: Lei 12.345/2020"
                  />
                </div>
                <div>
                  <Label>Órgão Emissor</Label>
                  <Input 
                    value={formData.orgao_emissor || ''} 
                    onChange={e => setFormData(prev => ({ ...prev, orgao_emissor: e.target.value }))}
                    placeholder="Ex: Receita Federal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Data do Documento</Label>
                  <Input 
                    type="date"
                    value={formData.data_documento || ''} 
                    onChange={e => setFormData(prev => ({ ...prev, data_documento: e.target.value || undefined }))}
                  />
                </div>
                <div>
                  <Label>Válido a partir de *</Label>
                  <Input 
                    type="date"
                    value={formData.valid_from || ''} 
                    onChange={e => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Válido até</Label>
                  <Input 
                    type="date"
                    value={formData.valid_until || ''} 
                    onChange={e => setFormData(prev => ({ ...prev, valid_until: e.target.value || undefined }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_active ?? true}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Benefício ativo</Label>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea 
                  value={formData.notes || ''} 
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Anotações adicionais sobre o benefício"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? 'Salvar' : 'Criar Benefício'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tributo</TableHead>
              <TableHead>Documento Legal</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {beneficios?.map(beneficio => (
              <TableRow key={beneficio.id}>
                <TableCell>
                  <div className="font-medium">{beneficio.nome}</div>
                  {beneficio.codigo && (
                    <code className="text-xs text-muted-foreground">{beneficio.codigo}</code>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {tipoBeneficioFiscalOptions.find(o => o.value === beneficio.tipo)?.label || beneficio.tipo}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {tributoAfetadoOptions.find(o => o.value === beneficio.tributo)?.label || beneficio.tributo}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{beneficio.numero_documento}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {beneficio.valid_from} {beneficio.valid_until ? `até ${beneficio.valid_until}` : ''}
                  </span>
                </TableCell>
                <TableCell>
                  {beneficio.is_active ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(beneficio)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Benefício</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o benefício "{beneficio.nome}"? 
                            Clientes vinculados a este benefício perderão o vínculo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(beneficio.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {beneficios?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum benefício cadastrado. Clique em "Novo Benefício" para começar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// =============================================================================
// Cadastros Base Info
// =============================================================================

function CadastrosBaseInfo() {
  const [activeSection, setActiveSection] = useState<'ncm' | 'overview'>('ncm');

  return (
    <div className="space-y-6">
      <NCMManager />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              CST / CSOSN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Definidos nas regras de tributação. CST para Lucro Presumido/Real, CSOSN para Simples Nacional.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CFOP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Definido automaticamente pelas regras de tributação com base no tipo de operação e UFs.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4" />
              Próximos Passos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Integração IBPT</li>
              <li>• Serialização XML NF-e</li>
              <li>• Relatórios SPED</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
