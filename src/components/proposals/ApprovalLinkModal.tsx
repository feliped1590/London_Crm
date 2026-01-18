import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Link2, Calendar, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approvalLink: string;
  expiresAt: string | null;
  proposalNumber: string;
}

export function ApprovalLinkModal({
  open,
  onOpenChange,
  approvalLink,
  expiresAt,
  proposalNumber,
}: ApprovalLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(approvalLink);
      setCopied(true);
      toast.success('Link copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleOpenLink = () => {
    window.open(approvalLink, '_blank');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não definida';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Link de Aprovação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Proposta</p>
            <p className="font-semibold">{proposalNumber}</p>
          </div>

          <div className="space-y-2">
            <Label>Link para o Cliente</Label>
            <div className="flex gap-2">
              <Input
                value={approvalLink}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Expira em: {formatDate(expiresAt)}</span>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Instruções:</strong> Envie este link ao cliente por email ou WhatsApp. 
              Ele poderá visualizar a proposta completa e aprovar ou recusar diretamente.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleOpenLink} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Visualizar
          </Button>
          <Button onClick={handleCopy} className="gap-2">
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
