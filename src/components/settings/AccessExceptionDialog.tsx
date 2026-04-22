import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import type { AccessException } from '@/hooks/useAccessWindowConfig';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: AccessException | null;
  isPending: boolean;
  onSubmit: (input: {
    id?: string;
    exception_date: string;
    is_allowed: boolean;
    description: string | null;
  }) => void;
}

export function AccessExceptionDialog({
  open,
  onOpenChange,
  initial,
  isPending,
  onSubmit,
}: Props) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isAllowed, setIsAllowed] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      if (initial) {
        // exception_date vem como 'YYYY-MM-DD' — montamos local sem timezone-shift
        const [y, m, d] = initial.exception_date.split('-').map(Number);
        setDate(new Date(y, m - 1, d));
        setIsAllowed(initial.is_allowed);
        setDescription(initial.description ?? '');
      } else {
        setDate(undefined);
        setIsAllowed(false);
        setDescription('');
      }
    }
  }, [open, initial]);

  const handleSubmit = () => {
    if (!date) return;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    onSubmit({
      id: initial?.id,
      exception_date: iso,
      is_allowed: isAllowed,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar exceção' : 'Nova exceção'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  locale={ptBR}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {isAllowed ? 'Liberado o dia todo' : 'Bloqueado o dia todo'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAllowed
                  ? 'Sobrepõe a grade semanal e libera o acesso 24h.'
                  : 'Sobrepõe a grade semanal e bloqueia o acesso 24h (ex: feriado).'}
              </p>
            </div>
            <Switch checked={isAllowed} onCheckedChange={setIsAllowed} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exception-description">Descrição (opcional)</Label>
            <Input
              id="exception-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Tiradentes, Inventário, Treinamento..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!date || isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
