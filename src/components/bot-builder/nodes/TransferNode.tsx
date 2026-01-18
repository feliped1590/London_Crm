import { Handle, Position, NodeProps } from '@xyflow/react';
import { UserPlus } from 'lucide-react';

export function TransferNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card min-w-[150px] ${
        selected ? 'border-cyan-500 shadow-lg' : 'border-cyan-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-cyan-500">
          <UserPlus className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-medium text-sm">{String(data.label) || 'Transferir'}</div>
          <div className="text-xs text-muted-foreground">
            Para atendente humano
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !w-3 !h-3"
      />
    </div>
  );
}
