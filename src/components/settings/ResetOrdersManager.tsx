import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ResetOrdersManager() {
  const [confirmText, setConfirmText] = useState('');
  const [open, setOpen] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('reset_orders');
      if (error) throw error;
      return data as {
        success: boolean;
        deleted_orders: number;
        deleted_items: number;
        deleted_approvals: number;
        deleted_audit: number;
        deleted_fiscal: number;
      };
    },
    onSuccess: (data) => {
      toast.success('Base de pedidos limpa com sucesso', {
        description: `${data.deleted_orders} pedidos, ${data.deleted_items} itens e ${data.deleted_approvals + data.deleted_audit + data.deleted_fiscal} registros auxiliares removidos.`,
      });
      setOpen(false);
      setConfirmText('');
    },
    onError: (error: Error) => {
      toast.error('Erro ao resetar pedidos', {
        description: error.message,
      });
    },
  });

  const canConfirm = confirmText === 'RESETAR';

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">Resetar Base de Pedidos</CardTitle>
        </div>
        <CardDescription>
          Remove permanentemente todos os pedidos, itens, aprovações e logs de auditoria. 
          Ideal para ambientes de demonstração, testes ou onboarding de clientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(''); }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Resetar Base de Pedidos
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Tem certeza absoluta?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Esta ação <strong>não pode ser desfeita</strong>. Todos os seguintes dados serão permanentemente removidos:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Todos os pedidos</li>
                  <li>Itens dos pedidos</li>
                  <li>Aprovações de pedidos</li>
                  <li>Logs de auditoria de pedidos</li>
                  <li>Snapshots fiscais dos itens</li>
                </ul>
                <div className="pt-2">
                  <Label htmlFor="confirm-reset" className="text-sm font-medium">
                    Digite <strong className="text-destructive">RESETAR</strong> para confirmar:
                  </Label>
                  <Input
                    id="confirm-reset"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="RESETAR"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resetMutation.isPending}>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={!canConfirm || resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
                className="gap-2"
              >
                {resetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resetando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Sim, resetar tudo
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
