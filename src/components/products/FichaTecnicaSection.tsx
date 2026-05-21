import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useFichaLookups } from '@/hooks/useFichaLookups';
import type { FichaProfile } from '@/hooks/useProductLookups';

export interface FichaTecnicaData {
  embalagem?: { tipo?: 'Fardo' | 'Caixa'; quantidade?: number };
  acessorios?: { accessory_id: string; valor?: string }[];
  stand_up?: { distancia_picote?: number; distancia_ziper?: number };
  sanfona?: { ativa?: boolean; local?: 'Lateral' | 'Fundo'; valor?: number };
  impressao?: {
    tipo?: 'Interna' | 'Externa';
    local?: 'Frente' | 'Frente e Verso' | 'Verso';
    repeticao_lateral?: number;
    repeticao_longitudinal?: number;
    passo?: number;
    cilindro_id?: string;
    maquina_id?: string;
    cameron?: 'Sim' | 'Não' | 'Duplo';
    fotocelula?: 'Sim' | 'Não' | 'Dupla';
    qtd_cores?: number;
  };
  bobina?: {
    tubete_tipo?: 'PVC' | 'Papelão' | 'Ferro';
    tubete_diametro?: '3"' | '6"';
    descontar_tubo?: boolean;
    peso_bobina?: number;
    diametro_bobina?: number;
    metragem_bobina?: number;
    emendas_por_bobina?: 1 | 2 | 3;
    sentido_embobinamento?: 'Pé Externo' | 'Pé Interno' | 'Cabeça Externo' | 'Cabeça Interno';
  };
  observacoes?: string;
}

interface Props {
  profile: FichaProfile;
  value: FichaTecnicaData;
  onChange: (next: FichaTecnicaData) => void;
  /** Quando true, o bloco Sanfona é forçado ativo e seus campos viram obrigatórios. */
  sanfonaRequired?: boolean;
}

const PROFILES_WITH_STAND_UP: FichaProfile[] = ['stand_up_liso', 'stand_up_impresso'];
const PROFILES_WITH_BAG_OR_STANDUP: FichaProfile[] = ['stand_up_liso', 'stand_up_impresso', 'saco_liso', 'saco_impresso'];
const PROFILES_WITH_BOBINA: FichaProfile[] = ['bobina_lisa', 'bobina_impressa'];
const PROFILES_WITH_PRINT: FichaProfile[] = ['stand_up_impresso', 'saco_impresso', 'bobina_impressa'];

