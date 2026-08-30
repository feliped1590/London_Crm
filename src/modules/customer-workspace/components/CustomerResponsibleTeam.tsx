import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { WorkspaceTeamMember } from '../types';

const roleLabel: Record<string, string> = {
  owner: 'Responsável do cliente',
  process_owner: 'Responsável do processo',
  participant: 'Participante',
  service: 'Serviço',
  task: 'Tarefa',
};

export function CustomerResponsibleTeam({ team }: { team: WorkspaceTeamMember[] }) {
  const ids = [...new Set(team.map((item) => item.user_id).filter(Boolean))];
  const { data: names = {} } = useQuery({
    queryKey: ['workspace-team-names', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      if (error) throw error;
      return Object.fromEntries((data || []).map((row) => [row.user_id, row.full_name || 'Usuário']));
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Equipe responsável</CardTitle>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum responsável identificado.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {team.map((member) => (
              <li key={`${member.user_id}-${member.role}`} className="flex items-center justify-between gap-2">
                <span>{names[member.user_id] || 'Usuário'}</span>
                <span className="text-xs text-muted-foreground">{roleLabel[member.role] || member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
