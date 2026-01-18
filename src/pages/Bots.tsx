import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, Plus, MoreVertical, Pencil, Copy, Trash2, Zap, Play } from 'lucide-react';
import { toast } from 'sonner';
import { BotFlow, TriggerType } from '@/types/bot';
import { useAuth } from '@/hooks/useAuth';

export default function Bots() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotDescription, setNewBotDescription] = useState('');
  const [newBotTriggerType, setNewBotTriggerType] = useState<TriggerType>('new_conversation');

  const { data: bots, isLoading } = useQuery({
    queryKey: ['bot-flows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bot_flows')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BotFlow[];
    },
  });

  const createBotMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('bot_flows')
        .insert({
          name: newBotName,
          description: newBotDescription,
          trigger_type: newBotTriggerType,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
      setIsCreateDialogOpen(false);
      setNewBotName('');
      setNewBotDescription('');
      toast.success('Bot criado com sucesso!');
      navigate(`/bots/${data.id}`);
    },
    onError: (error) => {
      console.error('Error creating bot:', error);
      toast.error('Erro ao criar bot');
    },
  });

  const toggleBotMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('bot_flows')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status do bot');
    },
  });

  const duplicateBotMutation = useMutation({
    mutationFn: async (bot: BotFlow) => {
      // Create new flow
      const { data: newFlow, error: flowError } = await supabase
        .from('bot_flows')
        .insert([{
          name: `${bot.name} (Cópia)`,
          description: bot.description,
          trigger_type: bot.trigger_type,
          trigger_config: bot.trigger_config as unknown as Record<string, unknown>,
          created_by: user?.id,
        }])
        .select()
        .single();
      
      if (flowError) throw flowError;

      // Copy nodes
      const { data: nodes } = await supabase
        .from('bot_flow_nodes')
        .select('*')
        .eq('flow_id', bot.id);
      
      if (nodes && nodes.length > 0) {
        for (const node of nodes) {
          await supabase.from('bot_flow_nodes').insert({
            flow_id: newFlow.id,
            node_type: node.node_type,
            node_id: node.node_id,
            position_x: node.position_x,
            position_y: node.position_y,
            config: node.config,
          });
        }
      }

      // Copy edges
      const { data: edges } = await supabase
        .from('bot_flow_edges')
        .select('*')
        .eq('flow_id', bot.id);
      
      if (edges && edges.length > 0) {
        for (const edge of edges) {
          await supabase.from('bot_flow_edges').insert({
            flow_id: newFlow.id,
            edge_id: edge.edge_id,
            source_node_id: edge.source_node_id,
            target_node_id: edge.target_node_id,
            source_handle: edge.source_handle,
            label: edge.label,
          });
        }
      }

      return newFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
      toast.success('Bot duplicado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao duplicar bot');
    },
  });

  const deleteBotMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bot_flows')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
      toast.success('Bot excluído com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir bot');
    },
  });

  const getTriggerLabel = (type: TriggerType) => {
    switch (type) {
      case 'new_conversation':
        return 'Nova conversa';
      case 'keyword':
        return 'Palavra-chave';
      case 'manual':
        return 'Manual';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bots</h1>
          <p className="text-muted-foreground">
            Crie e gerencie bots de automação para WhatsApp
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Bot
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : bots && bots.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <Card key={bot.id} className="relative group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{bot.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/bots/${bot.id}`)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateBotMutation.mutate(bot)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteBotMutation.mutate(bot.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2">
                  {bot.description || 'Sem descrição'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Zap className="h-3 w-3" />
                      {getTriggerLabel(bot.trigger_type)}
                    </Badge>
                    {bot.is_active && (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        <Play className="h-3 w-3 mr-1" />
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={bot.is_active}
                    onCheckedChange={(checked) =>
                      toggleBotMutation.mutate({ id: bot.id, is_active: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum bot criado</h3>
          <p className="text-muted-foreground text-center mb-4">
            Crie seu primeiro bot para automatizar o atendimento via WhatsApp
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Primeiro Bot
          </Button>
        </Card>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Bot</DialogTitle>
            <DialogDescription>
              Configure as informações básicas do seu bot de automação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Bot</Label>
              <Input
                id="name"
                value={newBotName}
                onChange={(e) => setNewBotName(e.target.value)}
                placeholder="Ex: Atendimento Inicial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={newBotDescription}
                onChange={(e) => setNewBotDescription(e.target.value)}
                placeholder="Descreva o objetivo deste bot..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trigger">Gatilho</Label>
              <Select
                value={newBotTriggerType}
                onValueChange={(value) => setNewBotTriggerType(value as TriggerType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_conversation">Nova conversa</SelectItem>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createBotMutation.mutate()}
              disabled={!newBotName || createBotMutation.isPending}
            >
              Criar e Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
