import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Building2, 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface ProposalData {
  id: string;
  number: string;
  status: string;
  validity_date: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  observations: string | null;
  total_value: number | null;
  subtotal_products: number | null;
  total_ipi: number | null;
  ipi_mode: string | null;
  created_at: string;
  company: {
    name: string;
    cnpj: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  contact: {
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  legal_entity: {
    name: string;
    trade_name: string | null;
    cnpj: string;
    logo_url: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    width: number | null;
    length: number | null;
    thickness: number | null;
    discount_percent: number | null;
    subtotal: number;
    ipi_rate: number | null;
    ipi_value: number | null;
    subtotal_item: number | null;
    total_item: number | null;
    product: {
      sku: string;
      name: string;
    } | null;
  }>;
}

export default function ProposalPublic() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ type: 'approved' | 'rejected'; orderNumber?: string } | null>(null);

  useEffect(() => {
    if (token) {
      fetchProposal();
    }
  }, [token]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fnError } = await supabase.functions.invoke('proposal-public-view', {
        body: { token }
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        setError(data.error);
        setErrorStatus(data.status || null);
        return;
      }

      setProposal(data.proposal);
    } catch (err) {
      console.error('Error fetching proposal:', err);
      setError('Erro ao carregar proposta. Verifique se o link está correto.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approverName.trim()) return;
    
    try {
      setSubmitting(true);
      
      const { data, error: fnError } = await supabase.functions.invoke('proposal-approve', {
        body: { 
          token, 
          action: 'approve',
          approver_name: approverName
        }
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        setError(data.error);
        return;
      }

      setSuccess({ type: 'approved', orderNumber: data.order_number });
      setShowApproveDialog(false);
    } catch (err) {
      console.error('Error approving proposal:', err);
      setError('Erro ao aprovar proposta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      
      const { data, error: fnError } = await supabase.functions.invoke('proposal-approve', {
        body: { 
          token, 
          action: 'reject',
          rejection_reason: rejectionReason
        }
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        setError(data.error);
        return;
      }

      setSuccess({ type: 'rejected' });
      setShowRejectDialog(false);
    } catch (err) {
      console.error('Error rejecting proposal:', err);
      setError('Erro ao recusar proposta');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando proposta...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {errorStatus === 'aprovada' ? (
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            ) : errorStatus === 'recusada' ? (
              <XCircle className="h-12 w-12 text-destructive mb-4" />
            ) : (
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            )}
            <h2 className="text-xl font-semibold mb-2">
              {errorStatus === 'aprovada' ? 'Proposta Aprovada' : 
               errorStatus === 'recusada' ? 'Proposta Recusada' : 
               'Link Inválido'}
            </h2>
            <p className="text-muted-foreground text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {success.type === 'approved' ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-green-600 mb-2">Proposta Aprovada!</h2>
                <p className="text-muted-foreground text-center mb-4">
                  Obrigado! Sua aprovação foi registrada com sucesso.
                </p>
                {success.orderNumber && (
                  <p className="text-sm text-muted-foreground">
                    Pedido gerado: <span className="font-mono font-semibold">{success.orderNumber}</span>
                  </p>
                )}
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-orange-500 mb-4" />
                <h2 className="text-2xl font-bold text-orange-600 mb-2">Proposta Recusada</h2>
                <p className="text-muted-foreground text-center">
                  Sua resposta foi registrada. Obrigado pelo retorno.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proposal) return null;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{proposal.number}</CardTitle>
                  <p className="text-sm text-muted-foreground">Proposta Comercial</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Válida até: {formatDate(proposal.validity_date)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Issuer (Legal Entity) */}
            {proposal.legal_entity && (
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-3">
                  {proposal.legal_entity.logo_url && (
                    <img 
                      src={proposal.legal_entity.logo_url} 
                      alt={proposal.legal_entity.trade_name || proposal.legal_entity.name}
                      className="h-12 w-auto object-contain"
                    />
                  )}
                  <div>
                    <p className="font-bold text-lg">
                      {proposal.legal_entity.trade_name || proposal.legal_entity.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      CNPJ: {proposal.legal_entity.cnpj}
                    </p>
                    {proposal.legal_entity.address && (
                      <p className="text-sm text-muted-foreground">
                        {proposal.legal_entity.address}
                        {proposal.legal_entity.city ? ` - ${proposal.legal_entity.city}` : ''}
                        {proposal.legal_entity.state ? `/${proposal.legal_entity.state}` : ''}
                      </p>
                    )}
                    {(proposal.legal_entity.phone || proposal.legal_entity.email) && (
                      <p className="text-sm text-muted-foreground">
                        {proposal.legal_entity.phone}{proposal.legal_entity.phone && proposal.legal_entity.email ? ' | ' : ''}{proposal.legal_entity.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Company Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-semibold">{proposal.company?.name || 'Não informado'}</p>
                  {proposal.company?.cnpj && (
                    <p className="text-sm text-muted-foreground">CNPJ: {proposal.company.cnpj}</p>
                  )}
                  {proposal.company?.address && (
                    <p className="text-sm text-muted-foreground">{proposal.company.address}</p>
                  )}
                  {proposal.company?.city && (
                    <p className="text-sm text-muted-foreground">
                      {proposal.company.city}{proposal.company.state ? ` - ${proposal.company.state}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  Contato
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-semibold">
                    {proposal.contact 
                      ? `${proposal.contact.first_name} ${proposal.contact.last_name || ''}`
                      : 'Não informado'}
                  </p>
                  {proposal.contact?.email && (
                    <p className="text-sm text-muted-foreground">{proposal.contact.email}</p>
                  )}
                  {proposal.contact?.phone && (
                    <p className="text-sm text-muted-foreground">{proposal.contact.phone}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Itens da Proposta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead className="w-[100px]">SKU</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Medidas</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço Un.</TableHead>
                    <TableHead className="text-right">Desc.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposal.items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{item.product?.sku || '-'}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-center text-sm">
                        {item.width || '-'} x {item.length || '-'} x {item.thickness || '-'}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{item.discount_percent || 0}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4">
              <div className="bg-primary/10 rounded-lg p-4 text-right">
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(proposal.total_value || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms */}
        {(proposal.payment_terms || proposal.delivery_terms || proposal.observations) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Condições Comerciais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proposal.payment_terms && (
                <div>
                  <span className="font-medium">Pagamento:</span> {proposal.payment_terms}
                </div>
              )}
              {proposal.delivery_terms && (
                <div>
                  <span className="font-medium">Prazo de Entrega:</span> {proposal.delivery_terms}
                </div>
              )}
              {proposal.observations && (
                <div>
                  <span className="font-medium">Observações:</span> {proposal.observations}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => setShowApproveDialog(true)}
              >
                <CheckCircle2 className="h-5 w-5" />
                Aprovar Proposta
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowRejectDialog(true)}
              >
                <XCircle className="h-5 w-5" />
                Recusar Proposta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Proposta gerada em {formatDate(proposal.created_at)}</p>
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Confirmar Aprovação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              Ao aprovar esta proposta, você concorda com os termos e condições apresentados.
            </p>
            <div className="space-y-2">
              <Label htmlFor="approver_name">Nome do Responsável *</Label>
              <Input
                id="approver_name"
                placeholder="Digite seu nome completo"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={!approverName.trim() || submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Recusar Proposta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              Por favor, informe o motivo da recusa (opcional).
            </p>
            <div className="space-y-2">
              <Label htmlFor="rejection_reason">Motivo da Recusa</Label>
              <Textarea
                id="rejection_reason"
                placeholder="Ex: Preço acima do orçamento, prazo não atende..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReject} 
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
