import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface AIConfig {
  id: string;
  name: string;
  prompt: string;
  updated_at: string;
  updated_by: string | null;
}

const DEFAULT_PROMPT = `Você é um assistente de vendas do CRM. Ajude o usuário a:
- Entender métricas de vendas
- Sugerir próximas ações
- Responder dúvidas sobre clientes e negócios
- Fornecer insights sobre o pipeline

Seja conciso, profissional e proativo. Use dados do contexto quando disponíveis.`;

export function AIAssistantConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const initialDataRef = useRef<AIConfig | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['ai-assistant-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_assistant_configs')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as AIConfig | null;
    },
  });

  useEffect(() => {
    if (config) {
      setName(config.name);
      setPrompt(config.prompt);
      initialDataRef.current = config;
    }
  }, [config]);

  useEffect(() => {
    if (initialDataRef.current) {
      const changed = 
        name !== initialDataRef.current.name || 
        prompt !== initialDataRef.current.prompt;
      setHasChanges(changed);
    }
  }, [name, prompt]);

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; prompt: string }) => {
      if (!config?.id) throw new Error('Configuração não encontrada');
      
      const { error } = await supabase
        .from('ai_assistant_configs')
        .update({
          name: data.name,
          prompt: data.prompt,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-assistant-config'] });
      toast.success('Configuração salva com sucesso!');
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar configuração');
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('O nome da assistente é obrigatório');
      return;
    }
    if (!prompt.trim()) {
      toast.error('O prompt é obrigatório');
      return;
    }
    updateMutation.mutate({ name, prompt });
  };

  const handleReset = () => {
    if (initialDataRef.current) {
      setName(initialDataRef.current.name);
      setPrompt(initialDataRef.current.prompt);
    }
  };

  const handleResetToDefault = () => {
    setPrompt(DEFAULT_PROMPT);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Configuração da Assistente IA
        </h2>
        <p className="text-sm text-muted-foreground">
          Personalize o nome e comportamento da assistente de IA
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
          <CardDescription>
            Defina como a assistente se apresenta aos usuários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assistant-name">Nome da Assistente</Label>
            <Input
              id="assistant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Qualybot"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Este nome aparecerá no chat e nas mensagens da assistente
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comportamento</CardTitle>
          <CardDescription>
            Configure o prompt de sistema que define como a assistente responde
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="system-prompt">Prompt de Sistema</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetToDefault}
                className="h-8 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Restaurar padrão
              </Button>
            </div>
            <Textarea
              id="system-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Digite as instruções para a assistente..."
              className="min-h-[250px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Este prompt define a personalidade, tom e comportamento da assistente.
              Seja específico sobre como ela deve responder e quais informações priorizar.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || updateMutation.isPending}
        >
          Cancelar alterações
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>
    </div>
  );
}
