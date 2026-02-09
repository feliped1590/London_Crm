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
import { useCreditoPresumido } from '@/hooks/useCreditoPresumido';

interface FormData {
  codigo: string;
  nome: string;
  descricao: string;
  tributo: 'cbs' | 'ibs' | 'ambos';
  percentual_credito: number;
  aplica_por_adquirente: boolean;
  tipos_adquirente_text: string;
  aplica_por_operacao: boolean;
  tipos_operacao_text: string;
  aplica_por_ncm: boolean;
  ncms_aplicaveis_text: string;
  aplica_por_regiao: boolean;
  ufs_aplicaveis_text: string;
  base_legal: string;
  valid_from: string;
  valid_until?: string;
}

const defaultForm: FormData = {
  codigo: '',
  nome: '',
  descricao: '',
  tributo: 'ambos',
  percentual_credito: 0,
  aplica_por_adquirente: false,
  tipos_adquirente_text: '',
  aplica_por_operacao: false,
  tipos_operacao_text: '',
  aplica_por_ncm: false,
  ncms_aplicaveis_text: '',
  aplica_por_regiao: false,
  ufs_aplicaveis_text: '',
  base_legal: '',
  valid_from: new Date().toISOString().split('T')[0],
};

export function CreditoPresumidoManager() {
  const { regras, isLoading, createRegra, updateRegra, deactivateRegra } = useCreditoPresumido();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (regra: any) => {
    setEditingId(regra.id);
    setFormData({
      codigo: regra.codigo,
      nome: regra.nome,
      descricao: regra.descricao || '',
      tributo: regra.tributo,
      percentual_credito: regra.percentual_credito,
      aplica_por_adquirente: regra.aplica_por_adquirente ?? false,
      tipos_adquirente_text: (regra.tipos_adquirente || []).join(', '),
      aplica_por_operacao: regra.aplica_por_operacao ?? false,
      tipos_operacao_text: (regra.tipos_operacao || []).join(', '),
      aplica_por_ncm: regra.aplica_por_ncm ?? false,
      ncms_aplicaveis_text: (regra.ncms_aplicaveis || []).join(', '),
      aplica_por_regiao: regra.aplica_por_regiao ?? false,
      ufs_aplicaveis_text: (regra.ufs_aplicaveis || []).join(', '),
      base_legal: regra.base_legal || '',
      valid_from: regra.valid_from,
      valid_until: regra.valid_until,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || !formData.nome) {
      toast.error('Código e nome são obrigatórios');
      return;
    }

    const payload = {
      codigo: formData.codigo,
      nome: formData.nome,
      descricao: formData.descricao || undefined,
      tributo: formData.tributo,
      percentual_credito: formData.percentual_credito,
      aplica_por_adquirente: formData.aplica_por_adquirente,
      tipos_adquirente: formData.tipos_adquirente_text ? formData.tipos_adquirente_text.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      aplica_por_operacao: formData.aplica_por_operacao,
      tipos_operacao: formData.tipos_operacao_text ? formData.tipos_operacao_text.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      aplica_por_ncm: formData.aplica_por_ncm,
      ncms_aplicaveis: formData.ncms_aplicaveis_text ? formData.ncms_aplicaveis_text.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      aplica_por_regiao: formData.aplica_por_regiao,
      ufs_aplicaveis: formData.ufs_aplicaveis_text ? formData.ufs_aplicaveis_text.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      base_legal: formData.base_legal || undefined,
      valid_from: formData.valid_from,
      valid_until: formData.valid_until,
    };

    try {
      if (editingId) {
        await updateRegra({ id: editingId, ...payload });
      } else {
        await createRegra(payload);
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
          Regras de crédito presumido com aplicação condicional (por adquirente, operação, NCM ou região). Não é atributo fixo do produto.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Regra' : 'Nova Regra de Crédito Presumido'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Código *</Label>
                  <Input value={formData.codigo} onChange={e => setFormData(p => ({ ...p, codigo: e.target.value }))} placeholder="CP-001" />
                </div>
                <div>
                  <Label>Nome *</Label>
                  <Input value={formData.nome} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} placeholder="Créd. Presumido SN" />
                </div>
                <div>
                  <Label>Tributo</Label>
                  <Select value={formData.tributo} onValueChange={v => setFormData(p => ({ ...p, tributo: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cbs">CBS</SelectItem>
                      <SelectItem value="ibs">IBS</SelectItem>
                      <SelectItem value="ambos">CBS + IBS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea value={formData.descricao} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))} rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Percentual do Crédito (%)</Label>
                  <Input type="number" step="0.01" value={formData.percentual_credito} onChange={e => setFormData(p => ({ ...p, percentual_credito: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Base Legal</Label>
                  <Input value={formData.base_legal} onChange={e => setFormData(p => ({ ...p, base_legal: e.target.value }))} />
                </div>
              </div>

              {/* Condições de aplicação */}
              <div className="space-y-3 border rounded-lg p-4">
                <h4 className="text-sm font-medium">Condições de Aplicação</h4>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.aplica_por_adquirente} onCheckedChange={v => setFormData(p => ({ ...p, aplica_por_adquirente: v }))} />
                    <Label>Por tipo de adquirente</Label>
                  </div>
                  {formData.aplica_por_adquirente && (
                    <Input value={formData.tipos_adquirente_text} onChange={e => setFormData(p => ({ ...p, tipos_adquirente_text: e.target.value }))} placeholder="simples_nacional, produtor_rural" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.aplica_por_operacao} onCheckedChange={v => setFormData(p => ({ ...p, aplica_por_operacao: v }))} />
                    <Label>Por tipo de operação</Label>
                  </div>
                  {formData.aplica_por_operacao && (
                    <Input value={formData.tipos_operacao_text} onChange={e => setFormData(p => ({ ...p, tipos_operacao_text: e.target.value }))} placeholder="exportacao, zona_franca" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.aplica_por_ncm} onCheckedChange={v => setFormData(p => ({ ...p, aplica_por_ncm: v }))} />
                    <Label>Por NCM</Label>
                  </div>
                  {formData.aplica_por_ncm && (
                    <Input value={formData.ncms_aplicaveis_text} onChange={e => setFormData(p => ({ ...p, ncms_aplicaveis_text: e.target.value }))} placeholder="3923, 4819" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.aplica_por_regiao} onCheckedChange={v => setFormData(p => ({ ...p, aplica_por_regiao: v }))} />
                    <Label>Por UF/Região</Label>
                  </div>
                  {formData.aplica_por_regiao && (
                    <Input value={formData.ufs_aplicaveis_text} onChange={e => setFormData(p => ({ ...p, ufs_aplicaveis_text: e.target.value }))} placeholder="AM, RR, AP" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <Button type="submit">{editingId ? 'Salvar' : 'Criar Regra'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código / Nome</TableHead>
              <TableHead>Tributo</TableHead>
              <TableHead>Percentual</TableHead>
              <TableHead>Condições</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regras?.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.nome}</div>
                  <code className="text-xs text-muted-foreground">{r.codigo}</code>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.tributo === 'ambos' ? 'CBS + IBS' : r.tributo.toUpperCase()}</Badge>
                </TableCell>
                <TableCell className="font-mono">{r.percentual_credito}%</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.aplica_por_adquirente && <Badge variant="secondary" className="text-[10px]">Adquirente</Badge>}
                    {r.aplica_por_operacao && <Badge variant="secondary" className="text-[10px]">Operação</Badge>}
                    {r.aplica_por_ncm && <Badge variant="secondary" className="text-[10px]">NCM</Badge>}
                    {r.aplica_por_regiao && <Badge variant="secondary" className="text-[10px]">UF</Badge>}
                    {!r.aplica_por_adquirente && !r.aplica_por_operacao && !r.aplica_por_ncm && !r.aplica_por_regiao && (
                      <span className="text-xs text-muted-foreground">Incondicional</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.valid_from}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}>
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
                          <AlertDialogTitle>Desativar Regra</AlertDialogTitle>
                          <AlertDialogDescription>Desativar "{r.nome}"?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deactivateRegra(r.id)}>Desativar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!regras || regras.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma regra de crédito presumido cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
