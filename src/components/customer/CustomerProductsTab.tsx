import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Link2, Package, Plus, ShoppingCart, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  relationshipTypeOptions,
  useCompanyProducts,
  type CompanyProductRelationshipType,
} from '@/hooks/useCompanyProducts';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { PermissionAction } from '@/lib/permissions/permissionEngine';
import { formatCurrency } from '@/lib/formatters';

interface CustomerProductsTabProps {
  companyId: string;
  canEdit: boolean;
}

const relationshipTypeVariant: Record<CompanyProductRelationshipType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  INTEREST: 'secondary',
  HOMOLOGATED: 'default',
  RECURRENT: 'outline',
  STRATEGIC: 'default',
  BLACKLIST: 'destructive',
};

export function CustomerProductsTab({ companyId, canEdit }: CustomerProductsTabProps) {
  const navigate = useNavigate();
  const { can } = useModulePermissions();
  const canCreateProducts = can('products', PermissionAction.Create);
  const {
    companyProducts,
    isLoading,
    availableProducts,
    isLoadingProducts,
    setProductSearch,
    createLinkMutation,
    archiveLinkMutation,
  } = useCompanyProducts(companyId);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] = useState<CompanyProductRelationshipType>('INTEREST');
  const [notes, setNotes] = useState('');
  const [isPreferred, setIsPreferred] = useState(false);

  const selectedProduct = useMemo(
    () => availableProducts.find((product) => product.id === selectedProductId) ?? null,
    [availableProducts, selectedProductId],
  );

  const handleCreateLink = () => {
    if (!selectedProductId) return;

    createLinkMutation.mutate(
      {
        productId: selectedProductId,
        relationshipType,
        notes,
        isPreferred,
      },
      {
        onSuccess: () => {
          setSelectedProductId(null);
          setRelationshipType('INTEREST');
          setNotes('');
          setIsPreferred(false);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Itens vinculados
              </CardTitle>
              <CardDescription>
                Relação manual e estratégica entre este cliente e os produtos do catálogo.
              </CardDescription>
            </div>
            {canEdit && canCreateProducts && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 self-start"
                onClick={() => navigate(`/products?createForCompany=${companyId}`)}
              >
                <Plus className="h-4 w-4" />
                Criar item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Link2 className="h-3 w-3" />
                Vínculo manual
              </Badge>
              <span>
                Os itens abaixo representam a camada estratégica manual, independente do histórico transacional.
              </span>
            </div>
          </div>

          {canEdit && (
            <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <SearchableSelect
                    options={availableProducts.map((product) => ({
                      value: product.id,
                      label: product.is_already_ordered ? `${product.name} • Já comprado` : product.name,
                      searchTerms: [
                        product.sku,
                        product.is_already_ordered ? 'Já comprado' : null,
                        product.last_order_at ? `Última compra ${new Date(product.last_order_at).toLocaleDateString('pt-BR')}` : null,
                      ].filter(Boolean).join(' • '),
                    }))}
                    value={selectedProductId}
                    onChange={setSelectedProductId}
                    placeholder="Buscar produto por nome ou SKU..."
                    searchPlaceholder="Digite nome ou SKU"
                    emptyMessage={isLoadingProducts ? 'Carregando produtos...' : 'Nenhum produto disponível'}
                    onSearchChange={setProductSearch}
                  />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">
                      SKU: {selectedProduct.sku} • {formatCurrency(selectedProduct.unit_price || 0)}
                      {selectedProduct.is_already_ordered && ' • Já comprado'}
                      {selectedProduct.last_order_at && ` • Última compra: ${new Date(selectedProduct.last_order_at).toLocaleDateString('pt-BR')}`}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo de vínculo</Label>
                  <Select value={relationshipType} onValueChange={(value) => setRelationshipType(value as CompanyProductRelationshipType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {relationshipTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex.: produto homologado pelo cliente ou foco comercial do trimestre."
                  rows={3}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={isPreferred} onCheckedChange={setIsPreferred} />
                  <Label>Marcar como preferencial</Label>
                </div>

                <Button
                  onClick={handleCreateLink}
                  disabled={!selectedProductId || createLinkMutation.isPending}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Vincular produto
                </Button>
              </div>
            </div>
          )}

          {companyProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum item vinculado</h3>
              <p className="text-muted-foreground">
                {canEdit ? 'Vincule os primeiros produtos estratégicos deste cliente.' : 'Ainda não existem vínculos manuais para este cliente.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {companyProducts.map((link) => {
                const relationshipLabel = relationshipTypeOptions.find((option) => option.value === link.relationship_type)?.label || link.relationship_type;
                const metadata = (link.metadata as Record<string, unknown> | null) ?? null;
                const isAlreadyOrdered = Boolean(metadata?.is_already_ordered);
                const metadataLastOrderAt = typeof metadata?.last_order_at === 'string' ? metadata.last_order_at : null;

                return (
                  <div key={link.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{link.product?.name || 'Produto sem nome'}</p>
                          <Badge variant={relationshipTypeVariant[link.relationship_type]}>{relationshipLabel}</Badge>
                          <Badge variant="secondary" className="gap-1">
                            <Link2 className="h-3 w-3" />
                            Vínculo manual
                          </Badge>
                          {isAlreadyOrdered && (
                            <Badge variant="outline" className="gap-1">
                              <ShoppingCart className="h-3 w-3" />
                              Já comprado
                            </Badge>
                          )}
                          {link.is_preferred && (
                            <Badge variant="outline" className="gap-1">
                              <Star className="h-3 w-3" />
                              Preferencial
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <span>SKU: {link.product?.sku || '-'}</span>
                          {link.product?.unit_price != null && (
                            <span> • {formatCurrency(link.product.unit_price)}</span>
                          )}
                          {metadataLastOrderAt && (
                            <span> • Última compra: {new Date(metadataLastOrderAt).toLocaleDateString('pt-BR')}</span>
                          )}
                          {link.last_interaction_at && (
                            <span> • Última interação: {new Date(link.last_interaction_at).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>

                        {link.notes && <p className="text-sm text-foreground/80">{link.notes}</p>}
                      </div>

                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 self-start"
                          onClick={() => archiveLinkMutation.mutate(link.id)}
                          disabled={archiveLinkMutation.isPending}
                        >
                          <Archive className="h-4 w-4" />
                          Arquivar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}