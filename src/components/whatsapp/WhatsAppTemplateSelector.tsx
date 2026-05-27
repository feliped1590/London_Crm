import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WHATSAPP_ENABLED } from '@/config/features';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquareText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface WhatsAppTemplateSelectorProps {
  onSelect: (content: string) => void;
  className?: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  is_shared: boolean;
}

// Variables that can be replaced in templates
interface TemplateVariables {
  nome?: string;
  empresa?: string;
  negocio?: string;
  valor?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  geral: 'Geral',
  primeiro_contato: 'Primeiro Contato',
  follow_up: 'Follow-up',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  pos_venda: 'Pós-venda',
};

export function WhatsAppTemplateSelector({ 
  onSelect, 
  className,
}: WhatsAppTemplateSelectorProps) {
  const [search, setSearch] = useState('');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['whatsapp_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
    enabled: WHATSAPP_ENABLED,
  });

  const filteredTemplates = templates?.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.content.toLowerCase().includes(search.toLowerCase())
  );

  const groupedTemplates = filteredTemplates?.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, WhatsAppTemplate[]>);

  const handleSelect = (template: WhatsAppTemplate) => {
    // For now, just pass the raw content - variables will be replaced by the parent
    onSelect(template.content);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <div className={cn("text-center py-4", className)}>
        <MessageSquareText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum template disponível</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Crie templates em Configurações
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
      
      <ScrollArea className="h-[250px]">
        <div className="space-y-4 pr-3">
          {Object.entries(groupedTemplates || {}).map(([category, categoryTemplates]) => (
            <div key={category}>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {CATEGORY_LABELS[category] || category}
              </p>
              <div className="space-y-1">
                {categoryTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelect(template)}
                    className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{template.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 pl-6">
                      {template.content}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
