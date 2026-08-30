import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity, AlertCircle, ArrowRightLeft, CheckCircle2, CircleDot, ClipboardCheck,
  ExternalLink, FileSignature, Loader2, MessageCircle, Package, Paperclip, RefreshCw, UserRound, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { WorkspaceTimelineEvent } from '@/modules/customer-workspace';

const PAGE_SIZE = 25;
type TimelineFilter = 'all' | 'tasks' | 'activities' | 'processes' | 'documents' | 'attachments' | 'contracts' | 'services' | 'notes';

const filters: Array<{ value: TimelineFilter; label: string }> = [
  { value: 'all', label: 'Tudo' },
  { value: 'tasks', label: 'Tarefas' },
  { value: 'activities', label: 'Interações' },
  { value: 'processes', label: 'Processos' },
  { value: 'documents', label: 'Documentos' },
  { value: 'attachments', label: 'Anexos' },
  { value: 'contracts', label: 'Contratos' },
  { value: 'services', label: 'Serviços' },
  { value: 'notes', label: 'Notas' },
];

function eventVisual(type: string) {
  if (type.startsWith('task.')) return { Icon: ClipboardCheck, tone: 'bg-sky-600' };
  if (type.startsWith('activity.') || type.startsWith('followup.')) return { Icon: UserRound, tone: 'bg-amber-600' };
  if (type.startsWith('process.')) return { Icon: ArrowRightLeft, tone: 'bg-indigo-600' };
  if (type.startsWith('document.')) return { Icon: FileSignature, tone: 'bg-violet-600' };
  if (type.startsWith('attachment.')) return { Icon: Paperclip, tone: 'bg-stone-600' };
  if (type.startsWith('contract.')) return { Icon: FileSignature, tone: 'bg-teal-600' };
  if (type.startsWith('service.')) return { Icon: Package, tone: 'bg-cyan-600' };
  if (type.includes('declined') || type.includes('cancelled') || type.includes('expired')) return { Icon: XCircle, tone: 'bg-rose-600' };
  if (type.startsWith('communication.')) return { Icon: MessageCircle, tone: 'bg-teal-600' };
  if (type.startsWith('note.')) return { Icon: Activity, tone: 'bg-slate-600' };
  return { Icon: CircleDot, tone: 'bg-muted-foreground' };
}

function sourceTab(event: WorkspaceTimelineEvent) {
  if (event.event_source === 'task') return 'tarefas';
  if (event.event_source === 'deal_followup') return 'followups';
  if (event.event_source === 'deal' || event.event_source === 'deal_stage_history' || event.event_source === 'deal_checklist_completion') return 'negocios';
  if (event.event_source === 'customer_document') return 'documentos';
  if (event.event_source === 'file_attachment') return 'anexos';
  if (event.event_source === 'client_contract' || event.event_source === 'service_engagement') return 'contratos';
  if (event.event_source === 'activity' || event.event_source === 'entity_note') return 'notas';
  return null;
}

