import { Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

interface NoLegalEntityScreenProps {
  reason: 'no_entities' | 'no_active';
  onSelect?: () => void;
}

/**
 * Tela de bloqueio quando o usuário não possui contexto de entidade jurídica válido.
 * - 'no_entities': nenhum vínculo em user_legal_entities (nem admin/dev).
 * - 'no_active': tem vínculos mas não selecionou (ou a selecionada é inválida).
 */
export function NoLegalEntityScreen({ reason, onSelect }: NoLegalEntityScreenProps) {
  const { signOut } = useAuth();

  const isNoEntities = reason === 'no_entities';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">
            {isNoEntities ? 'Acesso bloqueado' : 'Selecione um CNPJ'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isNoEntities
              ? 'Seu usuário não possui entidade jurídica vinculada. Entre em contato com o administrador para liberar o acesso.'
              : 'Para continuar, selecione a entidade jurídica que será o contexto operacional do sistema.'}
          </p>

          <div className="flex flex-col gap-2 pt-2">
            {!isNoEntities && onSelect && (
              <Button onClick={onSelect} className="w-full">
                Selecionar CNPJ
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
