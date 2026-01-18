// Bot Flow Types

export type TriggerType = 'new_conversation' | 'keyword' | 'manual';

export type NodeType = 'trigger' | 'message' | 'condition' | 'action' | 'delay' | 'transfer' | 'end';

export type SessionStatus = 'active' | 'waiting_response' | 'completed' | 'transferred' | 'timeout';

export interface BotFlow {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TriggerConfig {
  keywords?: string[];
  channel?: string;
}

export interface BotFlowNode {
  id: string;
  flow_id: string;
  node_type: NodeType;
  node_id: string;
  position_x: number;
  position_y: number;
  config: NodeConfig;
  created_at: string;
  updated_at: string;
}

export interface BotFlowEdge {
  id: string;
  flow_id: string;
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string;
  label?: string;
  created_at: string;
}

// Node Configuration Types
export interface NodeConfig {
  // Common
  label?: string;
  
  // Trigger
  triggerType?: TriggerType;
  keywords?: string[];
  
  // Message
  text?: string;
  buttons?: MessageButton[];
  wait_response?: boolean;
  save_as?: string;
  
  // Condition
  condition_type?: 'button_response' | 'text_contains' | 'variable_equals';
  rules?: ConditionRule[];
  default_target?: string;
  
  // Action CRM
  action_type?: 'move_stage' | 'create_task' | 'add_tag' | 'update_field' | 'create_contact';
  stage?: string;
  tag?: string;
  task_title?: string;
  task_description?: string;
  field_name?: string;
  field_value?: string;
  
  // Delay
  wait_type?: 'response' | 'time';
  timeout_minutes?: number;
  reminder_message?: string;
  timeout_action?: 'end' | 'transfer' | 'reminder';
  
  // Transfer
  transfer_message?: string;
  assign_to?: string;
}

export interface MessageButton {
  label: string;
  value: string;
}

export interface ConditionRule {
  value: string;
  target_node: string;
}

export interface BotSession {
  id: string;
  flow_id: string;
  instance_id?: string;
  phone: string;
  current_node_id?: string;
  status: SessionStatus;
  contact_id?: string;
  company_id?: string;
  started_at: string;
  last_activity_at: string;
  completed_at?: string;
  transferred_to?: string;
  timeout_at?: string;
}

export interface BotSessionData {
  id: string;
  session_id: string;
  field_name: string;
  field_value?: string;
  collected_at: string;
}

// React Flow compatible types
export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeConfig & { label: string };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}
