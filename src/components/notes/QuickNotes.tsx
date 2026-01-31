import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Loader2, StickyNote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface QuickNotesProps {
  entityType: 'deal' | 'contact' | 'company';
  entityId: string;
  className?: string;
}

interface NoteWithProfile {
  id: string;
  content: string;
  created_at: string;
  created_by: string | null;
  creator_name?: string;
  creator_initials?: string;
}

export function QuickNotes({ entityType, entityId, className }: QuickNotesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');

  // Fetch notes
  const { data: notes, isLoading } = useQuery({
    queryKey: ['entity_notes', entityType, entityId],
    queryFn: async () => {
      const { data: notesData, error } = await supabase
        .from('entity_notes')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch profiles for creators
      const creatorIds = [...new Set(notesData.map(n => n.created_by).filter(Boolean))];
      let profiles: Record<string, { full_name: string }> = {};
      
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        
        profiles = (profilesData || []).reduce((acc, p) => {
          acc[p.user_id] = { full_name: p.full_name };
          return acc;
        }, {} as Record<string, { full_name: string }>);
      }

      // Merge notes with profile data
      return notesData.map(note => {
        const profile = note.created_by ? profiles[note.created_by] : null;
        const name = profile?.full_name || 'Usuário';
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        return {
          ...note,
          creator_name: name,
          creator_initials: initials,
        } as NoteWithProfile;
      });
    },
    enabled: !!entityId,
  });

  // Create note mutation
  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('entity_notes').insert({
        entity_type: entityType,
        entity_id: entityId,
        content,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity_notes', entityType, entityId] });
      setNewNote('');
      toast.success('Nota adicionada');
    },
    onError: () => {
      toast.error('Erro ao adicionar nota');
    },
  });

  // Delete note mutation
  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('entity_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity_notes', entityType, entityId] });
      toast.success('Nota removida');
    },
    onError: () => {
      toast.error('Erro ao remover nota');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    createMutation.mutate(newNote.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (newNote.trim()) {
        createMutation.mutate(newNote.trim());
      }
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* New note input */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Adicionar uma nota rápida... (Ctrl+Enter para enviar)"
            className="min-h-[80px] resize-none"
          />
        </div>
        <div className="flex justify-end mt-2">
          <Button 
            type="submit" 
            size="sm"
            disabled={!newNote.trim() || createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Adicionar
          </Button>
        </div>
      </form>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notes && notes.length > 0 ? (
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-3">
            {notes.map((note) => (
              <div 
                key={note.id} 
                className="group relative bg-muted/50 rounded-lg p-3 border border-border/50"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {note.creator_initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{note.creator_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {note.content}
                    </p>
                  </div>
                  
                  {/* Delete button - only show for note creator */}
                  {note.created_by === user?.id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover nota?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(note.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
          <StickyNote className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma nota ainda</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Use notas para registrar informações importantes
          </p>
        </div>
      )}
    </div>
  );
}
