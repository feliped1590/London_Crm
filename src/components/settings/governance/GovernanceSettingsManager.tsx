import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useGovernanceFlags } from '@/hooks/useCommercialGovernance';

export function GovernanceSettingsManager() {
  const { flags, isLoading, save } = useGovernanceFlags();
  const [comm, setComm] = useState(true);
  const [pay, setPay] = useState(true);

  useEffect(() => {
    if (flags) {
      setComm(!!flags.commission_allow_exception);
      setPay(!!flags.payment_terms_allow_exception);
    }
  }, [flags]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  const dirty = flags && (comm !== flags.commission_allow_exception || pay !== flags.payment_terms_allow_exception);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de Exceção</CardTitle>
        <CardDescription>
          Quando uma flag está ON e o pedido excede a regra, o vendedor pode solicitar aprovação.
          Quando OFF, a transição de status é bloqueada e o pedido precisa ser ajustado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm font-medium">Permitir exceção em comissão</Label>
            <p className="text-xs text-muted-foreground">Vendedor pode solicitar aprovação acima de <code>max_pct</code>.</p>
          </div>
          <Switch checked={comm} onCheckedChange={setComm} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm font-medium">Permitir exceção em condição de pagamento</Label>
            <p className="text-xs text-muted-foreground">Vendedor pode solicitar aprovação acima de <code>max_template_rank</code>.</p>
          </div>
          <Switch checked={pay} onCheckedChange={setPay} />
        </div>
        <div className="flex justify-end">
          <Button disabled={!dirty} onClick={() => save.mutate({ commission_allow_exception: comm, payment_terms_allow_exception: pay })}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
