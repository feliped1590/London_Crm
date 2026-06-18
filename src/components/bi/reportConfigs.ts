import type { ReportCode } from '@/hooks/useBIReports';

export type ColumnFormat = 'currency' | 'number' | 'percent' | 'date' | 'text';

export interface ReportConfig {
  /** Label da chave usada como eixo X / categoria no gráfico */
  chartLabelKey?: string;
  /** Quais colunas numéricas vão para o gráfico (ordem preservada) */
  chartValueKeys?: string[];
  /** Coluna para ordenação default (antes de plotar/listar) */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Limite de linhas no gráfico (resto continua na tabela) */
  topN?: number;
  /** Rótulos amigáveis das colunas (PT-BR) */
  columnLabels?: Record<string, string>;
  /** Override de formato por coluna */
  columnFormat?: Record<string, ColumnFormat>;
  /** Colunas a esconder da tabela */
  hiddenColumns?: string[];
  /** Ordem custom das colunas na tabela */
  columnOrder?: string[];
}

export const REPORT_CONFIGS: Partial<Record<ReportCode, ReportConfig>> = {
  vendas_cliente: {
    chartLabelKey: 'nome',
    chartValueKeys: ['valor_vendido'],
    sortBy: 'valor_vendido',
    sortDir: 'desc',
    topN: 20,
    columnLabels: {
      nome: 'Cliente',
      valor_vendido: 'Valor vendido',
      qtd_pedidos: 'Pedidos',
      ticket_medio: 'Ticket médio',
      ultima_compra: 'Última compra',
      posicao: '#',
      abc: 'Classe ABC',
    },
    columnOrder: ['posicao', 'nome', 'abc', 'valor_vendido', 'qtd_pedidos', 'ticket_medio', 'ultima_compra'],
  },
  vendas_vendedor: {
    chartLabelKey: 'nome',
    chartValueKeys: ['valor_vendido'],
    sortBy: 'valor_vendido',
    sortDir: 'desc',
    topN: 20,
    columnLabels: {
      nome: 'Vendedor',
      valor_vendido: 'Valor vendido',
      qtd_pedidos: 'Pedidos',
      ticket_medio: 'Ticket médio',
      qtd_clientes: 'Clientes',
    },
  },
  vendas_produto: {
    chartLabelKey: 'nome',
    chartValueKeys: ['valor_vendido'],
    sortBy: 'valor_vendido',
    sortDir: 'desc',
    topN: 20,
    columnLabels: {
      nome: 'Produto',
      sku: 'SKU',
      valor_vendido: 'Valor vendido',
      quantidade: 'Quantidade',
      participacao_pct: 'Participação %',
      familia: 'Família',
      grupo: 'Grupo',
    },
  },
  vendas_entidade: {
    chartLabelKey: 'nome',
    chartValueKeys: ['valor_vendido'],
    sortBy: 'valor_vendido',
    sortDir: 'desc',
    columnLabels: {
      nome: 'Entidade jurídica',
      cnpj: 'CNPJ',
      valor_vendido: 'Valor vendido',
      qtd_pedidos: 'Pedidos',
      ticket_medio: 'Ticket médio',
    },
  },
  clientes_atendidos: {
    chartLabelKey: 'periodo',
    chartValueKeys: ['novos', 'recorrentes', 'reativados'],
    columnLabels: {
      periodo: 'Período',
      novos: 'Novos',
      recorrentes: 'Recorrentes',
      reativados: 'Reativados',
      total: 'Total',
    },
  },
};

export function getReportConfig(code: string | null | undefined): ReportConfig | undefined {
  if (!code) return undefined;
  return REPORT_CONFIGS[code as ReportCode];
}
