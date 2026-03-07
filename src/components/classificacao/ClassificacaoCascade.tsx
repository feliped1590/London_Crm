import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useClassificacao } from '@/hooks/useClassificacao';

interface ClassificacaoCascadeProps {
  setorId: string | null;
  segmentoId: string | null;
  atividadeId: string | null;
  onSetorChange: (id: string | null) => void;
  onSegmentoChange: (id: string | null) => void;
  onAtividadeChange: (id: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  /** Show only atividade (compact mode for filters) */
  compact?: boolean;
}

export function ClassificacaoCascade({
  setorId, segmentoId, atividadeId,
  onSetorChange, onSegmentoChange, onAtividadeChange,
  disabled = false,
  required = false,
  compact = false,
}: ClassificacaoCascadeProps) {
  const { setores, getSegmentosBySetor, getAtividadesBySegmento } = useClassificacao();

  const filteredSegmentos = getSegmentosBySetor(setorId);
  const filteredAtividades = getAtividadesBySegmento(segmentoId);

  const handleSetorChange = (value: string) => {
    const v = value === '_none' ? null : value;
    onSetorChange(v);
    onSegmentoChange(null);
    onAtividadeChange(null);
  };

  const handleSegmentoChange = (value: string) => {
    const v = value === '_none' ? null : value;
    onSegmentoChange(v);
    onAtividadeChange(null);
  };

  const handleAtividadeChange = (value: string) => {
    onAtividadeChange(value === '_none' ? null : value);
  };

  if (compact) {
    return (
      <>
        <div>
          <Label className="text-xs">Setor</Label>
          <Select value={setorId || '_none'} onValueChange={handleSetorChange} disabled={disabled}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Todos</SelectItem>
              {setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {setorId && filteredSegmentos.length > 0 && (
          <div>
            <Label className="text-xs">Segmento</Label>
            <Select value={segmentoId || '_none'} onValueChange={handleSegmentoChange} disabled={disabled}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Todos</SelectItem>
                {filteredSegmentos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {segmentoId && filteredAtividades.length > 0 && (
          <div>
            <Label className="text-xs">Atividade</Label>
            <Select value={atividadeId || '_none'} onValueChange={handleAtividadeChange} disabled={disabled}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Todas</SelectItem>
                {filteredAtividades.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div>
        <Label>Setor {required && '*'}</Label>
        <Select value={setorId || undefined} onValueChange={handleSetorChange} disabled={disabled}>
          <SelectTrigger className={required && !setorId ? 'border-muted-foreground/50' : ''}>
            <SelectValue placeholder="Selecione o setor" />
          </SelectTrigger>
          <SelectContent>
            {setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {setorId && filteredSegmentos.length > 0 && (
        <div>
          <Label>Segmento {required && '*'}</Label>
          <Select value={segmentoId || ''} onValueChange={handleSegmentoChange} disabled={disabled}>
            <SelectTrigger className={required && !segmentoId ? 'border-muted-foreground/50' : ''}>
              <SelectValue placeholder="Selecione o segmento" />
            </SelectTrigger>
            <SelectContent>
              {filteredSegmentos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {segmentoId && filteredAtividades.length > 0 && (
        <div>
          <Label>Atividade {required && '*'}</Label>
          <Select value={atividadeId || ''} onValueChange={handleAtividadeChange} disabled={disabled}>
            <SelectTrigger className={required && !atividadeId ? 'border-muted-foreground/50' : ''}>
              <SelectValue placeholder="Selecione a atividade" />
            </SelectTrigger>
            <SelectContent>
              {filteredAtividades.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
