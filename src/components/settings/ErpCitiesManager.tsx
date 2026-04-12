import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ErpCity {
  id: string;
  nome: string;
  uf: string;
  codigo_erp: number;
}

export function ErpCitiesManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<ErpCity | null>(null);
  const [nome, setNome] = useState('');
  const [uf, setUf] = useState('');
  const [codigoErp, setCodigoErp] = useState('');
  const [search, setSearch] = useState('');
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const resolveTenant = async () => {
      if (!user?.id) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('id', user.id)
        .single();
      let tid = profile?.active_tenant_id;
      if (!tid) {
        const { data: ut } = await (supabase as any)
          .from('user_tenants')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        tid = ut?.tenant_id;
      }
      setTenantId(tid || null);
    };
    resolveTenant();
  }, [user?.id]);

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['erp-cities'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('erp_cities')
        .select('*')
        .order('uf')
        .order('nome');
      if (error) throw error;
      return data as ErpCity[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (city: { id?: string; nome: string; uf: string; codigo_erp: number }) => {
      if (city.id) {
        const { error } = await (supabase as any)
          .from('erp_cities')
          .update({ nome: city.nome, uf: city.uf, codigo_erp: city.codigo_erp })
          .eq('id', city.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('erp_cities')
          .insert({ nome: city.nome, uf: city.uf, codigo_erp: city.codigo_erp });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-cities'] });
      toast.success(editingCity ? 'Cidade atualizada!' : 'Cidade adicionada!');
      closeDialog();
    },
    onError: (err: any) => {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('erp_cities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-cities'] });
      toast.success('Cidade removida!');
    },
  });

  const openNew = () => {
    setEditingCity(null);
    setNome('');
    setUf('');
    setCodigoErp('');
    setDialogOpen(true);
  };

  const openEdit = (city: ErpCity) => {
    setEditingCity(city);
    setNome(city.nome);
    setUf(city.uf);
    setCodigoErp(String(city.codigo_erp));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCity(null);
  };

  const handleSave = () => {
    if (!nome.trim() || !uf.trim() || !codigoErp.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    upsertMutation.mutate({
      id: editingCity?.id,
      nome: nome.trim(),
      uf: uf.trim().toUpperCase(),
      codigo_erp: Number(codigoErp),
    });
  };

  const filtered = cities.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.uf.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Buscar cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button size="sm" onClick={openNew} className="gap-1">
          <Plus className="h-4 w-4" /> Nova Cidade
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cidade</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Código ERP</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((city) => (
              <TableRow key={city.id}>
                <TableCell>{city.nome}</TableCell>
                <TableCell>{city.uf}</TableCell>
                <TableCell>{city.codigo_erp}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(city)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(city.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  Nenhuma cidade cadastrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCity ? 'Editar Cidade' : 'Nova Cidade ERP'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Cidade</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: São Paulo" />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={uf} onChange={(e) => setUf(e.target.value)} placeholder="Ex: SP" maxLength={2} />
            </div>
            <div>
              <Label>Código ERP</Label>
              <Input type="number" value={codigoErp} onChange={(e) => setCodigoErp(e.target.value)} placeholder="Ex: 1234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
