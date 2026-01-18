import { Handle, Position, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';

export function DelayNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card min-w-[150px] ${
        selected ? 'border-orange-500 shadow-lg' : 'border-orange-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-orange-500">
          <Clock className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-medium text-sm">{String(data.label) || 'Espera'}</div>
          <div className="text-xs text-muted-foreground">
            {data.wait_type === 'time' 
              ? `${data.timeout_minutes || 30} minutos` 
              : 'Aguardando resposta'}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-500 !w-3 !h-3"
      />
    </div>
  );
}
