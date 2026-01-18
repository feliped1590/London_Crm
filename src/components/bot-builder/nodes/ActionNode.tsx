import { Handle, Position, NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';

export function ActionNode({ data, selected }: NodeProps) {
  const getActionLabel = () => {
    switch (data.action_type) {
      case 'move_stage': return `Mover para: ${data.stage || 'etapa'}`;
      case 'create_task': return data.task_title ? `Criar: ${data.task_title}` : 'Criar tarefa';
      case 'add_tag': return data.tag ? `Tag: ${data.tag}` : 'Adicionar tag';
      case 'create_contact': return 'Criar contato';
      default: return 'Ação CRM';
    }
  };

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card min-w-[150px] ${
        selected ? 'border-green-500 shadow-lg' : 'border-green-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-green-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-green-500">
          <Settings className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-medium text-sm">{String(data.label) || 'Ação CRM'}</div>
          <div className="text-xs text-muted-foreground">{getActionLabel()}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-500 !w-3 !h-3"
      />
    </div>
  );
}
