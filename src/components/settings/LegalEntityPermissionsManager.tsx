import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Building2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { formatCNPJ } from '@/lib/cpfCnpjMask';

interface UserWithLinks {
  user_id: string;
  full_name: string;
  links: Array<{
    id: string;
    legal_entity_id: string;
    role: string;
    entity_name: string;
    entity_cnpj: string;
  }>;
}

export function LegalEntityPermissionsManager() {
  const queryClient = useQueryClient();
  const { allEntities } = useLegalEntities();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');

  // Fetch all profiles in tenant
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_for_legal_entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all user_legal_entities links
  const { data: allLinks = [] } = useQuery({
    queryKey: ['all_user_legal_entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_legal_entities')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Build user-centric view
  const usersWithLinks: UserWithLinks[] = profiles.map((p) => {
    const links = allLinks
      .filter((l) => l.user_id === p.user_id)
      .map((l) => {
        const entity = allEntities.find((e) => e.id === l.legal_entity_id);
        return {
          id: l.id,
          legal_entity_id: l.legal_entity_id,
          role: l.role || 'member',
          entity_name: entity?.name || '—',
          entity_cnpj: entity?.cnpj || '',
        };
      });
    return {
      user_id: p.user_id,
      full_name: p.full_name || 'Sem nome',
      links,
    };
  });

  const addLinkMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('user_id', selectedUserId)
        .single();
      
      const { error } = await supabase.from('user_legal_entities').insert([{
        user_id: selectedUserId,
        legal_entity_id: selectedEntityId,
        role: selectedRole,
        tenant_id: profile?.active_tenant_id || '',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_legal_entities'] });
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities'] });
      toast.success('Vínculo criado');
      setIsAddOpen(false);
      setSelectedUserId('');
      setSelectedEntityId('');
      setSelectedRole('member');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao criar vínculo'),
  });

  const removeLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('user_legal_entities')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_legal_entities'] });
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities'] });
      toast.success('Vínculo removido');
    },
    onError: () => toast.error('Erro ao remover vínculo'),
  });

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    member: 'Membro',
    viewer: 'Visualizador',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Permissões por CNPJ
          </CardTitle>
          <CardDescription>
            Gerencie quais usuários têm acesso a cada CNPJ. Usuários sem vínculos têm acesso total.
          </CardDescription>
        </div>
        <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Vincular CNPJ
        </Button>
      </CardHeader>
      <CardContent>
        {allEntities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum CNPJ cadastrado. Cadastre entidades jurídicas para gerenciar permissões.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>CNPJs Vinculados</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersWithLinks.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>
                    {u.links.length === 0 ? (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Acesso total
                      </Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {u.links.map((link) => (
                          <div key={link.id} className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {link.entity_name} ({roleLabels[link.role] || link.role})
                            </Badge>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5">
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O usuário {u.full_name} perderá acesso restrito ao CNPJ {link.entity_name}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeLinkMutation.mutate(link.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUserId(u.user_id);
                        setIsAddOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Link Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Usuário a CNPJ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o usuário" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CNPJ</Label>
              <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o CNPJ" />
                </SelectTrigger>
                <SelectContent>
                  {allEntities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} — {formatCNPJ(e.cnpj)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addLinkMutation.mutate()}
              disabled={!selectedUserId || !selectedEntityId || addLinkMutation.isPending}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
