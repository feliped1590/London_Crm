import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useImpostoSeletivo } from '@/hooks/useImpostoSeletivo';
import { categoriaImpostoSeletivoOptions } from '@/types/fiscal-reforma';
import type { CategoriaImpostoSeletivo } from '@/types/fiscal-reforma';

interface FormData {
  codigo: string;
  descricao: string;
  categoria: CategoriaImpostoSeletivo;
  aliquota_padrao: number;
  aliquota_maxima?: number;
  ncms_aplicaveis_text: string;
  produtos_especificos_text: string;
  excecoes_legais_text: string;
  incide_produto_final: boolean;
  incide_importacao: boolean;
  base_legal: string;
  valid_from: string;
  valid_until?: string;
}

const defaultForm: FormData = {
  codigo: '',
  descricao: '',
  categoria: 'nao_aplicavel',
  aliquota_padrao: 0,
  ncms_aplicaveis_text: '',
  produtos_especificos_text: '',
  excecoes_legais_text: '',
  incide_produto_final: true,
  incide_importacao: true,
  base_legal: '',
  valid_from: new Date().toISOString().split('T')[0],
};

export function ImpostoSeletivoManager() {
  const { cadastros, isLoading, createCadastro, updateCadastro, deactivateCadastro } = useImpostoSeletivo();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (cadastro: any) => {
    setEditingId(cadastro.id);
    setFormData({
      codigo: cadastro.codigo,
      descricao: cadastro.descricao,
      categoria: cadastro.categoria,
      aliquota_padrao: cadastro.aliquota_padrao,
      aliquota_maxima: cadastro.aliquota_maxima,
      ncms_aplicaveis_text: (cadastro.ncms_aplicaveis || []).join(', '),
      produtos_especificos_text: (cadastro.produtos_especificos || []).join('\n'),
      excecoes_legais_text: (cadastro.excecoes_legais || []).join('\n'),
      incide_produto_final: cadastro.incide_produto_final ?? true,
      incide_importacao: cadastro.incide_importacao ?? true,
      base_legal: cadastro.base_legal || '',
      valid_from: cadastro.valid_from,
      valid_until: cadastro.valid_until,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || !formData.descricao || !formData.categoria) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const payload = {
      codigo: formData.codigo,
      descricao: formData.descricao,
      categoria: formData.categoria,
      aliquota_padrao: formData.aliquota_padrao,
      aliquota_maxima: formData.aliquota_maxima,
      ncms_aplicaveis: formData.ncms_aplicaveis_text ? formData.ncms_aplicaveis_text.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      produtos_especificos: formData.produtos_especificos_text ? formData.produtos_especificos_text.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
      excecoes_legais: formData.excecoes_legais_text ? formData.excecoes_legais_text.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
      incide_produto_final: formData.incide_produto_final,
      incide_importacao: formData.incide_importacao,
      base_legal: formData.base_legal || undefined,
      valid_from: formData.valid_from,
      valid_until: formData.valid_until,
    };

    try {
      if (editingId) {
        await updateCadastro({ id: editingId, ...payload });
      } else {
        await createCadastro(payload);
      }
      resetForm();
    } catch {}
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cadastre produtos/categorias sujeitos ao Imposto Seletivo (IS). A aplicação usa categoria, produto final e exceções legais, não apenas NCM.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cadastro IS
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Cadastro IS' : 'Novo Cadastro - Imposto Seletivo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Código *</Label>
                  <Input value={formData.codigo} onChange={e => setFormData(p => ({ ...p, codigo: e.target.value }))} placeholder="IS-BEBIDAS-ALC" />
                </div>
                <div>
                  <Label>Categoria *</Label>
                  <Select value={formData.categoria} onValueChange={v => setFormData(p => ({ ...p, categoria: v as CategoriaImpostoSeletivo }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categoriaImpostoSeletivoOptions.filter(o => o.value !== 'nao_aplicavel').map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição *</Label>
                <Textarea value={formData.descricao} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição do produto/categoria sujeito ao IS" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Alíquota Padrão (%)</Label>
                  <Input type="number" step="0.01" value={formData.aliquota_padrao} onChange={e => setFormData(p => ({ ...p, aliquota_padrao: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Alíquota Máxima (%)</Label>
                  <Input type="number" step="0.01" value={formData.aliquota_maxima ?? ''} onChange={e => setFormData(p => ({ ...p, aliquota_maxima: parseFloat(e.target.value) || undefined }))} />
                </div>
              </div>

              <div>
                <Label>NCMs Aplicáveis (separados por vírgula)</Label>
                <Input value={formData.ncms_aplicaveis_text} onChange={e => setFormData(p => ({ ...p, ncms_aplicaveis_text: e.target.value }))} placeholder="2203, 2204, 2205" />
              </div>

              <div>
                <Label>Exceções Legais (uma por linha)</Label>
                <Textarea value={formData.excecoes_legais_text} onChange={e => setFormData(p => ({ ...p, excecoes_legais_text: e.target.value }))} placeholder="Produtos isentos do IS" rows={3} />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.incide_produto_final} onCheckedChange={v => setFormData(p => ({ ...p, incide_produto_final: v }))} />
                  <Label>Incide sobre produto final</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.incide_importacao} onCheckedChange={v => setFormData(p => ({ ...p, incide_importacao: v }))} />
                  <Label>Incide na importação</Label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Base Legal</Label>
                  <Input value={formData.base_legal} onChange={e => setFormData(p => ({ ...p, base_legal: e.target.value }))} placeholder="Art. 153, VIII CF" />
                </div>
                <div>
                  <Label>Válido a partir de *</Label>
                  <Input type="date" value={formData.valid_from} onChange={e => setFormData(p => ({ ...p, valid_from: e.target.value }))} />
                </div>
                <div>
                  <Label>Válido até</Label>
                  <Input type="date" value={formData.valid_until || ''} onChange={e => setFormData(p => ({ ...p, valid_until: e.target.value || undefined }))} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit">{editingId ? 'Salvar' : 'Criar Cadastro'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Alíquota</TableHead>
              <TableHead>Incidência</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cadastros?.map(c => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.codigo}</div>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.descricao}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {categoriaImpostoSeletivoOptions.find(o => o.value === c.categoria)?.label || c.categoria}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">{c.aliquota_padrao}%</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {c.incide_produto_final && <Badge variant="secondary" className="text-[10px]">Prod. Final</Badge>}
                    {c.incide_importacao && <Badge variant="secondary" className="text-[10px]">Import.</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{c.valid_from}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
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
                          <AlertDialogTitle>Desativar Cadastro IS</AlertDialogTitle>
                          <AlertDialogDescription>
                            Desativar "{c.codigo}"? O cadastro será mantido para histórico.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deactivateCadastro(c.id)}>Desativar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!cadastros || cadastros.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum cadastro de Imposto Seletivo. Clique em "Novo Cadastro IS" para começar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
