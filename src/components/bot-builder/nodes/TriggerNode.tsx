import { Handle, Position, NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';

export function TriggerNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card min-w-[150px] ${
        selected ? 'border-yellow-500 shadow-lg' : 'border-yellow-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-yellow-500">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-medium text-sm">{String(data.label) || 'Início'}</div>
          <div className="text-xs text-muted-foreground">
            {data.triggerType === 'keyword' ? 'Palavra-chave' : 'Nova conversa'}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-yellow-500 !w-3 !h-3"
      />
    </div>
  );
}
