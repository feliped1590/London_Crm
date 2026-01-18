import { Zap, MessageSquare, GitBranch, Settings, Clock, UserPlus, Flag } from 'lucide-react';

const blocks = [
  { type: 'trigger', label: 'Gatilho', icon: Zap, color: 'bg-yellow-500' },
  { type: 'message', label: 'Mensagem', icon: MessageSquare, color: 'bg-blue-500' },
  { type: 'condition', label: 'Condição', icon: GitBranch, color: 'bg-purple-500' },
  { type: 'action', label: 'Ação CRM', icon: Settings, color: 'bg-green-500' },
  { type: 'delay', label: 'Espera', icon: Clock, color: 'bg-orange-500' },
  { type: 'transfer', label: 'Transferir', icon: UserPlus, color: 'bg-cyan-500' },
  { type: 'end', label: 'Fim', icon: Flag, color: 'bg-red-500' },
];

export function BlockToolbar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-48 bg-background border-r p-4 space-y-2">
      <h3 className="font-semibold text-sm text-muted-foreground mb-4">BLOCOS</h3>
      {blocks.map((block) => (
        <div
          key={block.type}
          className="flex items-center gap-2 p-3 rounded-lg border bg-card cursor-grab hover:border-primary transition-colors"
          draggable
          onDragStart={(e) => onDragStart(e, block.type)}
        >
          <div className={`p-1.5 rounded ${block.color}`}>
            <block.icon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium">{block.label}</span>
        </div>
      ))}
    </div>
  );
}
