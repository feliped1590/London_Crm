import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Trash2, CalendarIcon, Lock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePricingTables } from '@/hooks/usePricingTables';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface OrderItemDraft {
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_percent: number;
  width?: number;
  length?: number;
  thickness?: number;
}

export function OrderDialog({ open, onOpenChange, onSuccess }: OrderDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { getApplicableTable, calculatePrice, pricingTables } = usePricingTables();
  
  const [companyId, setCompanyId] = useState<string>('');
  const [contactId, setContactId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [observations, setObservations] = useState('');
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Fetch companies
  const { data: companies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: async (): Promise<Array<{ id: string; first_name: string; last_name: string | null }>> => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .order('first_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch products
  type ProductItem = {
    id: string;
    sku: string;
    name: string;
    category: string | null;
    unit_price: number | null;
    width: number | null;
    length: number | null;
    thickness: number | null;
  };
  
  const { data: products } = useQuery({
    queryKey: ['products-active'],
    queryFn: async (): Promise<ProductItem[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, category, unit_price, width, length, thickness')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as ProductItem[];
    },
  });

  // Check linked pricing table
  const linkedPricingTable = companyId
    ? pricingTables?.find(t => t.id === getApplicableTable('company', companyId, null)?.id)
    : contactId
      ? pricingTables?.find(t => t.id === getApplicableTable('contact', contactId, null)?.id)
      : null;

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCompanyId('');
      setContactId('');
      setDeliveryDate(undefined);
      setObservations('');
      setItems([]);
      setSelectedProductId('');
    }
  }, [open]);

  // Calculate total
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  // Add product to items
  const addProductToItems = () => {
    if (!selectedProductId) return;
    
    const product = products?.find(p => p.id === selectedProductId);
    if (!product) return;

    // Use pricing hierarchy to get the applicable price
    const applicableTable = getApplicableTable(
      companyId ? 'company' : contactId ? 'contact' : null,
      companyId || contactId || null,
      product.id
    );

    let unitPrice = product.unit_price || 0;
    let discountPercent = 0;

    if (applicableTable) {
      const { finalPrice, rule } = calculatePrice(
        applicableTable.id,
        product.id,
        product.category,
        1,
        product.unit_price || 0
      );
      unitPrice = finalPrice;
      if (rule?.discount_percent) {
        discountPercent = rule.discount_percent;
      }
    }

    const newItem: OrderItemDraft = {
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: unitPrice,
      subtotal: unitPrice,
      discount_percent: discountPercent,
      width: product.width || undefined,
      length: product.length || undefined,
      thickness: product.thickness || undefined,
    };

    setItems([...items, newItem]);
    setSelectedProductId('');
  };

  // Update item
  const updateItem = (index: number, field: keyof OrderItemDraft, value: any) => {
    const updatedItems = [...items];
    const item = updatedItems[index];
    
    if (field === 'quantity') {
      item.quantity = Number(value) || 1;
      
      // Recalculate price based on new quantity using pricing hierarchy
      const product = products?.find(p => p.id === item.product_id);
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
            item.quantity,
            product.unit_price || 0
          );
          item.unit_price = finalPrice;
          if (rule?.discount_percent) {
            item.discount_percent = rule.discount_percent;
          }
        }
      }
      
      item.subtotal = item.quantity * item.unit_price;
    } else {
      (item as any)[field] = value;
      if (field === 'unit_price') {
        item.subtotal = item.quantity * Number(value);
      }
    }
    
    setItems(updatedItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Check if any pricing table is active
  const hasPricingTable = !!linkedPricingTable || items.some(item => {
    const product = products?.find(p => p.id === item.product_id);
    if (!product) return false;
    return !!getApplicableTable(
      companyId ? 'company' : contactId ? 'contact' : null,
      companyId || contactId || null,
      product.id
    );
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) {
        throw new Error('Adicione pelo menos um item ao pedido');
      }
      if (!companyId && !contactId) {
        throw new Error('Selecione uma empresa ou contato');
      }

      // Create order - number is auto-generated by database trigger
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          number: '', // Will be auto-generated
          company_id: companyId || null,
          contact_id: contactId || null,
          delivery_date: deliveryDate?.toISOString().split('T')[0] || null,
          observations,
          total_value: calculateTotal(),
          status: 'pendente',
          created_by: user?.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item, index) => ({
        order_id: order.id,
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        discount_percent: item.discount_percent,
        width: item.width,
        length: item.length,
        thickness: item.thickness,
        sort_order: index,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Pedido criado com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar pedido');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Novo Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Client Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={(val) => setCompanyId(val === '__none__' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <Select value={contactId} onValueChange={(val) => setContactId(val === '__none__' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {contacts?.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing Table Indicator */}
          {linkedPricingTable && (
            <div className="p-3 bg-muted rounded-lg">
              <Badge variant="secondary" className="gap-1.5 px-2 py-1">
                <DollarSign className="h-3.5 w-3.5" />
                {linkedPricingTable.name}
              </Badge>
            </div>
          )}

          {/* Delivery Date */}
          <div className="space-y-2">
            <Label>Data de Entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !deliveryDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deliveryDate ? format(deliveryDate, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deliveryDate}
                  onSelect={setDeliveryDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Add Product */}
          <div className="space-y-2">
            <Label>Adicionar Produto</Label>
            <div className="flex gap-2">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.sku} - {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addProductToItems} disabled={!selectedProductId}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-24">Qtd</TableHead>
                    <TableHead className="w-32">Preço Unit.</TableHead>
                    <TableHead className="w-24">Desc %</TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const product = products?.find(p => p.id === item.product_id);
                    const itemHasPricingTable = product && !!getApplicableTable(
                      companyId ? 'company' : contactId ? 'contact' : null,
                      companyId || contactId || null,
                      product.id
                    );
                    const isPriceLocked = itemHasPricingTable && !isAdmin;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.description}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {product?.sku}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                              className={cn('w-28', isPriceLocked && 'pr-8')}
                              disabled={isPriceLocked}
                            />
                            {isPriceLocked && (
                              <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.discount_percent > 0 && (
                            <span className="text-primary font-medium">
                              {item.discount_percent}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.subtotal)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Total */}
          {items.length > 0 && (
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">{formatCurrency(calculateTotal())}</p>
              </div>
            </div>
          )}

          {/* Observations */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Observações do pedido..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createOrderMutation.mutate()}
            disabled={createOrderMutation.isPending || items.length === 0 || (!companyId && !contactId)}
          >
            {createOrderMutation.isPending ? 'Criando...' : 'Criar Pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
