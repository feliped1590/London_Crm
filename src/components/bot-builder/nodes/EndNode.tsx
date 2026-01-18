import { Handle, Position, NodeProps } from '@xyflow/react';
import { Flag } from 'lucide-react';

export function EndNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card min-w-[120px] ${
        selected ? 'border-red-500 shadow-lg' : 'border-red-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-red-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-red-500">
          <Flag className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-medium text-sm">{String(data.label) || 'Fim'}</div>
          <div className="text-xs text-muted-foreground">
            Encerrar fluxo
          </div>
        </div>
      </div>
    </div>
  );
}