function num(v: string): number | undefined {
  if (v === '') return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function FichaTecnicaSection({ profile, value, onChange, sanfonaRequired = false }: Props) {
  const { machines, cylinders } = useFichaLookups();

  const isNone = !profile || profile === 'none';

  if (isNone) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Selecione um grupo com perfil de ficha técnica configurado para preencher os campos específicos.
      </div>
    );
  }

  const update = <K extends keyof FichaTecnicaData>(key: K, patch: Partial<NonNullable<FichaTecnicaData[K]>>) => {
    onChange({ ...value, [key]: { ...(value[key] as any), ...patch } });
  };

  const showStandUp = PROFILES_WITH_STAND_UP.includes(profile);
  const showEmbalagem = PROFILES_WITH_BAG_OR_STANDUP.includes(profile);
  const showBobina = PROFILES_WITH_BOBINA.includes(profile);
  const showSentido = profile === 'bobina_impressa';
  const showImpressao = PROFILES_WITH_PRINT.includes(profile);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Ficha Técnica</h3>
        {!isNone && <Badge variant="outline" className="text-xs">{profile.replace(/_/g, ' ')}</Badge>}
      </div>


      {showStandUp && (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Stand Up</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Distância do picote (mm)</Label>
              <Input type="number" step="0.01" min="0" value={value.stand_up?.distancia_picote ?? ''}
                onChange={(e) => update('stand_up', { distancia_picote: num(e.target.value) })} />
            </div>
            <div>
              <Label>Distância do zíper (mm)</Label>
              <Input type="number" step="0.01" min="0" value={value.stand_up?.distancia_ziper ?? ''}
                onChange={(e) => update('stand_up', { distancia_ziper: num(e.target.value) })} />
            </div>
          </div>
        </section>
      )}





      {showEmbalagem && (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Embalagem</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={value.embalagem?.tipo || undefined}
                onValueChange={(v) => update('embalagem', { tipo: v as 'Fardo' | 'Caixa' })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fardo">Fardo</SelectItem>
                  <SelectItem value="Caixa">Caixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade por {value.embalagem?.tipo?.toLowerCase() || 'fardo/caixa'}</Label>
              <Input type="number" step="1" min="0" value={value.embalagem?.quantidade ?? ''}
                onChange={(e) => update('embalagem', { quantidade: num(e.target.value) })} />
            </div>
          </div>
        </section>
      )}

      {showBobina && (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Bobina</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de tubete</Label>
              <Select value={value.bobina?.tubete_tipo || undefined}
                onValueChange={(v) => update('bobina', { tubete_tipo: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PVC">PVC</SelectItem>
                  <SelectItem value="Papelão">Papelão</SelectItem>
                  <SelectItem value="Ferro">Ferro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Diâmetro do tubete (pol)</Label>
              <Select value={value.bobina?.tubete_diametro || undefined}
                onValueChange={(v) => update('bobina', { tubete_diametro: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='3"'>3"</SelectItem>
                  <SelectItem value='6"'>6"</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descontar tubo</Label>
              <Select value={value.bobina?.descontar_tubo === undefined ? undefined : value.bobina.descontar_tubo ? 'Sim' : 'Não'}
                onValueChange={(v) => update('bobina', { descontar_tubo: v === 'Sim' })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peso por bobina (kg)</Label>
              <Input type="number" step="0.001" min="0" value={value.bobina?.peso_bobina ?? ''}
                onChange={(e) => update('bobina', { peso_bobina: num(e.target.value) })} />
            </div>
            <div>
              <Label>Diâmetro da bobina (mm)</Label>
              <Input type="number" step="0.01" min="0" value={value.bobina?.diametro_bobina ?? ''}
                onChange={(e) => update('bobina', { diametro_bobina: num(e.target.value) })} />
            </div>
            <div>
              <Label>Metragem da bobina (m)</Label>
              <Input type="number" step="0.01" min="0" value={value.bobina?.metragem_bobina ?? ''}
                onChange={(e) => update('bobina', { metragem_bobina: num(e.target.value) })} />
            </div>
            <div>
              <Label>Emendas por bobina</Label>
              <Select value={value.bobina?.emendas_por_bobina ? String(value.bobina.emendas_por_bobina) : undefined}
                onValueChange={(v) => update('bobina', { emendas_por_bobina: Number(v) as 1 | 2 | 3 })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showSentido && (
              <div className="col-span-2">
                <Label>Sentido de embobinamento</Label>
                <Select value={value.bobina?.sentido_embobinamento || undefined}
                  onValueChange={(v) => update('bobina', { sentido_embobinamento: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pé Externo">Pé Externo</SelectItem>
                    <SelectItem value="Pé Interno">Pé Interno</SelectItem>
                    <SelectItem value="Cabeça Externo">Cabeça Externo</SelectItem>
                    <SelectItem value="Cabeça Interno">Cabeça Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </section>
      )}

      {showImpressao && (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Impressão</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de impressão</Label>
              <Select value={value.impressao?.tipo || undefined}
                onValueChange={(v) => update('impressao', { tipo: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Interna">Interna</SelectItem>
                  <SelectItem value="Externa">Externa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local de impressão</Label>
              <Select value={value.impressao?.local || undefined}
                onValueChange={(v) => update('impressao', { local: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Frente">Frente</SelectItem>
                  <SelectItem value="Frente e Verso">Frente e Verso</SelectItem>
                  <SelectItem value="Verso">Verso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade de cores</Label>
              <Select value={value.impressao?.qtd_cores ? String(value.impressao.qtd_cores) : undefined}
                onValueChange={(v) => update('impressao', { qtd_cores: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Repetição lateral (mm)</Label>
              <Input type="number" step="0.01" min="0" value={value.impressao?.repeticao_lateral ?? ''}
                onChange={(e) => update('impressao', { repeticao_lateral: num(e.target.value) })} />
            </div>
            <div>
              <Label>Repetição longitudinal (mm)</Label>
              <Input type="number" step="0.01" min="0" value={value.impressao?.repeticao_longitudinal ?? ''}
                onChange={(e) => update('impressao', { repeticao_longitudinal: num(e.target.value) })} />
            </div>
            <div>
              <Label>Passo (mm)</Label>
              <Input type="number" step="0.01" min="0" value={value.impressao?.passo ?? ''}
                onChange={(e) => update('impressao', { passo: num(e.target.value) })} />
            </div>
            <div>
              <Label>Diâmetro do cilindro</Label>
              <Select value={value.impressao?.cilindro_id || undefined}
                onValueChange={(v) => update('impressao', { cilindro_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {cylinders.items.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Máquina</Label>
              <Select value={value.impressao?.maquina_id || undefined}
                onValueChange={(v) => update('impressao', { maquina_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {machines.items.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cameron</Label>
              <Select value={value.impressao?.cameron || undefined}
                onValueChange={(v) => update('impressao', { cameron: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                  <SelectItem value="Duplo">Duplo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fotocélula</Label>
              <Select value={value.impressao?.fotocelula || undefined}
                onValueChange={(v) => update('impressao', { fotocelula: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                  <SelectItem value="Dupla">Dupla</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <Label>Observações</Label>
        <Textarea rows={3} value={value.observacoes || ''}
          onChange={(e) => onChange({ ...value, observacoes: e.target.value })}
          placeholder="Observações da ficha técnica" />
      </section>
    </div>
  );
}

export default FichaTecnicaSection;