export function CustomerTimeline360Panel({
  customerId, className, onOpenSource,
}: { customerId: string; className?: string; onOpenSource?: (tab: string) => void }) {
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const timeline = useInfiniteQuery({
    queryKey: ['customer-workspace-timeline', customerId, filter],
    initialPageParam: 0,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('get_customer_workspace_timeline', {
        p_company_id: customerId,
        p_filter: filter,
        p_limit: PAGE_SIZE,
        p_offset: Number(pageParam),
      });
      if (error) throw error;
      type TimelineRpcRow = {
        event_id: string
        event_type: string
        event_source: string
        source_id: string
        event_title?: string | null
        event_description?: string | null
        actor_user_id?: string | null
        event_legal_entity_id?: string | null
        title?: string | null
        description?: string | null
        user_id?: string | null
        legal_entity_id?: string | null
        occurred_at: string
      };
      return ((data || []) as TimelineRpcRow[]).map((row) => ({
        id: row.event_id,
        event_type: row.event_type,
        event_source: row.event_source,
        source_id: row.source_id,
        title: row.event_title || row.title || '',
        description: row.event_description ?? row.description ?? null,
        user_id: row.actor_user_id ?? row.user_id ?? null,
        legal_entity_id: row.event_legal_entity_id ?? row.legal_entity_id ?? null,
        occurred_at: row.occurred_at,
      }));
    },
    getNextPageParam: (page, pages) => page.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
    enabled: Boolean(customerId),
  });

  const events = useMemo(() => timeline.data?.pages.flat() || [], [timeline.data]);
  const userIds = useMemo(() => [...new Set(events.flatMap((e) => e.user_id ? [e.user_id] : []))], [events]);
  const entityIds = useMemo(() => [...new Set(events.flatMap((e) => e.legal_entity_id ? [e.legal_entity_id] : []))], [events]);

  const { data: users = {} } = useQuery({
    queryKey: ['timeline-users', userIds], enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id,full_name').in('user_id', userIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map((row) => [row.user_id, row.full_name || 'Usuário']));
    },
  });
  const { data: entities = {} } = useQuery({
    queryKey: ['timeline-entities', entityIds], enabled: entityIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('legal_entities').select('id,name').in('id', entityIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map((row) => [row.id, row.name]));
    },
  });

  return (
    <aside className={cn('flex min-h-[520px] flex-col overflow-hidden border bg-card lg:sticky lg:top-4 lg:h-[calc(100vh-7rem)]', className)} aria-label="Timeline 360 do cliente">
      <header className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Timeline 360°</h2>
            <p className="text-xs text-muted-foreground">Histórico consolidado do cliente</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant="outline" className="tabular-nums">{events.length}{timeline.hasNextPage ? '+' : ''}</Badge>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Atualizar timeline" aria-label="Atualizar timeline" onClick={() => timeline.refetch()}>
              <RefreshCw className={cn('h-3.5 w-3.5', timeline.isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filtrar timeline">
          {filters.map((item) => (
            <Button key={item.value} type="button" size="sm"
              variant={filter === item.value ? 'secondary' : 'ghost'}
              className="h-7 shrink-0 px-2 text-xs"
              role="tab" aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}>{item.label}</Button>
          ))}
        </div>
      </header>

      {timeline.isLoading ? (
        <div className="space-y-5 p-4">{[0,1,2,3].map((key) => <div key={key} className="flex gap-3"><Skeleton className="h-7 w-7 rounded-full"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3"/><Skeleton className="h-3 w-full"/><Skeleton className="h-3 w-1/2"/></div></div>)}</div>
      ) : timeline.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"><AlertCircle className="h-9 w-9 text-destructive"/><div><p className="text-sm font-medium">Não foi possível carregar a timeline</p><p className="text-xs text-muted-foreground">{(timeline.error as { message?: string } | null)?.message || 'Atualize para tentar novamente.'}</p></div><Button size="sm" variant="outline" onClick={() => timeline.refetch()}><RefreshCw className="mr-2 h-4 w-4"/>Atualizar</Button></div>
      ) : events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><Package className="h-9 w-9 text-muted-foreground/50"/><p className="mt-3 text-sm font-medium">Nenhum evento encontrado</p><p className="mt-1 max-w-64 text-xs text-muted-foreground">Tarefas, documentos, contratos, processos e interações deste cliente aparecem aqui.</p></div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="relative p-4 pl-10">
            <div className="absolute bottom-6 left-[25px] top-6 w-px bg-border" aria-hidden="true"/>
            <div className="space-y-3">
              {events.map((event) => {
                const { Icon, tone } = eventVisual(event.event_type);
                const tab = sourceTab(event);
                return <article key={event.id} className="relative rounded-md border bg-background p-3 shadow-sm">
                  <span className={cn('absolute -left-[30px] top-3 flex h-7 w-7 items-center justify-center rounded-full text-white ring-4 ring-card', tone)} aria-hidden="true"><Icon className="h-3.5 w-3.5"/></span>
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium leading-snug">{event.title?.trim() || (event.event_type.startsWith('task.') ? 'Tarefa' : 'Evento')}</p>{event.description && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{event.description}</p>}</div>{tab && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Abrir registro de origem" aria-label="Abrir registro de origem" onClick={() => onOpenSource?.(tab)}><ExternalLink className="h-3.5 w-3.5"/></Button>}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground"><time dateTime={event.occurred_at}>{format(new Date(event.occurred_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}</time>{event.user_id && users[event.user_id] && <><span aria-hidden="true">·</span><span>{users[event.user_id]}</span></>}{event.legal_entity_id && entities[event.legal_entity_id] && <><span aria-hidden="true">·</span><span>{entities[event.legal_entity_id]}</span></>}</div>
                </article>;
              })}
            </div>
            {timeline.hasNextPage && <div className="mt-4 flex justify-center"><Button type="button" size="sm" variant="outline" disabled={timeline.isFetchingNextPage} onClick={() => timeline.fetchNextPage()}>{timeline.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Activity className="mr-2 h-4 w-4"/>}Carregar mais</Button></div>}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}
