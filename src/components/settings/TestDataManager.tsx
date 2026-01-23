import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertTriangle, Search, Building2, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const TEST_PREFIX = '[TESTE]';

export function TestDataManager() {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  // Query to count test data
  const { data: testDataCount, refetch: refetchCounts } = useQuery({
    queryKey: ['test_data_count'],
    queryFn: async () => {
      const [companiesRes, contactsRes, dealsRes] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact' }).ilike('name', `${TEST_PREFIX}%`),
        supabase.from('contacts').select('id', { count: 'exact' }).ilike('first_name', `${TEST_PREFIX}%`),
        supabase.from('deals').select('id', { count: 'exact' }).ilike('name', `${TEST_PREFIX}%`),
      ]);

      return {
        companies: companiesRes.count || 0,
        contacts: contactsRes.count || 0,
        deals: dealsRes.count || 0,
        total: (companiesRes.count || 0) + (contactsRes.count || 0) + (dealsRes.count || 0),
      };
    },
  });

  const deleteTestDataMutation = useMutation({
    mutationFn: async () => {
      // Delete in order to respect foreign key constraints
      // First delete deals (they reference contacts and companies)
      const { error: dealsError } = await supabase
        .from('deals')
        .delete()
        .ilike('name', `${TEST_PREFIX}%`);
      if (dealsError) throw dealsError;

      // Then delete contacts (they reference companies)
      const { error: contactsError } = await supabase
        .from('contacts')
        .delete()
        .ilike('first_name', `${TEST_PREFIX}%`);
      if (contactsError) throw contactsError;

      // Finally delete companies
      const { error: companiesError } = await supabase
        .from('companies')
        .delete()
        .ilike('name', `${TEST_PREFIX}%`);
      if (companiesError) throw companiesError;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['test_data_count'] });
      toast.success('Dados de teste removidos com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error deleting test data:', error);
      toast.error('Erro ao remover dados de teste: ' + error.message);
    },
  });

  const handleScan = async () => {
    setIsScanning(true);
    await refetchCounts();
    setIsScanning(false);
    toast.success('Busca concluída!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Dados de Teste
        </CardTitle>
        <CardDescription>
          Gerencie registros de teste marcados com o prefixo <Badge variant="secondary">{TEST_PREFIX}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground mb-3">
            Para marcar registros como teste, adicione <strong>{TEST_PREFIX}</strong> no início do nome ao criar empresas, contatos ou negócios.
          </p>
          <p className="text-sm text-muted-foreground">
            Exemplo: <code className="bg-muted px-1 rounded">{TEST_PREFIX} Empresa ABC</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleScan} disabled={isScanning}>
            <Search className="h-4 w-4 mr-2" />
            {isScanning ? 'Buscando...' : 'Buscar dados de teste'}
          </Button>
        </div>

        {testDataCount && testDataCount.total > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Building2 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{testDataCount.companies}</p>
                  <p className="text-xs text-muted-foreground">Empresas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Users className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{testDataCount.contacts}</p>
                  <p className="text-xs text-muted-foreground">Contatos</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{testDataCount.deals}</p>
                  <p className="text-xs text-muted-foreground">Negócios</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {testDataCount.total} registros de teste encontrados
                </p>
                <p className="text-xs text-muted-foreground">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deleteTestDataMutation.isPending}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteTestDataMutation.isPending ? 'Removendo...' : 'Limpar tudo'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você está prestes a excluir permanentemente:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>{testDataCount.companies} empresas</li>
                        <li>{testDataCount.contacts} contatos</li>
                        <li>{testDataCount.deals} negócios</li>
                      </ul>
                      <p className="mt-2 font-medium">Esta ação não pode ser desfeita.</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteTestDataMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sim, excluir tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {testDataCount && testDataCount.total === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Trash2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhum dado de teste encontrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
