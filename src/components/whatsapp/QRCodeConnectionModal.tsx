import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2, Smartphone, QrCode, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { WhatsAppInstance, useCheckInstanceStatus } from '@/hooks/useWhatsApp';
import { useQueryClient } from '@tanstack/react-query';

interface QRCodeConnectionModalProps {
  instance: WhatsAppInstance | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeConnectionModal({ instance, isOpen, onClose }: QRCodeConnectionModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const checkStatus = useCheckInstanceStatus();
  const queryClient = useQueryClient();

  const fetchQRCode = useCallback(async () => {
    if (!instance) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-get-qrcode?instanceId=${instance.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        if (data.status === 'connected') {
          setIsConnected(true);
          toast.success('WhatsApp já está conectado!');
          queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
          setTimeout(() => onClose(), 1500);
          return;
        }
        throw new Error(data.error || 'Erro ao obter QR Code');
      }

      // Handle base64 image - may or may not have data:image prefix
      let qrImage = data.qrCode;
      if (typeof qrImage === 'string' && !qrImage.startsWith('data:')) {
        qrImage = `data:image/png;base64,${qrImage}`;
      }
      
      setQrCode(qrImage);
      setCountdown(30);
      
    } catch (err: any) {
      console.error('Error fetching QR Code:', err);
      setError(err.message || 'Erro ao obter QR Code');
    } finally {
      setIsLoading(false);
    }
  }, [instance, queryClient, onClose]);

  const checkConnectionStatus = useCallback(async () => {
    if (!instance || isConnected) return;
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-instance-status?instanceId=${instance.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (data.connected || data.status === 'connected') {
        setIsConnected(true);
        toast.success('WhatsApp conectado com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      // Silently fail status checks
      console.log('Status check failed:', err);
    }
  }, [instance, isConnected, queryClient, onClose]);

  // Fetch QR Code when modal opens
  useEffect(() => {
    if (isOpen && instance) {
      setIsConnected(false);
      setError(null);
      setQrCode(null);
      fetchQRCode();
    }
  }, [isOpen, instance, fetchQRCode]);

  // Auto-refresh QR Code every 30 seconds
  useEffect(() => {
    if (!isOpen || isConnected || isLoading) return;

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchQRCode();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isOpen, isConnected, isLoading, fetchQRCode]);

  // Poll connection status every 5 seconds
  useEffect(() => {
    if (!isOpen || isConnected) return;

    const statusInterval = setInterval(checkConnectionStatus, 5000);
    
    return () => clearInterval(statusInterval);
  }, [isOpen, isConnected, checkConnectionStatus]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            {instance?.name && `Conectando: ${instance.name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {isConnected ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <p className="text-lg font-medium text-green-600">Conectado com sucesso!</p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <WifiOff className="h-10 w-10 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button onClick={fetchQRCode} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          ) : qrCode ? (
            <>
              <div className="relative">
                <img 
                  src={qrCode} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64 rounded-lg border"
                />
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                  {countdown}s
                </div>
              </div>
              
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Smartphone className="h-5 w-5 mt-0.5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Abra o WhatsApp no seu celular</p>
                    <p>Vá em <strong>Configurações</strong> → <strong>Aparelhos conectados</strong></p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <QrCode className="h-5 w-5 mt-0.5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Escaneie o QR Code</p>
                    <p>Toque em <strong>"Conectar aparelho"</strong> e aponte a câmera para a tela</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aguardando leitura do QR Code...
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {isConnected ? 'Fechar' : 'Cancelar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
