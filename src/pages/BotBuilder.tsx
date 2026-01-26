import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Zap,
  MessageSquare,
  GitBranch,
  Settings,
  Clock,
  UserPlus,
  Flag,
} from 'lucide-react';
import { BotFlow, BotFlowNode, BotFlowEdge, NodeConfig } from '@/types/bot';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';

// Custom Node Components
import { TriggerNode } from '@/components/bot-builder/nodes/TriggerNode';
import { MessageNode } from '@/components/bot-builder/nodes/MessageNode';
import { ConditionNode } from '@/components/bot-builder/nodes/ConditionNode';
import { ActionNode } from '@/components/bot-builder/nodes/ActionNode';
import { DelayNode } from '@/components/bot-builder/nodes/DelayNode';
import { TransferNode } from '@/components/bot-builder/nodes/TransferNode';
import { EndNode } from '@/components/bot-builder/nodes/EndNode';
import { NodePropertiesPanel } from '@/components/bot-builder/NodePropertiesPanel';
import { BlockToolbar } from '@/components/bot-builder/BlockToolbar';

const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  transfer: TransferNode,
  end: EndNode,
};

export default function BotBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [botName, setBotName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch bot flow
  const { data: botFlow, isLoading: isLoadingFlow } = useQuery({
    queryKey: ['bot-flow', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bot_flows')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as BotFlow;
    },
    enabled: !!id,
  });

  // Fetch nodes
  const { data: flowNodes, isLoading: isLoadingNodes } = useQuery({
    queryKey: ['bot-flow-nodes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bot_flow_nodes')
        .select('*')
        .eq('flow_id', id);
      
      if (error) throw error;
      return data as BotFlowNode[];
    },
    enabled: !!id,
  });

  // Fetch edges
  const { data: flowEdges, isLoading: isLoadingEdges } = useQuery({
    queryKey: ['bot-flow-edges', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bot_flow_edges')
        .select('*')
        .eq('flow_id', id);
      
      if (error) throw error;
      return data as BotFlowEdge[];
    },
    enabled: !!id,
  });

  // Initialize nodes and edges when data loads
  useEffect(() => {
    if (botFlow) {
      setBotName(botFlow.name);
    }
  }, [botFlow]);

  useEffect(() => {
    if (flowNodes) {
      const initialNodes: Node[] = flowNodes.map((node) => ({
        id: node.node_id,
        type: node.node_type,
        position: { x: Number(node.position_x), y: Number(node.position_y) },
        data: { ...node.config, label: (node.config as NodeConfig).label || getDefaultLabel(node.node_type) },
      }));
      setNodes(initialNodes);
    } else if (!isLoadingNodes && id) {
      // Create default trigger node for new flows
      setNodes([
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 250, y: 50 },
          data: { label: 'Início', triggerType: 'new_conversation' },
        },
      ]);
    }
  }, [flowNodes, isLoadingNodes, id, setNodes]);

  useEffect(() => {
    if (flowEdges) {
      const initialEdges: Edge[] = flowEdges.map((edge) => ({
        id: edge.edge_id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        sourceHandle: edge.source_handle || undefined,
        label: edge.label || undefined,
      }));
      setEdges(initialEdges);
    }
  }, [flowEdges, setEdges]);

  const getDefaultLabel = (type: string) => {
    switch (type) {
      case 'trigger': return 'Início';
      case 'message': return 'Mensagem';
      case 'condition': return 'Condição';
      case 'action': return 'Ação CRM';
      case 'delay': return 'Espera';
      case 'transfer': return 'Transferir';
      case 'end': return 'Fim';
      default: return 'Bloco';
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      setHasChanges(true);
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = {
        x: event.clientX - 250,
        y: event.clientY - 100,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: getDefaultLabel(type) },
      };

      setNodes((nds) => [...nds, newNode]);
      setHasChanges(true);
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const updateNodeData = useCallback(
    (nodeId: string, newData: NodeConfig) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...newData } };
          }
          return node;
        })
      );
      setHasChanges(true);
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      setSelectedNode(null);
      setHasChanges(true);
    },
    [setNodes, setEdges]
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No flow ID');

      // Update flow name
      await supabase
        .from('bot_flows')
        .update({ name: botName })
        .eq('id', id);

      // Delete existing nodes and edges
      await supabase.from('bot_flow_nodes').delete().eq('flow_id', id);
      await supabase.from('bot_flow_edges').delete().eq('flow_id', id);

      // Insert new nodes
      if (nodes.length > 0) {
        const nodesToInsert = nodes.map((node) => ({
          flow_id: id,
          node_type: node.type || 'message',
          node_id: node.id,
          position_x: node.position.x,
          position_y: node.position.y,
          config: node.data,
        }));
        
        const { error: nodesError } = await supabase
          .from('bot_flow_nodes')
          .insert(nodesToInsert);
        
        if (nodesError) throw nodesError;
      }

      // Insert new edges
      if (edges.length > 0) {
        const edgesToInsert = edges.map((edge) => ({
          flow_id: id,
          edge_id: edge.id,
          source_node_id: edge.source,
          target_node_id: edge.target,
          source_handle: edge.sourceHandle,
          label: typeof edge.label === 'string' ? edge.label : undefined,
        }));
        
        const { error: edgesError } = await supabase
          .from('bot_flow_edges')
          .insert(edgesToInsert);
        
        if (edgesError) throw edgesError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow', id] });
      queryClient.invalidateQueries({ queryKey: ['bot-flow-nodes', id] });
      queryClient.invalidateQueries({ queryKey: ['bot-flow-edges', id] });
      setHasChanges(false);
      toast.success('Fluxo salvo com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving flow:', error);
      toast.error('Erro ao salvar fluxo');
    },
  });

  if (isLoadingFlow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Under Development Banner */}
      <div className="px-4 pt-4">
        <UnderDevelopmentBanner 
          compact
          description="O editor visual de bots está em desenvolvimento."
        />
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/bots')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={botName}
            onChange={(e) => {
              setBotName(e.target.value);
              setHasChanges(true);
            }}
            className="w-64 font-semibold"
          />
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {hasChanges ? 'Salvar Alterações' : 'Salvo'}
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 flex">
        {/* Block Toolbar */}
        <BlockToolbar />

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => {
              onNodesChange(changes);
              setHasChanges(true);
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              setHasChanges(true);
            }}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            className="bg-muted/30"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls />
            <MiniMap 
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <NodePropertiesPanel
            node={selectedNode}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
