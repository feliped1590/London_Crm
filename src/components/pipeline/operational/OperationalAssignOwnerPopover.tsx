import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTenantUsers } from '@/hooks/useTenantUsers';
import { useSetOperationalOwner } from '@/hooks/useOperationalOrderActions';
import { UserPlus, X } from 'lucide-react';

interface Props {
  orderId: string;
  pipelineId: string;
  ownerId: string | null;
  ownerName: string | null;
  disabled?: boolean;
}

function initials(name: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function OperationalAssignOwnerPopover({ orderId, pipelineId, ownerId, ownerName, disabled }: Props) {
  const { data: users = [] } = useTenantUsers();
  const mutation = useSetOperationalOwner();
  const [search, setSearch] = useState('');

  const filtered = users.filter(u => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (u.full_name ?? '').toLowerCase().includes(t) || (u.email ?? '').toLowerCase().includes(t);
  });

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Atribuir responsável"
        >
          {ownerId ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px]">{initials(ownerName)}</AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[100px]">{ownerName ?? 'Responsável'}</span>
            </>
          ) : (
            <>
              <UserPlus className="h-3 w-3" />
              <span>Sem responsável</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          placeholder="Buscar usuário…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
          {ownerId && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-8 text-xs text-destructive"
              onClick={() => mutation.mutate({ orderId, pipelineId, ownerId: null })}
            >
              <X className="h-3 w-3 mr-2" /> Remover responsável
            </Button>
          )}
          {filtered.map(u => (
            <Button
              key={u.id}
              variant="ghost"
              size="sm"
              className="justify-start h-8 text-xs"
              onClick={() => mutation.mutate({ orderId, pipelineId, ownerId: u.id })}
            >
              <Avatar className="h-5 w-5 mr-2">
                <AvatarFallback className="text-[9px]">{initials(u.full_name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{u.full_name ?? u.email}</span>
            </Button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
