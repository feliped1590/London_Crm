import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { GripVertical, MoreVertical, Trash2, Maximize2, Minimize2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { DashboardWidget as WidgetType, ChartType, CHART_TYPE_LABELS, SIZE_LABELS, METRIC_DEFINITIONS } from '@/types/dashboard';
import { MetricData } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { SellerPortfolioWidget } from '@/components/dashboard/SellerPortfolioWidget';
import { InsightsSummary } from '@/components/insights/InsightsSummary';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Error Boundary for individual widgets
interface ErrorBoundaryProps {
  children: ReactNode;
  widgetId: string;
  onRemove: (id: string) => void;
  isEditing: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WidgetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Widget rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="h-full flex flex-col items-center justify-center p-4 bg-destructive/5 border-destructive/20">
          <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-muted-foreground text-center mb-2">
            Erro ao carregar widget
          </p>
          {this.props.isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.props.onRemove(this.props.widgetId)}
              className="text-destructive"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Remover
            </Button>
          )}
        </Card>
      );
    }

    return this.props.children;
  }
}

interface DashboardWidgetProps {
  widget: WidgetType;
  data: MetricData;
  onRemove: (id: string) => void;
  onChangeChart: (id: string, chartType: ChartType) => void;
  onChangeSize: (id: string, size: 'sm' | 'md' | 'lg' | 'xl') => void;
  isEditing: boolean;
}

export function DashboardWidget({
  widget,
  data,
  onRemove,
  onChangeChart,
  onChangeSize,
  isEditing,
}: DashboardWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const metricDef = METRIC_DEFINITIONS.find((m) => m.type === widget.type);

  const sizeClasses = {
    sm: 'col-span-1',
    md: 'col-span-1 md:col-span-2',
    lg: 'col-span-1 md:col-span-2 lg:col-span-3',
    xl: 'col-span-1 md:col-span-2 lg:col-span-4',
  };

  const renderChart = () => {
    // Custom widget types that render their own components
    if (widget.type === 'seller_portfolio') {
      return <SellerPortfolioWidget />;
    }
    
    if (widget.type === 'insights_summary') {
      return <InsightsSummary />;
    }

    if (widget.chartType === 'number') {
      return (
        <div className="flex flex-col items-center justify-center h-full py-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{data.value}</span>
            {data.trend === 'up' && <TrendingUp className="h-5 w-5 text-success" />}
            {data.trend === 'down' && <TrendingDown className="h-5 w-5 text-destructive" />}
          </div>
          {data.subtitle && (
            <span className="text-sm text-muted-foreground">{data.subtitle}</span>
          )}
        </div>
      );
    }

    if (!data.chartData || data.chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Sem dados para exibir
        </div>
      );
    }

    const chartHeight = widget.size === 'sm' ? 150 : widget.size === 'md' ? 200 : 250;

    switch (widget.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data.chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
              {data.chartData[0]?.count !== undefined && (
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} />
              )}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={data.chartData.filter((d) => d.value > 0)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={chartHeight / 3}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={{ strokeWidth: 1 }}
              >
                {data.chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        sizeClasses[widget.size],
        isDragging && 'opacity-50 z-50',
      )}
    >
      <WidgetErrorBoundary widgetId={widget.id} onRemove={onRemove} isEditing={isEditing}>
        <Card className={cn('h-full', isEditing && 'ring-2 ring-primary/20')}>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
            <div className="flex items-center gap-2">
              {isEditing && (
                <button
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
            </div>
            {isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {metricDef && metricDef.supportedCharts.length > 1 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Tipo de Gráfico</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {metricDef.supportedCharts.map((chart) => (
                          <DropdownMenuItem
                            key={chart}
                            onClick={() => onChangeChart(widget.id, chart)}
                            className={widget.chartType === chart ? 'bg-muted' : ''}
                          >
                            {CHART_TYPE_LABELS[chart]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {widget.size === 'sm' ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
                      Tamanho
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {Object.entries(SIZE_LABELS).map(([size, label]) => (
                        <DropdownMenuItem
                          key={size}
                          onClick={() => onChangeSize(widget.id, size as 'sm' | 'md' | 'lg' | 'xl')}
                          className={widget.size === size ? 'bg-muted' : ''}
                        >
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onRemove(widget.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            {renderChart()}
          </CardContent>
        </Card>
      </WidgetErrorBoundary>
    </div>
  );
}
