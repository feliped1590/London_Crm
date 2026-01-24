// Dashboard Widget Types

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'number' | 'list' | 'custom';

export type MetricType = 
  // Deals
  | 'pipeline_total'
  | 'deals_won'
  | 'deals_lost'
  | 'win_rate'
  | 'deals_by_stage'
  | 'deals_by_month'
  // Tasks
  | 'tasks_completion'
  | 'tasks_by_status'
  | 'tasks_by_priority'
  | 'tasks_pending'
  | 'tasks_overdue'
  // Companies/Contacts
  | 'companies_count'
  | 'contacts_count'
  // Proposals
  | 'proposals_sent'
  | 'proposals_approved'
  | 'proposals_conversion'
  | 'proposals_by_status'
  | 'proposals_pending'
  // Orders
  | 'orders_pending'
  | 'orders_by_status'
  | 'orders_value'
  | 'orders_by_month'
  | 'orders_in_production'
  // WhatsApp
  | 'whatsapp_messages'
  | 'whatsapp_conversations'
  // Products
  | 'products_count'
  | 'top_products'
  // Special widgets for dashboard sections
  | 'recent_deals'
  | 'upcoming_tasks'
  | 'insights_summary';

export interface DashboardWidget {
  id: string;
  type: MetricType;
  chartType: ChartType;
  title: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  position: number;
}

export interface DashboardConfig {
  id: string;
  user_id: string;
  name: string;
  widgets: DashboardWidget[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetricDefinition {
  type: MetricType;
  label: string;
  description: string;
  category: 'deals' | 'tasks' | 'contacts' | 'proposals' | 'orders' | 'whatsapp' | 'products' | 'special';
  supportedCharts: ChartType[];
  defaultChart: ChartType;
  defaultSize: 'sm' | 'md' | 'lg' | 'xl';
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // Deals
  { type: 'pipeline_total', label: 'Pipeline Total', description: 'Valor total do pipeline ativo', category: 'deals', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'deals_won', label: 'Vendas Ganhas', description: 'Valor total de negócios ganhos', category: 'deals', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'deals_lost', label: 'Negócios Perdidos', description: 'Quantidade de negócios perdidos', category: 'deals', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'win_rate', label: 'Taxa de Conversão', description: 'Percentual de negócios ganhos', category: 'deals', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'deals_by_stage', label: 'Pipeline por Etapa', description: 'Distribuição de negócios por etapa', category: 'deals', supportedCharts: ['bar', 'pie'], defaultChart: 'bar', defaultSize: 'md' },
  { type: 'deals_by_month', label: 'Evolução de Negócios', description: 'Negócios criados e ganhos por mês', category: 'deals', supportedCharts: ['line', 'bar', 'area'], defaultChart: 'line', defaultSize: 'lg' },
  // Tasks
  { type: 'tasks_completion', label: 'Tarefas Concluídas', description: 'Taxa de conclusão de tarefas', category: 'tasks', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'tasks_by_status', label: 'Tarefas por Status', description: 'Distribuição de tarefas por status', category: 'tasks', supportedCharts: ['bar', 'pie'], defaultChart: 'pie', defaultSize: 'md' },
  { type: 'tasks_by_priority', label: 'Tarefas por Prioridade', description: 'Distribuição de tarefas por prioridade', category: 'tasks', supportedCharts: ['bar', 'pie'], defaultChart: 'bar', defaultSize: 'md' },
  { type: 'tasks_pending', label: 'Tarefas Pendentes', description: 'Quantidade de tarefas pendentes', category: 'tasks', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'tasks_overdue', label: 'Tarefas Atrasadas', description: 'Tarefas com prazo vencido', category: 'tasks', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  // Companies/Contacts
  { type: 'companies_count', label: 'Total de Empresas', description: 'Quantidade de empresas cadastradas', category: 'contacts', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'contacts_count', label: 'Total de Contatos', description: 'Quantidade de contatos cadastrados', category: 'contacts', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  // Proposals
  { type: 'proposals_sent', label: 'Propostas Enviadas', description: 'Total de propostas enviadas', category: 'proposals', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'proposals_approved', label: 'Propostas Aprovadas', description: 'Total de propostas aprovadas', category: 'proposals', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'proposals_conversion', label: 'Conversão de Propostas', description: 'Taxa de aprovação de propostas', category: 'proposals', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'proposals_by_status', label: 'Propostas por Status', description: 'Distribuição de propostas por status', category: 'proposals', supportedCharts: ['bar', 'pie'], defaultChart: 'pie', defaultSize: 'md' },
  { type: 'proposals_pending', label: 'Propostas Pendentes', description: 'Propostas aguardando resposta', category: 'proposals', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  // Orders
  { type: 'orders_pending', label: 'Pedidos Pendentes', description: 'Quantidade de pedidos pendentes', category: 'orders', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'orders_by_status', label: 'Pedidos por Status', description: 'Distribuição de pedidos por status', category: 'orders', supportedCharts: ['bar', 'pie'], defaultChart: 'bar', defaultSize: 'md' },
  { type: 'orders_value', label: 'Valor em Pedidos', description: 'Valor total dos pedidos', category: 'orders', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'orders_by_month', label: 'Pedidos por Mês', description: 'Evolução de pedidos por mês', category: 'orders', supportedCharts: ['line', 'bar', 'area'], defaultChart: 'line', defaultSize: 'lg' },
  { type: 'orders_in_production', label: 'Pedidos em Produção', description: 'Pedidos em andamento', category: 'orders', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  // WhatsApp
  { type: 'whatsapp_messages', label: 'Mensagens WhatsApp', description: 'Total de mensagens enviadas/recebidas', category: 'whatsapp', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'whatsapp_conversations', label: 'Conversas Ativas', description: 'Quantidade de conversas ativas', category: 'whatsapp', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  // Products
  { type: 'products_count', label: 'Produtos Ativos', description: 'Quantidade de produtos ativos', category: 'products', supportedCharts: ['number'], defaultChart: 'number', defaultSize: 'sm' },
  { type: 'top_products', label: 'Produtos Mais Vendidos', description: 'Top 5 produtos por quantidade', category: 'products', supportedCharts: ['bar', 'pie'], defaultChart: 'bar', defaultSize: 'md' },
  // Special widgets
  { type: 'recent_deals', label: 'Negócios Recentes', description: 'Últimos negócios criados', category: 'special', supportedCharts: ['list'], defaultChart: 'list', defaultSize: 'md' },
  { type: 'upcoming_tasks', label: 'Próximas Tarefas', description: 'Tarefas pendentes com prazo', category: 'special', supportedCharts: ['list'], defaultChart: 'list', defaultSize: 'md' },
  { type: 'insights_summary', label: 'Resumo de Alertas', description: 'Alertas e insights do negócio', category: 'special', supportedCharts: ['custom'], defaultChart: 'custom', defaultSize: 'xl' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  deals: 'Negócios',
  tasks: 'Tarefas',
  contacts: 'Empresas e Contatos',
  proposals: 'Propostas',
  orders: 'Pedidos',
  whatsapp: 'WhatsApp',
  products: 'Produtos',
  special: 'Especiais',
};

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Barras',
  line: 'Linhas',
  pie: 'Pizza',
  area: 'Área',
  number: 'Número',
  list: 'Lista',
  custom: 'Personalizado',
};

export const SIZE_LABELS: Record<string, string> = {
  sm: 'Pequeno (1 coluna)',
  md: 'Médio (2 colunas)',
  lg: 'Grande (3 colunas)',
  xl: 'Extra Grande (4 colunas)',
};
