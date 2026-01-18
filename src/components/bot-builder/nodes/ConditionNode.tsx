import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export function ConditionNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card min-w-[150px] ${
        selected ? 'border-purple-500 shadow-lg' : 'border-purple-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-purple-500">
          <GitBranch className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-medium text-sm">{String(data.label) || 'Condição'}</div>
          <div className="text-xs text-muted-foreground">
            {data.condition_type === 'text_contains' 
              ? 'Texto contém' 
              : data.condition_type === 'variable_equals'
              ? 'Variável igual'
              : 'Resposta do botão'}
          </div>
        </div>
      </div>
      {/* Multiple outputs for conditions */}
      <div className="flex justify-between mt-3 px-2">
        <Handle
          type="source"
          position={Position.Bottom}
          id="yes"
          className="!bg-green-500 !w-3 !h-3 !relative !left-0 !transform-none"
          style={{ position: 'relative' }}
        />
        <span className="text-xs text-green-600">Sim</span>
        <span className="text-xs text-red-600">Não</span>
        <Handle
          type="source"
          position={Position.Bottom}
          id="no"
          className="!bg-red-500 !w-3 !h-3 !relative !right-0 !transform-none"
          style={{ position: 'relative' }}
        />
      </div>
    </div>
  );
}
