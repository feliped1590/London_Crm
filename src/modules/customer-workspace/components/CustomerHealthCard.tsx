import { AlertCircle, CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CustomerHealth } from '../types';

const healthCopy: Record<CustomerHealth, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  critical: { label: 'Crítico', className: 'bg-destructive text-destructive-foreground', Icon: ShieldAlert },
  attention: { label: 'Atenção', className: 'bg-amber-600 text-white', Icon: AlertCircle },
  healthy: { label: 'Saudável', className: 'bg-emerald-600 text-white', Icon: CheckCircle2 },
  unknown: { label: 'Sem dados', className: 'bg-muted text-muted-foreground', Icon: HelpCircle },
};

export function CustomerHealthCard({
  health,
  reasons,
}: {
  health: CustomerHealth;
  reasons: string[];
}) {
  const config = healthCopy[health];
  const Icon = config.Icon;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Saúde operacional</CardTitle>
          <Badge className={config.className}>
            <Icon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Classificação derivada de prazos, documentos e SLA — não é um campo cadastral.</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
