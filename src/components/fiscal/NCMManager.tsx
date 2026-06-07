import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Pencil, Trash2, Search, FileText, Upload, Download, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

type NCMRow = {
  id: string;
  codigo: string;
  descricao: string;
  status: string;
  aliquota_ipi_oficial: number | null;
  unidade_tributaria: string | null;
  data_vigencia: string;
  data_fim_vigencia: string | null;
  ex_tipi: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

type NCMInsert = {
  codigo: string;
  descricao: string;
  status?: string;
  aliquota_ipi_oficial?: number | null;
  unidade_tributaria?: string | null;
  data_vigencia?: string;
  data_fim_vigencia?: string | null;
};

const emptyForm: NCMInsert = {
  codigo: '',
  descricao: '',
  status: 'ativo',
  aliquota_ipi_oficial: null,
  unidade_tributaria: '',
  data_vigencia: new Date().toISOString().split('T')[0],
  data_fim_vigencia: null,
};

export function NCMManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NCMInsert>({ ...emptyForm });
  const [isImporting, setIsImporting] = useState(false);

  // Get total count
  const { data: totalCount } = useQuery({
    queryKey: ['ncm-codes-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('ncm_codes').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const handleImportTIPI = async () => {
    setIsImporting(true);
    const toastId = toast.loading('Importando base TIPI da Receita Federal... Isso pode levar alguns minutos.');
    try {
      const { data, error } = await supabase.functions.invoke('import-ncm-tipi');
      if (error) throw error;
      if (data?.success) {
        toast.success(`Importação concluída! ${data.valid_codes} NCMs processados.`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['ncm-codes-manager'] });
        queryClient.invalidateQueries({ queryKey: ['ncm-codes-count'] });
      } else {
        toast.error(`Erro na importação: ${data?.error || 'Erro desconhecido'}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Falha ao importar: ${err.message}`, { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const { data: ncms, isLoading } = useQuery({
    queryKey: ['ncm-codes-manager', search],
    queryFn: async () => {
      let query = supabase.from('ncm_codes').select('*').order('codigo');
      if (search.trim()) {
        const term = search.trim();
        if (/^\d+$/.test(term)) {
          query = query.ilike('codigo', `${term}%`);
        } else {
          query = query.ilike('descricao', `%${term}%`);
        }
      }
      const { data, error } = await query.limit(5000);
      if (error) throw error;
      return data as NCMRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: NCMInsert) => {
      const { error } = await supabase.from('ncm_codes').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncm-codes-manager'] });
      toast.success('NCM cadastrado com sucesso');
      resetForm();
    },
    onError: (err: any) => toast.error('Erro ao cadastrar: ' + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: NCMInsert & { id: string }) => {
      const { error } = await supabase.from('ncm_codes').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncm-codes-manager'] });
      toast.success('NCM atualizado com sucesso');
      resetForm();
    },
    onError: (err: any) => toast.error('Erro ao atualizar: ' + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ncm_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncm-codes-manager'] });
      toast.success('NCM excluído');
    },
    onError: (err: any) => toast.error('Erro ao excluir: ' + err.message),
  });

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (ncm: NCMRow) => {
    setEditingId(ncm.id);
    setFormData({
      codigo: ncm.codigo,
      descricao: ncm.descricao,
      status: ncm.status,
      aliquota_ipi_oficial: ncm.aliquota_ipi_oficial,
      unidade_tributaria: ncm.unidade_tributaria,
      data_vigencia: ncm.data_vigencia,
      data_fim_vigencia: ncm.data_fim_vigencia,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || formData.codigo.length !== 8) {
      toast.error('Código NCM deve ter 8 dígitos');
      return;
    }
    if (!formData.descricao) {
      toast.error('Descrição é obrigatória');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cadastro de NCM
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os códigos NCM disponíveis para classificação fiscal de produtos.
            {totalCount != null && <span className="ml-1 font-medium">({totalCount} registros na base)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleImportTIPI}
            disabled={isImporting}
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isImporting ? 'Importando...' : 'Importar Base TIPI'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo NCM
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar NCM' : 'Novo Código NCM'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Código NCM *</Label>
                  <Input
                    value={formData.codigo}
                    onChange={e => setFormData(prev => ({ ...prev, codigo: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                    placeholder="00000000"
                    maxLength={8}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">8 dígitos numéricos</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status || 'ativo'} onValueChange={v => setFormData(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="obsoleto">Obsoleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição *</Label>
                <Input
                  value={formData.descricao}
                  onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição do código NCM"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Alíquota IPI (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_ipi_oficial ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, aliquota_ipi_oficial: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Unid. Tributária</Label>
                  <Input
                    value={formData.unidade_tributaria || ''}
                    onChange={e => setFormData(prev => ({ ...prev, unidade_tributaria: e.target.value || null }))}
                    placeholder="KG, UN..."
                  />
                </div>
                <div>
                  <Label>Vigência</Label>
                  <Input
                    type="date"
                    value={formData.data_vigencia || ''}
                    onChange={e => setFormData(prev => ({ ...prev, data_vigencia: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Fim da Vigência</Label>
                <Input
                  type="date"
                  value={formData.data_fim_vigencia || ''}
                  onChange={e => setFormData(prev => ({ ...prev, data_fim_vigencia: e.target.value || null }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? 'Salvar' : 'Cadastrar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código ou descrição..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <Card>
          <ScrollArea className="max-h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-24">IPI (%)</TableHead>
                  <TableHead className="w-20">Unid.</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ncms?.map(ncm => (
                  <TableRow key={ncm.id}>
                    <TableCell className="font-mono font-medium">{ncm.codigo}</TableCell>
                    <TableCell className="text-sm max-w-md truncate">{ncm.descricao}</TableCell>
                    <TableCell>{ncm.aliquota_ipi_oficial != null ? `${ncm.aliquota_ipi_oficial}%` : '-'}</TableCell>
                    <TableCell>{ncm.unidade_tributaria || '-'}</TableCell>
                    <TableCell>
                      {ncm.status === 'ativo' ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Ativo</Badge>
                      ) : ncm.status === 'inativo' ? (
                        <Badge variant="secondary">Inativo</Badge>
                      ) : (
                        <Badge variant="destructive">Obsoleto</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(ncm)}>
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
                              <AlertDialogTitle>Excluir NCM</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o NCM {ncm.codigo} - {ncm.descricao}?
                                Produtos vinculados a este NCM podem ser afetados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(ncm.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {ncms?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {search ? 'Nenhum NCM encontrado para esta busca.' : 'Nenhum NCM cadastrado. Clique em "Novo NCM" para começar.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
