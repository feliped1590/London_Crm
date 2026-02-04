import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History, User } from 'lucide-react';
import { CreditAuditRecord } from '@/hooks/useCreditAnalysis';

interface CreditAuditHistoryProps {
  records: CreditAuditRecord[];
  isLoading: boolean;
}

function getRiskBadgeVariant(risk: string): 'default' | 'secondary' | 'destructive' {
  switch (risk) {
    case 'baixo':
      return 'default';
    case 'medio':
      return 'secondary';
    case 'alto':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getRiskLabel(risk: string): string {
  const labels: Record<string, string> = {
    baixo: 'Baixo',
    medio: 'Médio',
    alto: 'Alto',
  };
  return labels[risk] || risk;
}

export function CreditAuditHistory({ records, isLoading }: CreditAuditHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <History className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">Nenhuma consulta realizada ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Risco</TableHead>
            <TableHead className="min-w-[200px]">Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="whitespace-nowrap">
                {format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate max-w-[150px]">{record.user_name}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {record.result_summary.credit_score}
              </TableCell>
              <TableCell>
                <Badge variant={getRiskBadgeVariant(record.result_summary.risk_classification)}>
                  {getRiskLabel(record.result_summary.risk_classification)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {record.reason}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
