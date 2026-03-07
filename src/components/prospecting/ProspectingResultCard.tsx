import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Factory, 
  UserPlus, 
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { ProspectingResult } from '@/hooks/useProspecting';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';

interface ProspectingResultCardProps {
  result: ProspectingResult;
  resultId?: string;
  onSaveLead: (params: {
    resultId: string;
    ownerId?: string;
    createTask?: boolean;
    taskTitle?: string;
    taskDueDate?: string;
  }) => void;
  isSaving: boolean;
}

export function ProspectingResultCard({ result, resultId, onSaveLead, isSaving }: ProspectingResultCardProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [createTask, setCreateTask] = useState(true);
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));

  // Buscar vendedores
  const { data: sellers } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
  });

  const handleSave = () => {
    if (!resultId) return;
    
    onSaveLead({
      resultId,
      ownerId: selectedOwner || undefined,
      createTask,
      taskTitle: createTask ? `Primeiro contato - ${result.razao_social}` : undefined,
      taskDueDate: createTask ? taskDueDate : undefined,
    });
    
    setShowSaveDialog(false);
  };

  const formatCnpj = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, '');
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  return (
    <>
      <Card className={result.already_exists ? 'border-amber-300 bg-amber-50/50' : ''}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {result.razao_social}
              </CardTitle>
              {result.nome_fantasia && (
                <p className="text-sm text-muted-foreground mt-1">
                  {result.nome_fantasia}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {result.already_exists ? (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Já cadastrada
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Novo lead
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informações */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">CNPJ</p>
              <p className="font-mono">{formatCnpj(result.cnpj)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Localização
              </p>
              <p>{result.cidade}/{result.estado}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <Factory className="h-3 w-3" /> Porte
              </p>
              <p>{result.porte || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Abertura
              </p>
              <p>{result.data_abertura || 'Não informada'}</p>
            </div>
          </div>

          {/* CNAE */}
          {result.cnae_descricao && (
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Atividade Principal (CNAE)</p>
              <p className="text-xs">{result.cnae_principal} - {result.cnae_descricao}</p>
            </div>
          )}

          {/* Situação cadastral */}
          <div className="flex items-center justify-between">
            <Badge 
              variant={result.situacao_cadastral?.toLowerCase().includes('ativa') ? 'default' : 'secondary'}
              className="text-xs"
            >
              {result.situacao_cadastral || 'Situação desconhecida'}
            </Badge>

            {/* Ações */}
            <div className="flex gap-2">
              {result.already_exists && result.existing_company_id ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/customers/${result.existing_company_id}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ver cadastro
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={isSaving || !resultId}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-1" />
                  )}
                  Salvar como Lead
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para salvar lead */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar como Lead</DialogTitle>
            <DialogDescription>
              A empresa será cadastrada no CRM como um novo lead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{result.razao_social}</p>
              <p className="text-sm text-muted-foreground">CNPJ: {formatCnpj(result.cnpj)}</p>
            </div>

            {/* Atribuir vendedor */}
            <div className="space-y-2">
              <Label htmlFor="owner">Atribuir a vendedor</Label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Eu mesmo' },
                  ...(sellers || []).map(s => ({ value: s.user_id, label: s.full_name })),
                ]}
                value={selectedOwner || null}
                onChange={(v) => setSelectedOwner(v || '')}
                placeholder="Eu mesmo (padrão)"
                searchPlaceholder="Buscar vendedor..."
                allowClear={false}
              />
            </div>

            {/* Criar tarefa */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="createTask">Criar tarefa de primeiro contato</Label>
                <p className="text-xs text-muted-foreground">
                  Uma tarefa será atribuída ao vendedor responsável
                </p>
              </div>
              <Switch
                id="createTask"
                checked={createTask}
                onCheckedChange={setCreateTask}
              />
            </div>

            {/* Data da tarefa */}
            {createTask && (
              <div className="space-y-2">
                <Label htmlFor="taskDueDate">Data limite da tarefa</Label>
                <Input
                  id="taskDueDate"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Salvar Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
