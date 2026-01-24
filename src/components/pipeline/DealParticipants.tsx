import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, User, Eye, Edit2, Crown, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface DealParticipantsProps {
  dealId: string;
  ownerId: string | null;
  createdBy: string | null;
}

export function DealParticipants({ dealId, ownerId, createdBy }: DealParticipantsProps) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor'>('viewer');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [participantToRemove, setParticipantToRemove] = useState<string | null>(null);

  // Check if current user can manage participants
  const canManageParticipants = isAdmin || user?.id === ownerId || user?.id === createdBy;

  // Fetch participants
  const { data: participants, isLoading, refetch } = useQuery({
    queryKey: ['deal_participants', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_participants')
        .select('*, profiles:user_id(user_id, full_name)')
        .eq('deal_id', dealId);
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });

  // Fetch all users for adding
  const { data: allUsers } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Get owner and creator names
  const ownerProfile = allUsers?.find((p) => p.user_id === ownerId);
  const creatorProfile = allUsers?.find((p) => p.user_id === createdBy);

  // Filter out users who are already participants, owners, or creators
  const availableUsers = allUsers?.filter((u) => {
    if (u.user_id === ownerId || u.user_id === createdBy) return false;
    return !participants?.some((p) => p.user_id === u.user_id);
  });

  const addParticipantMutation = useMutation({
    mutationFn: async () => {
      // Verify the user profile exists before adding
      const selectedProfile = allUsers?.find((u) => u.user_id === selectedUserId);
      if (!selectedProfile) {
        throw new Error('Usuário não encontrado');
      }
      
      const { error } = await supabase.from('deal_participants').insert({
        deal_id: dealId,
        user_id: selectedUserId,
        role: selectedRole,
        added_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate both queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['deal_participants', dealId] });
      queryClient.invalidateQueries({ queryKey: ['all_profiles'] });
      // Force immediate refetch
      refetch();
      toast.success('Participante adicionado!');
      setIsAddDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('viewer');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao adicionar participante'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ participantId, role }: { participantId: string; role: 'viewer' | 'editor' }) => {
      const { error } = await supabase
        .from('deal_participants')
        .update({ role })
        .eq('id', participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal_participants', dealId] });
      refetch();
      toast.success('Permissão atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar permissão'),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase
        .from('deal_participants')
        .delete()
        .eq('id', participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal_participants', dealId] });
      refetch();
      toast.success('Participante removido!');
      setDeleteConfirmOpen(false);
      setParticipantToRemove(null);
    },
    onError: () => toast.error('Erro ao remover participante'),
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Participantes do Negócio</h3>
        {canManageParticipants && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className="gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            Adicionar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Owner */}
          {ownerProfile && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(ownerProfile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{ownerProfile.full_name}</p>
                </div>
              </div>
              <Badge variant="default" className="gap-1">
                <Crown className="h-3 w-3" />
                Responsável
              </Badge>
            </div>
          )}

          {/* Creator (if different from owner) */}
          {creatorProfile && createdBy !== ownerId && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                    {getInitials(creatorProfile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{creatorProfile.full_name}</p>
                </div>
              </div>
              <Badge variant="secondary">Criador</Badge>
            </div>
          )}

          {/* Participants */}
          {participants?.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between p-2 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials((participant.profiles as any)?.full_name || '?')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{(participant.profiles as any)?.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManageParticipants ? (
                  <Select
                    value={participant.role}
                    onValueChange={(value: 'viewer' | 'editor') =>
                      updateRoleMutation.mutate({ participantId: participant.id, role: value })
                    }
                  >
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" />
                          Visualizar
                        </div>
                      </SelectItem>
                      <SelectItem value="editor">
                        <div className="flex items-center gap-1.5">
                          <Edit2 className="h-3.5 w-3.5" />
                          Editar
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    {participant.role === 'viewer' ? (
                      <>
                        <Eye className="h-3 w-3" /> Visualizar
                      </>
                    ) : (
                      <>
                        <Edit2 className="h-3 w-3" /> Editar
                      </>
                    )}
                  </Badge>
                )}
                {canManageParticipants && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setParticipantToRemove(participant.id);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {(!participants || participants.length === 0) && !ownerProfile && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhum participante adicionado.
            </div>
          )}
        </div>
      )}

      {/* Add Participant Dialog */}
      <AlertDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar Participante</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione um usuário para adicionar como participante deste negócio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Usuário</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers?.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Permissão</label>
              <Select value={selectedRole} onValueChange={(v: 'viewer' | 'editor') => setSelectedRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      Visualizar - Pode ver o negócio
                    </div>
                  </SelectItem>
                  <SelectItem value="editor">
                    <div className="flex items-center gap-1.5">
                      <Edit2 className="h-3.5 w-3.5" />
                      Editar - Pode modificar o negócio
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => addParticipantMutation.mutate()}
              disabled={!selectedUserId || addParticipantMutation.isPending}
            >
              Adicionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Participante</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este participante do negócio? Ele perderá o acesso a este negócio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => participantToRemove && removeParticipantMutation.mutate(participantToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
