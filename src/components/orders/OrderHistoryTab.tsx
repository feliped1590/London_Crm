import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Clock, User, Edit2, DollarSign, Calendar, Building2, Users, FileText, Package, Truck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/formatters';
import { orderStatusConfig, OrderStatus } from '@/types/products';

interface OrderHistoryTabProps {
  orderId: string;
}

const fieldIcons: Record<string, React.ElementType> = {
  created: FileText,
  number: FileText,
  company_id: Building2,
  contact_id: Users,
  status: Package,
  delivery_date: Calendar,
  total_value: DollarSign,
  observations: Edit2,
  proposal_id: FileText,
  item_added: Package,
  item_removed: Package,
  item_modified: Package,
};

const fieldColors: Record<string, string> = {
  created: 'bg-emerald-500',
  status: 'bg-purple-500',
  item_added: 'bg-green-500',
  item_removed: 'bg-red-500',
  item_modified: 'bg-yellow-500',
};

export function OrderHistoryTab({ orderId }: OrderHistoryTabProps) {
  // Fetch audit log with manual profile join
  const { data: auditLog, isLoading } = useQuery({
    queryKey: ['order_audit_log', orderId],
    queryFn: async () => {
      // Get audit logs
      const { data: auditData, error: auditError } = await supabase
        .from('order_audit_log')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false });
      if (auditError) throw auditError;
      
      // Get profiles for joining
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (profilesError) throw profilesError;
      
      // Manually join profiles
      const auditWithProfiles = auditData.map(entry => ({
        ...entry,
        profiles: {
          full_name: profilesData.find(p => p.user_id === entry.changed_by)?.full_name || null
        }
      }));
      
      return auditWithProfiles;
    },
    enabled: !!orderId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Get company/contact names for display
  const { data: companies } = useQuery({
    queryKey: ['companies_for_order_audit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name');
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts_for_order_audit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('id, first_name, last_name');
      if (error) throw error;
      return data;
    },
  });

  const formatFieldValue = (fieldName: string, value: string | null) => {
    if (!value) return <span className="text-muted-foreground italic">vazio</span>;

    switch (fieldName) {
      case 'total_value':
        return formatCurrency(parseFloat(value) || 0);
      case 'delivery_date':
        return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
      case 'company_id':
        const company = companies?.find((c) => c.id === value);
        return company?.name || value;
      case 'contact_id':
        const contact = contacts?.find((c) => c.id === value);
        return contact ? `${contact.first_name} ${contact.last_name || ''}`.trim() : value;
      case 'status':
        const statusKey = value as OrderStatus;
        return orderStatusConfig[statusKey]?.label || value;
      default:
        return value.length > 50 ? `${value.substring(0, 50)}...` : value;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!auditLog || auditLog.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum histórico registrado ainda.</p>
        <p className="text-sm mt-1">O histórico aparecerá quando o pedido for modificado.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[350px]">
      <div className="relative pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
        <div className="space-y-4">
          {auditLog.map((entry) => (
            <AuditEntry 
              key={entry.id} 
              entry={entry} 
              formatFieldValue={formatFieldValue} 
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function AuditEntry({
  entry,
  formatFieldValue,
}: {
  entry: any;
  formatFieldValue: (field: string, value: string | null) => React.ReactNode;
}) {
  const Icon = fieldIcons[entry.field_name] || Edit2;
  const dotColor = fieldColors[entry.field_name] || 'bg-blue-500';
  const bgColor = entry.field_name.startsWith('item_') 
    ? entry.field_name === 'item_added' 
      ? 'bg-green-500/10 border-green-500/20'
      : entry.field_name === 'item_removed'
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-yellow-500/10 border-yellow-500/20'
    : entry.field_name === 'status'
      ? 'bg-purple-500/10 border-purple-500/20'
      : 'bg-blue-500/10 border-blue-500/20';

  return (
    <div className="relative">
      <div className={`absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-background ${dotColor}`} />

      <div className={`rounded-lg p-3 border ${bgColor}`}>
        <div className="flex items-start gap-2">
          <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
            entry.field_name === 'item_added' ? 'text-green-600' :
            entry.field_name === 'item_removed' ? 'text-red-600' :
            entry.field_name === 'item_modified' ? 'text-yellow-600' :
            entry.field_name === 'status' ? 'text-purple-600' :
            'text-blue-600'
          }`} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{entry.field_label}</div>
            <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
              {entry.old_value && (
                <>
                  <span className="text-muted-foreground line-through">
                    {formatFieldValue(entry.field_name, entry.old_value)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                </>
              )}
              <span className="font-medium">{formatFieldValue(entry.field_name, entry.new_value)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(entry.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
          {entry.profiles?.full_name && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{entry.profiles.full_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
