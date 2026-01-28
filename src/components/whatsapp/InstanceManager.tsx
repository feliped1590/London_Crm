import { useState } from 'react';
import { useWhatsAppInstances, useAddInstance, useCheckInstanceStatus, useDeleteInstance, WhatsAppInstance } from '@/hooks/useWhatsApp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, RefreshCw, Smartphone, Wifi, WifiOff, ExternalLink, Copy, Trash2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { QRCodeConnectionModal } from './QRCodeConnectionModal';
import { ptBR } from 'date-fns/locale';

export function InstanceManager() {
  const { data: instances, isLoading } = useWhatsAppInstances();
  const addInstance = useAddInstance();
  const checkStatus = useCheckInstanceStatus();
  const deleteInstance = useDeleteInstance();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [qrCodeInstance, setQrCodeInstance] = useState<WhatsAppInstance | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    instance_id: '',
    instance_token: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addInstance.mutate(formData, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setFormData({ name: '', instance_id: '', instance_token: '' });
      }
    });
  };

  const handleCheckStatus = (instance: WhatsAppInstance) => {
    checkStatus.mutate(instance.id);
  };

  const handleDeleteInstance = (instanceId: string) => {
    deleteInstance.mutate(instanceId);
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL do webhook copiada!');
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração do Webhook</CardTitle>
          <CardDescription>
            Configure este URL no painel da Z-API para receber mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook
            </code>
            <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Na Z-API, vá em Webhooks → On Message Received e cole esta URL. 
            Adicione o header <code className="bg-muted px-1 rounded">Client-Token</code> com o valor configurado.
          </p>
        </CardContent>
      </Card>

      {/* Add Instance Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Instâncias</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Instância Z-API</DialogTitle>
              <DialogDescription>
                Insira os dados da sua instância Z-API. Você encontra esses dados no painel da Z-API.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Instância</Label>
                  <Input
                    id="name"
                    placeholder="Ex: WhatsApp Vendas"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instance_id">Instance ID</Label>
                  <Input
                    id="instance_id"
                    placeholder="Ex: 3C8A1B2D3E4F5G6H7I8J"
                    value={formData.instance_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, instance_id: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instance_token">Instance Token</Label>
                  <Input
                    id="instance_token"
                    type="password"
                    placeholder="Token da instância"
                    value={formData.instance_token}
                    onChange={(e) => setFormData(prev => ({ ...prev, instance_token: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addInstance.isPending}>
                  {addInstance.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Instances Grid */}
      {instances && instances.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma instância configurada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione uma instância Z-API para começar a enviar e receber mensagens
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Instância
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances?.map((instance) => (
            <InstanceCard 
              key={instance.id} 
              instance={instance} 
              onCheckStatus={handleCheckStatus}
              onDelete={handleDeleteInstance}
              onConnectQR={() => setQrCodeInstance(instance)}
              isCheckingStatus={checkStatus.isPending}
              isDeleting={deleteInstance.isPending}
            />
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeConnectionModal
        instance={qrCodeInstance}
        isOpen={!!qrCodeInstance}
        onClose={() => setQrCodeInstance(null)}
      />

      {/* Help Link */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Precisa de ajuda?</p>
              <p className="text-sm text-muted-foreground">
                Acesse a documentação da Z-API em{' '}
                <a 
                  href="https://developer.z-api.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  developer.z-api.io
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface InstanceCardProps {
  instance: WhatsAppInstance;
  onCheckStatus: (instance: WhatsAppInstance) => void;
  onDelete: (instanceId: string) => void;
  onConnectQR: () => void;
  isCheckingStatus: boolean;
  isDeleting: boolean;
}

function InstanceCard({ instance, onCheckStatus, onDelete, onConnectQR, isCheckingStatus, isDeleting }: InstanceCardProps) {
  const isConnected = instance.status === 'connected';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{instance.name}</CardTitle>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="shrink-0">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">
            Instance ID: <code className="text-foreground">{instance.instance_id.slice(0, 12)}...</code>
          </p>
          {instance.phone_number && (
            <p className="text-muted-foreground">
              Telefone: <span className="text-foreground">{instance.phone_number}</span>
            </p>
          )}
          {instance.connected_at && (
            <p className="text-muted-foreground">
              Conectado em: <span className="text-foreground">
                {format(new Date(instance.connected_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {!isConnected && (
            <Button 
              size="sm" 
              className="w-full gap-2"
              onClick={onConnectQR}
            >
              <QrCode className="h-4 w-4" />
              Conectar via QR Code
            </Button>
          )}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onCheckStatus(instance)}
              disabled={isCheckingStatus}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isCheckingStatus ? 'animate-spin' : ''}`} />
              Verificar
            </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir instância</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir a instância "{instance.name}"? 
                  Esta ação não pode ser desfeita e todas as mensagens associadas serão mantidas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(instance.id);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
