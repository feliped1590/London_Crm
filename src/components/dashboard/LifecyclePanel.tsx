import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Eye, UserCheck, UserMinus, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LifecycleStage {
  key: string;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}

const STAGES: LifecycleStage[] = [
  { key: 'lead', label: 'Leads', icon: UserPlus, colorClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-500/10 border-blue-500/20' },
  { key: 'prospect', label: 'Prospects', icon: Eye, colorClass: 'text-purple-600 dark:text-purple-400', bgClass: 'bg-purple-500/10 border-purple-500/20' },
  { key: 'customer_active', label: 'Clientes Ativos', icon: UserCheck, colorClass: 'text-green-600 dark:text-green-400', bgClass: 'bg-green-500/10 border-green-500/20' },
  { key: 'customer_inactive', label: 'Clientes Inativos', icon: UserMinus, colorClass: 'text-orange-600 dark:text-orange-400', bgClass: 'bg-orange-500/10 border-orange-500/20' },
  { key: 'customer_lost', label: 'Clientes Perdidos', icon: UserX, colorClass: 'text-red-600 dark:text-red-400', bgClass: 'bg-red-500/10 border-red-500/20' },
];

export function LifecyclePanel() {
  const navigate = useNavigate();

  const { data: counts, isLoading } = useQuery({
    queryKey: ['lifecycle-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_lifecycle_counts');
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        map[row.lifecycle_stage] = Number(row.total);
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const totalCompanies = counts
    ? Object.values(counts).reduce((sum, v) => sum + v, 0)
    : 0;

  const handleClick = (stage: string) => {
    navigate(`/customers?lifecycle=${stage}`);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {STAGES.map((stage) => {
        const count = counts?.[stage.key] ?? 0;
        const percentage = totalCompanies > 0 ? ((count / totalCompanies) * 100).toFixed(1) : '0';
        const Icon = stage.icon;

        return (
          <Card
            key={stage.key}
            className={cn(
              'cursor-pointer hover:shadow-md transition-all border',
              stage.bgClass
            )}
            onClick={() => handleClick(stage.key)}
          >
            <CardContent className="p-4 flex flex-col gap-1">
              <div className={cn('flex items-center gap-2', stage.colorClass)}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium truncate">{stage.label}</span>
              </div>
              <p className={cn('text-2xl font-bold', stage.colorClass)}>
                {count.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground">
                {percentage}% da base
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
