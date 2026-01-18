import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';

export function MessageNode({ data, selected }: NodeProps) {
  const buttons = data.buttons as Array<{ label: string; value: string }> | undefined;
  
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card min-w-[180px] max-w-[250px] ${
        selected ? 'border-blue-500 shadow-lg' : 'border-blue-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3 !h-3"
      />
      <div className="flex items-start gap-2">
        <div className="p-1.5 rounded bg-blue-500 shrink-0">
          <MessageSquare className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm">{String(data.label) || 'Mensagem'}</div>
          {data.text && (
            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {String(data.text)}
            </div>
          )}
          {buttons && buttons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {buttons.map((btn, i) => (
                <span
                  key={i}
                  className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded"
                >
                  {btn.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3"
      />
    </div>
  );
}
