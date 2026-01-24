import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Package, FileText, Check, X, Download, Link2, Loader2, DollarSign, Lock, AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/formatters';
import { usePricingTables } from '@/hooks/usePricingTables';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  Proposal,
  ProposalItem,
  Product,
  ProposalStatus,
  proposalStatusConfig,
} from '@/types/products';
import { ApprovalLinkModal } from './ApprovalLinkModal';
import { PriceOverrideModal } from './PriceOverrideModal';

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  companyId?: string | null;
  contactId?: string | null;
  proposal?: Proposal | null;
  onSuccess?: () => void;
}

export function ProposalDialog({
  open,
  onOpenChange,
  dealId,
  companyId,
  contactId,
  proposal,
  onSuccess,
}: ProposalDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const { getTableForEntity, getApplicableTable, calculatePrice, validatePriceAgainstTable, pricingTables } = usePricingTables();
  const isEditing = !!proposal;

  // Get linked pricing table based on company or contact (legacy method)
  const linkedPricingTableFromEntity = companyId 
    ? getTableForEntity('company', companyId)
    : contactId 
      ? getTableForEntity('contact', contactId) 
      : null;

  // Check if any pricing table applies (via entity OR product rules OR default)
  const hasPricingTableLinked = linkedPricingTableFromEntity !== null;

  const [formData, setFormData] = useState({
    validity_date: '',
    payment_terms: '',
    delivery_terms: '',
    observations: '',
    status: 'rascunho' as ProposalStatus,
  });

  const [items, setItems] = useState<Partial<ProposalItem>[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Approval link states
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalLink, setApprovalLink] = useState('');
  const [approvalExpires, setApprovalExpires] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Price override modal states (for admin authorization)
  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [priceChangeConfirmed, setPriceChangeConfirmed] = useState(false);
  const [pendingPriceChange, setPendingPriceChange] = useState<{
    index: number;
    field: 'unit_price' | 'discount_percent';
    value: number;
    itemDescription: string;
    currentPrice: number;
    proposedPrice: number;
    pricingTableName: string;
  } | null>(null);

  // Load proposal data when editing
  useEffect(() => {
    if (proposal) {
      setFormData({
        validity_date: proposal.validity_date || '',
        payment_terms: proposal.payment_terms || '',
        delivery_terms: proposal.delivery_terms || '',
        observations: proposal.observations || '',
        status: proposal.status,
      });
    } else {
      // Default validity date: 30 days from now
      const defaultValidity = new Date();
      defaultValidity.setDate(defaultValidity.getDate() + 30);
      setFormData({
        validity_date: defaultValidity.toISOString().split('T')[0],
        payment_terms: '',
        delivery_terms: '',
        observations: '',
        status: 'rascunho',
      });
      setItems([]);
    }
  }, [proposal, open]);

  // Load proposal items when editing
  const { data: existingItems } = useQuery({
    queryKey: ['proposal_items', proposal?.id],
    queryFn: async () => {
      if (!proposal) return [];
      const { data, error } = await supabase
        .from('proposal_items')
        .select('*, product:products(id, sku, name)')
        .eq('proposal_id', proposal.id)
        .order('sort_order');
      if (error) throw error;
      return data as ProposalItem[];
    },
    enabled: !!proposal,
  });

  useEffect(() => {
    if (existingItems) {
      setItems(existingItems);
    }
  }, [existingItems]);

  const { data: products } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async () => {
      // Create proposal
      const { data: newProposal, error: proposalError } = await supabase
        .from('proposals')
        .insert({
          number: '', // Will be auto-generated by trigger
          deal_id: dealId,
          company_id: companyId,
          contact_id: contactId,
          status: formData.status,
          validity_date: formData.validity_date || null,
          payment_terms: formData.payment_terms || null,
          delivery_terms: formData.delivery_terms || null,
          observations: formData.observations || null,
          total_value: calculateTotal(),
        } as any)
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Create items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          proposal_id: newProposal.id,
          product_id: item.product_id || null,
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          width: item.width || null,
          length: item.length || null,
          thickness: item.thickness || null,
          discount_percent: item.discount_percent || 0,
          subtotal: calculateItemSubtotal(item),
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('proposal_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // If created as approved, also create order
      if (formData.status === 'aprovada') {
        await createOrderFromProposal(newProposal.id);
      }

      return newProposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Proposta criada com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => toast.error('Erro ao criar proposta'),
  });

  const updateProposalMutation = useMutation({
    mutationFn: async () => {
      if (!proposal) return;

      // Update proposal
      const { error: proposalError } = await supabase
        .from('proposals')
        .update({
          status: formData.status,
          validity_date: formData.validity_date || null,
          payment_terms: formData.payment_terms || null,
          delivery_terms: formData.delivery_terms || null,
          observations: formData.observations || null,
          total_value: calculateTotal(),
        })
        .eq('id', proposal.id);

      if (proposalError) throw proposalError;

      // Delete existing items and recreate
      await supabase.from('proposal_items').delete().eq('proposal_id', proposal.id);

      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          proposal_id: proposal.id,
          product_id: item.product_id || null,
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          width: item.width || null,
          length: item.length || null,
          thickness: item.thickness || null,
          discount_percent: item.discount_percent || 0,
          subtotal: calculateItemSubtotal(item),
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('proposal_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // If approved, create order
      if (formData.status === 'aprovada' && proposal.status !== 'aprovada') {
        await createOrderFromProposal(proposal.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Proposta atualizada!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => toast.error('Erro ao atualizar proposta'),
  });

  const createOrderFromProposal = async (proposalId: string) => {
    // Get proposal data
    const { data: proposalData } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (!proposalData) return;

    // Create order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        number: '', // Will be auto-generated by trigger
        proposal_id: proposalId,
        company_id: proposalData.company_id,
        contact_id: proposalData.contact_id,
        status: 'pendente',
        total_value: proposalData.total_value,
        observations: proposalData.observations,
      } as any)
      .select()
      .single();

    if (orderError) throw orderError;

    // Get proposal items
    const { data: proposalItems } = await supabase
      .from('proposal_items')
      .select('*')
      .eq('proposal_id', proposalId);

    if (proposalItems && proposalItems.length > 0) {
      const orderItems = proposalItems.map((item) => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        width: item.width,
        length: item.length,
        thickness: item.thickness,
        subtotal: item.subtotal,
        sort_order: item.sort_order,
      }));

      await supabase.from('order_items').insert(orderItems);
    }

    toast.success('Pedido gerado automaticamente!');
  };

  const calculateItemSubtotal = (item: Partial<ProposalItem>) => {
    const qty = item.quantity || 1;
    const price = item.unit_price || 0;
    const discount = item.discount_percent || 0;
    return qty * price * (1 - discount / 100);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  };

  const addProductToItems = () => {
    if (!selectedProductId) return;

    const product = products?.find((p) => p.id === selectedProductId);
    if (!product) return;

    let unitPrice = product.unit_price || 0;
    let discountPercent = 0;

    // Apply pricing table rules using hierarchy: Entity > Product > Default
    const applicableTable = getApplicableTable(
      companyId ? 'company' : contactId ? 'contact' : null,
      companyId || contactId || null,
      product.id
    );

    if (applicableTable) {
      const { finalPrice, rule } = calculatePrice(
        applicableTable.id,
        product.id,
        product.category,
        1, // initial quantity
        product.unit_price || 0
      );
      unitPrice = finalPrice;
      if (rule?.discount_percent) {
        discountPercent = rule.discount_percent;
      }
    }

    setItems([
      ...items,
      {
        product_id: product.id,
        description: product.name,
        quantity: 1,
        unit_price: unitPrice,
        width: product.width,
        length: product.length,
        thickness: product.thickness,
        discount_percent: discountPercent,
        subtotal: unitPrice,
        product: product,
      },
    ]);
    setSelectedProductId('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Helper to validate price on blur - now allows editing but validates afterwards
  const handlePriceBlur = (index: number, field: 'unit_price' | 'discount_percent') => {
    const item = items[index];
    if (!item.product_id) return;

    const product = products?.find(p => p.id === item.product_id);
    if (!product) return;

    // Validate against pricing table
    const validation = validatePriceAgainstTable(
      companyId ? 'company' : contactId ? 'contact' : null,
      companyId || contactId || null,
      product.id,
      product.category || null,
      item.quantity || 1,
      product.unit_price || 0,
      item.unit_price || 0
    );

    // If no pricing table applies, no validation needed
    if (!validation) return;

    // If price matches table, no action needed
    if (validation.isValid) return;

    // Price differs from table - check if user is admin
    if (!isAdmin) {
      // Non-admin: revert to table price
      toast.error('Preço revertido. Apenas administradores podem alterar preços fora da tabela.');
      const updatedItems = [...items];
      updatedItems[index].unit_price = validation.expectedPrice;
      updatedItems[index].subtotal = calculateItemSubtotal({ ...updatedItems[index], unit_price: validation.expectedPrice });
      setItems(updatedItems);
      return;
    }

    // Admin: show authorization modal
    setPendingPriceChange({
      index,
      field,
      value: item.unit_price || 0,
      itemDescription: item.description || 'Item',
      currentPrice: validation.expectedPrice,
      proposedPrice: item.unit_price || 0,
      pricingTableName: validation.tableName || 'Tabela de Preços',
    });
    setShowPriceOverrideModal(true);
  };

  // Direct item update without authorization check
  const updateItemDirect = (index: number, field: keyof ProposalItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    updatedItems[index].subtotal = calculateItemSubtotal(updatedItems[index]);
    setItems(updatedItems);
  };

  // Handle price override confirmation from admin
  const handlePriceOverrideConfirm = async (justification: string) => {
    if (!pendingPriceChange) return;

    const { index, field, value, currentPrice, proposedPrice } = pendingPriceChange;
    const item = items[index];

    // Record the override in deal_audit_log
    try {
      await supabase.from('deal_audit_log').insert({
        deal_id: dealId,
        field_name: `proposal_price_override`,
        field_label: `Override de Preço (Proposta ${proposal?.number || 'Nova'})`,
        old_value: `${item.description}: Preço Tabela = R$ ${currentPrice.toFixed(2)}`,
        new_value: `Novo Preço = R$ ${proposedPrice.toFixed(2)} | Justificativa: ${justification}`,
        changed_by: user?.id,
      });

      // Mark that the change was confirmed so we don't revert on close
      setPriceChangeConfirmed(true);
      toast.success('Alteração de preço autorizada e registrada');
    } catch (error) {
      console.error('Error logging price override:', error);
      toast.error('Erro ao registrar alteração');
    }

    setPendingPriceChange(null);
  };

  // Handle cancellation of price override - revert to table price
  const handlePriceOverrideCancel = () => {
    if (!pendingPriceChange) return;
    
    const { index, currentPrice } = pendingPriceChange;
    const updatedItems = [...items];
    updatedItems[index].unit_price = currentPrice;
    updatedItems[index].subtotal = calculateItemSubtotal(updatedItems[index]);
    setItems(updatedItems);
    
    setPendingPriceChange(null);
    setShowPriceOverrideModal(false);
    toast.info('Preço revertido para o valor da tabela');
  };

  const updateItem = (index: number, field: keyof ProposalItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // If quantity changed and pricing table applies, recalculate price
    if (field === 'quantity' && updatedItems[index].product_id) {
      const product = products?.find(p => p.id === updatedItems[index].product_id);
      if (product) {
        const applicableTable = getApplicableTable(
          companyId ? 'company' : contactId ? 'contact' : null,
          companyId || contactId || null,
          product.id
        );
        if (applicableTable) {
          const { finalPrice, rule } = calculatePrice(
            applicableTable.id,
            product.id,
            product.category,
            value as number,
            product.unit_price || 0
          );
          updatedItems[index].unit_price = finalPrice;
          if (rule?.discount_percent) {
            updatedItems[index].discount_percent = rule.discount_percent;
          }
        }
      }
    }
    
    updatedItems[index].subtotal = calculateItemSubtotal(updatedItems[index]);
    setItems(updatedItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Adicione pelo menos um item à proposta');
      return;
    }

    if (isEditing) {
      updateProposalMutation.mutate();
    } else {
      createProposalMutation.mutate();
    }
  };

  const handleGeneratePDF = async () => {
    if (!proposal) return;
    
    try {
      toast.info('Gerando proposta...');
      const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', {
        body: { proposal_id: proposal.id },
      });

      if (error) throw error;

      if (data?.html) {
        // Open HTML in new tab for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          toast.success('Proposta gerada! Use Ctrl+P para salvar como PDF.');
        }
      } else {
        toast.error('Erro ao gerar proposta');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleGenerateApprovalLink = async () => {
    if (!proposal) return;
    
    try {
      setGeneratingLink(true);
      
      // Generate UUID token
      const token = crypto.randomUUID();
      
      // Set expiration to validity date or 30 days from now
      const expiresAt = proposal.validity_date 
        ? new Date(proposal.validity_date).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Update proposal with token
      const { error } = await supabase
        .from('proposals')
        .update({
          approval_token: token,
          approval_token_expires_at: expiresAt,
        })
        .eq('id', proposal.id);

      if (error) throw error;

      // Build the approval link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/proposta/${token}`;
      
      setApprovalLink(link);
      setApprovalExpires(expiresAt);
      setShowApprovalModal(true);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      
      toast.success('Link de aprovação gerado!');
    } catch (error) {
      console.error('Error generating approval link:', error);
      toast.error('Erro ao gerar link de aprovação');
    } finally {
      setGeneratingLink(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditing ? `Editar Proposta ${proposal?.number}` : 'Nova Proposta'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Proposal Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="validity_date">Data de Validade</Label>
                  <Input
                    id="validity_date"
                    type="date"
                    value={formData.validity_date}
                    onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as ProposalStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(proposalStatusConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payment_terms">Cond. Pagamento</Label>
                  <Input
                    id="payment_terms"
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    placeholder="Ex: 30/60/90"
                  />
                </div>
                <div>
                  <Label htmlFor="delivery_terms">Prazo Entrega</Label>
                  <Input
                    id="delivery_terms"
                    value={formData.delivery_terms}
                    onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                    placeholder="Ex: 15 dias"
                  />
                </div>
              </div>

              {/* Pricing Table Indicator */}
              {linkedPricingTableFromEntity && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      Tabela de preços vinculada: <strong>{linkedPricingTableFromEntity.name}</strong>
                    </span>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      {isAdmin 
                        ? 'Você pode editar preços. Alterações fora da tabela requerem justificativa.'
                        : 'Preços são ajustados automaticamente conforme a tabela.'
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Add Product */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Adicionar Produto do Catálogo</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono text-xs mr-2">{p.sku}</span>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={addProductToItems} disabled={!selectedProductId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">SKU</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[100px]">Medidas</TableHead>
                      <TableHead className="w-[80px]">Qtd</TableHead>
                      <TableHead className="w-[100px]">Preço Un.</TableHead>
                      <TableHead className="w-[80px]">Desc %</TableHead>
                      <TableHead className="w-[100px] text-right">Subtotal</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Adicione produtos à proposta
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">
                            {item.product?.sku || '-'}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.description || ''}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                placeholder="L"
                                value={item.width || ''}
                                onChange={(e) => updateItem(index, 'width', parseFloat(e.target.value) || 0)}
                                className="h-8 w-12 p-1 text-xs"
                              />
                              <Input
                                type="number"
                                placeholder="C"
                                value={item.length || ''}
                                onChange={(e) => updateItem(index, 'length', parseFloat(e.target.value) || 0)}
                                className="h-8 w-12 p-1 text-xs"
                              />
                              <Input
                                type="number"
                                placeholder="E"
                                value={item.thickness || ''}
                                onChange={(e) => updateItem(index, 'thickness', parseFloat(e.target.value) || 0)}
                                className="h-8 w-12 p-1 text-xs"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              value={item.quantity || 1}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_price || 0}
                                onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                onBlur={() => handlePriceBlur(index, 'unit_price')}
                                className={`h-8 ${hasPricingTableLinked && !isAdmin ? 'bg-muted' : ''}`}
                                disabled={hasPricingTableLinked && !isAdmin}
                              />
                              {hasPricingTableLinked && (
                                <DollarSign className={`absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 ${isAdmin ? 'text-amber-500' : 'text-muted-foreground'}`} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.discount_percent || 0}
                                onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                                onBlur={() => handlePriceBlur(index, 'discount_percent')}
                                className={`h-8 ${hasPricingTableLinked && !isAdmin ? 'bg-muted' : ''}`}
                                disabled={hasPricingTableLinked && !isAdmin}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(calculateItemSubtotal(item))}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="text-right p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground text-sm">Valor Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(calculateTotal())}</p>
                </div>
              </div>

              {/* Observations */}
              <div>
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  rows={3}
                  placeholder="Condições especiais, informações adicionais..."
                />
              </div>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-between gap-2 pt-4 border-t mt-4">
            <div className="flex gap-2">
              {isEditing && (
                <>
                  <Button type="button" variant="outline" onClick={handleGeneratePDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Gerar PDF
                  </Button>
                  {(proposal?.status === 'rascunho' || proposal?.status === 'enviada' || proposal?.status === 'em_analise') && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleGenerateApprovalLink}
                      disabled={generatingLink}
                    >
                      {generatingLink ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Link de Aprovação
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createProposalMutation.isPending || updateProposalMutation.isPending}
              >
                {isEditing ? 'Atualizar' : 'Criar Proposta'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Approval Link Modal */}
      <ApprovalLinkModal
        open={showApprovalModal}
        onOpenChange={setShowApprovalModal}
        approvalLink={approvalLink}
        expiresAt={approvalExpires}
        proposalNumber={proposal?.number || ''}
      />

      {/* Price Override Authorization Modal */}
      {pendingPriceChange && (
        <PriceOverrideModal
          open={showPriceOverrideModal}
          onOpenChange={(open) => {
            if (!open) {
              // Only revert if the change was NOT confirmed
              if (!priceChangeConfirmed) {
                handlePriceOverrideCancel();
              }
              // Reset the confirmation flag
              setPriceChangeConfirmed(false);
            }
            setShowPriceOverrideModal(open);
          }}
          onConfirm={handlePriceOverrideConfirm}
          itemDescription={pendingPriceChange.itemDescription}
          currentPrice={pendingPriceChange.currentPrice}
          proposedPrice={pendingPriceChange.proposedPrice}
          pricingTableName={pendingPriceChange.pricingTableName}
        />
      )}
    </Dialog>
  );
}
