import { Node } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { X, Trash2, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NodeConfig, MessageButton } from '@/types/bot';

interface NodePropertiesPanelProps {
  node: Node;
  onUpdate: (nodeId: string, data: NodeConfig) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export function NodePropertiesPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: NodePropertiesPanelProps) {
  const data = node.data as NodeConfig;

  const updateField = (field: string, value: unknown) => {
    onUpdate(node.id, { ...data, [field]: value });
  };

  const addButton = () => {
    const buttons = data.buttons || [];
    updateField('buttons', [...buttons, { label: '', value: '' }]);
  };

  const updateButton = (index: number, field: 'label' | 'value', value: string) => {
    const buttons = [...(data.buttons || [])];
    buttons[index] = { ...buttons[index], [field]: value };
    updateField('buttons', buttons);
  };

  const removeButton = (index: number) => {
    const buttons = (data.buttons || []).filter((_, i) => i !== index);
    updateField('buttons', buttons);
  };

  return (
    <div className="w-80 bg-background border-l p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Propriedades</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Label */}
        <div className="space-y-2">
          <Label>Nome do Bloco</Label>
          <Input
            value={data.label || ''}
            onChange={(e) => updateField('label', e.target.value)}
            placeholder="Nome do bloco"
          />
        </div>

        {/* Trigger Node */}
        {node.type === 'trigger' && (
          <>
            <div className="space-y-2">
              <Label>Tipo de Gatilho</Label>
              <Select
                value={data.triggerType || 'new_conversation'}
                onValueChange={(value) => updateField('triggerType', value)}
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
            {data.triggerType === 'keyword' && (
              <div className="space-y-2">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input
                  value={(data.keywords || []).join(', ')}
                  onChange={(e) =>
                    updateField(
                      'keywords',
                      e.target.value.split(',').map((k) => k.trim())
                    )
                  }
                  placeholder="oi, olá, bom dia"
                />
              </div>
            )}
          </>
        )}

        {/* Message Node */}
        {node.type === 'message' && (
          <>
            <div className="space-y-2">
              <Label>Texto da Mensagem</Label>
              <Textarea
                value={data.text || ''}
                onChange={(e) => updateField('text', e.target.value)}
                placeholder="Digite a mensagem..."
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Botões de Resposta</Label>
                <Button variant="outline" size="sm" onClick={addButton}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              {(data.buttons || []).map((button: MessageButton, index: number) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={button.label}
                    onChange={(e) => updateButton(index, 'label', e.target.value)}
                    placeholder="Texto"
                    className="flex-1"
                  />
                  <Input
                    value={button.value}
                    onChange={(e) => updateButton(index, 'value', e.target.value)}
                    placeholder="Valor"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeButton(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Label>Aguardar Resposta</Label>
              <Switch
                checked={data.wait_response || false}
                onCheckedChange={(checked) => updateField('wait_response', checked)}
              />
            </div>

            {data.wait_response && (
              <div className="space-y-2">
                <Label>Salvar resposta como</Label>
                <Input
                  value={data.save_as || ''}
                  onChange={(e) => updateField('save_as', e.target.value)}
                  placeholder="nome, empresa, necessidade..."
                />
              </div>
            )}
          </>
        )}

        {/* Condition Node */}
        {node.type === 'condition' && (
          <>
            <div className="space-y-2">
              <Label>Tipo de Condição</Label>
              <Select
                value={data.condition_type || 'button_response'}
                onValueChange={(value) => updateField('condition_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="button_response">Resposta do botão</SelectItem>
                  <SelectItem value="text_contains">Texto contém</SelectItem>
                  <SelectItem value="variable_equals">Variável igual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Conecte as saídas aos blocos correspondentes para cada condição.
            </p>
          </>
        )}

        {/* Action Node */}
        {node.type === 'action' && (
          <>
            <div className="space-y-2">
              <Label>Tipo de Ação</Label>
              <Select
                value={data.action_type || 'create_task'}
                onValueChange={(value) => updateField('action_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="move_stage">Mover etapa do funil</SelectItem>
                  <SelectItem value="create_task">Criar tarefa</SelectItem>
                  <SelectItem value="add_tag">Adicionar tag</SelectItem>
                  <SelectItem value="create_contact">Criar contato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {data.action_type === 'move_stage' && (
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select
                  value={data.stage || 'prospeccao'}
                  onValueChange={(value) => updateField('stage', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospeccao">Prospecção</SelectItem>
                    <SelectItem value="qualificacao">Qualificação</SelectItem>
                    <SelectItem value="proposta">Proposta</SelectItem>
                    <SelectItem value="negociacao">Negociação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {data.action_type === 'create_task' && (
              <>
                <div className="space-y-2">
                  <Label>Título da Tarefa</Label>
                  <Input
                    value={data.task_title || ''}
                    onChange={(e) => updateField('task_title', e.target.value)}
                    placeholder="Contatar lead"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={data.task_description || ''}
                    onChange={(e) => updateField('task_description', e.target.value)}
                    placeholder="Descrição da tarefa..."
                  />
                </div>
              </>
            )}

            {data.action_type === 'add_tag' && (
              <div className="space-y-2">
                <Label>Tag</Label>
                <Input
                  value={data.tag || ''}
                  onChange={(e) => updateField('tag', e.target.value)}
                  placeholder="lead_qualificado"
                />
              </div>
            )}
          </>
        )}

        {/* Delay Node */}
        {node.type === 'delay' && (
          <>
            <div className="space-y-2">
              <Label>Tipo de Espera</Label>
              <Select
                value={data.wait_type || 'response'}
                onValueChange={(value) => updateField('wait_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="response">Aguardar resposta</SelectItem>
                  <SelectItem value="time">Aguardar tempo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timeout (minutos)</Label>
              <Input
                type="number"
                value={data.timeout_minutes || 30}
                onChange={(e) => updateField('timeout_minutes', parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Ação no Timeout</Label>
              <Select
                value={data.timeout_action || 'end'}
                onValueChange={(value) => updateField('timeout_action', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="end">Encerrar fluxo</SelectItem>
                  <SelectItem value="reminder">Enviar lembrete</SelectItem>
                  <SelectItem value="transfer">Transferir</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {data.timeout_action === 'reminder' && (
              <div className="space-y-2">
                <Label>Mensagem de Lembrete</Label>
                <Textarea
                  value={data.reminder_message || ''}
                  onChange={(e) => updateField('reminder_message', e.target.value)}
                  placeholder="Ainda está aí?"
                />
              </div>
            )}
          </>
        )}

        {/* Transfer Node */}
        {node.type === 'transfer' && (
          <>
            <div className="space-y-2">
              <Label>Mensagem de Transferência</Label>
              <Textarea
                value={data.transfer_message || ''}
                onChange={(e) => updateField('transfer_message', e.target.value)}
                placeholder="Vou transferir você para um atendente..."
              />
            </div>
          </>
        )}

        {/* Delete Button */}
        {node.type !== 'trigger' && (
          <Button
            variant="destructive"
            className="w-full mt-4"
            onClick={() => onDelete(node.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir Bloco
          </Button>
        )}
      </div>
    </div>
  );
}
