import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useProductLookups, type FichaProfile } from '@/hooks/useProductLookups';

const PROFILE_OPTIONS: { value: FichaProfile; label: string }[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'stand_up_liso', label: 'Stand Up Liso' },
  { value: 'stand_up_impresso', label: 'Stand Up Impresso' },
  { value: 'saco_liso', label: 'Saco Liso' },
  { value: 'saco_impresso', label: 'Saco Impresso' },
  { value: 'bobina_lisa', label: 'Bobina Lisa' },
  { value: 'bobina_impressa', label: 'Bobina Impressa' },
];

export default function GroupFichaProfileManager() {
  const { grupos } = useProductLookups();

  const handleChange = async (id: string, ficha_profile: FichaProfile) => {
    try {
      await grupos.update.mutateAsync({ id, ficha_profile } as any);
      toast.success('Perfil atualizado');
    } catch {
      toast.error('Erro ao atualizar perfil');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Perfil de Ficha Técnica por Grupo
          <Badge variant="secondary" className="ml-1">{grupos.allItems.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead className="w-64">Perfil de Ficha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.allItems.map((g) => (
              <TableRow key={g.id} className={!g.is_active ? 'opacity-50' : ''}>
                <TableCell>{g.label}</TableCell>
                <TableCell>
                  <Select value={g.ficha_profile || 'none'} onValueChange={(v) => handleChange(g.id, v as FichaProfile)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROFILE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
