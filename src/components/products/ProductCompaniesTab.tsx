import { useMemo, useState } from 'react';
import { Archive, Building2, Link2, Plus, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  relationshipTypeOptions,
  type CompanyProductRelationshipType,
} from '@/hooks/useCompanyProducts';
import { useProductCompanies } from '@/hooks/useProductCompanies';

interface ProductCompaniesTabProps {
  productId?: string;
  canEdit: boolean;
}

const relationshipTypeVariant: Record<CompanyProductRelationshipType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  INTEREST: 'secondary',
  HOMOLOGATED: 'default',
  RECURRENT: 'outline',
  STRATEGIC: 'default',
  BLACKLIST: 'destructive',
};

export function ProductCompaniesTab({ productId, canEdit }: ProductCompaniesTabProps) {
  const {
    productCompanies,
    isLoading,
    availableCompanies,
    isLoadingCompanies,
    setCompanySearch,
    createLinkMutation,
    archiveLinkMutation,
  } = useProductCompanies(productId);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] = useState<CompanyProductRelationshipType>('INTEREST');
  const [notes, setNotes] = useState('');
  const [isPreferred, setIsPreferred] = useState(false);

  const selectedCompany = useMemo(
    () => availableCompanies.find((company) => company.id === selectedCompanyId) ?? null,
    [availableCompanies, selectedCompanyId],
  );

  const handleCreateLink = () => {
    if (!selectedCompanyId) return;
    createLinkMutation.mutate(
      { companyId: selectedCompanyId, relationshipType, notes, isPreferred },
      {
        onSuccess: () => {
          setSelectedCompanyId(null);
          setRelationshipType('INTEREST');
          setNotes('');
          setIsPreferred(false);
        },
      },
    );
  };

  if (!productId) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Salve o item para vincular clientes a ele.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <SearchableSelect
                options={availableCompanies.map((company) => ({
                  value: company.id,
                  label: company.fantasia ? `${company.fantasia} • ${company.name}` : company.name,
                  searchTerms: [company.cnpj, company.city && company.state ? `${company.city}/${company.state}` : null]
                    .filter(Boolean)
                    .join(' • '),
                }))}
                value={selectedCompanyId}
                onChange={setSelectedCompanyId}
                placeholder="Buscar cliente por nome ou CNPJ..."
                searchPlaceholder="Digite nome, fantasia ou CNPJ"
                emptyMessage={isLoadingCompanies ? 'Carregando clientes...' : 'Nenhum cliente disponível'}
                onSearchChange={setCompanySearch}
              />
              {selectedCompany && (
                <p className="text-xs text-muted-foreground">
                  {selectedCompany.cnpj || 'Sem CNPJ'}
                  {selectedCompany.city && selectedCompany.state && ` • ${selectedCompany.city}/${selectedCompany.state}`}
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
              placeholder="Ex.: item homologado pelo cliente ou foco comercial do trimestre."
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
              disabled={!selectedCompanyId || createLinkMutation.isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Vincular cliente
            </Button>
          </div>
        </div>
      )}

      {productCompanies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum cliente vinculado</h3>
          <p className="text-muted-foreground">
            {canEdit ? 'Vincule os primeiros clientes estratégicos deste item.' : 'Ainda não existem vínculos manuais para este item.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {productCompanies.map((link) => {
            const relationshipLabel = relationshipTypeOptions.find((option) => option.value === link.relationship_type)?.label || link.relationship_type;
            const companyName = link.company?.fantasia || link.company?.name || 'Cliente sem nome';

            return (
              <div key={link.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{companyName}</p>
                      <Badge variant={relationshipTypeVariant[link.relationship_type]}>{relationshipLabel}</Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Link2 className="h-3 w-3" />
                        Vínculo manual
                      </Badge>
                      {link.is_preferred && (
                        <Badge variant="outline" className="gap-1">
                          <Star className="h-3 w-3" />
                          Preferencial
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <span>{link.company?.cnpj || 'Sem CNPJ'}</span>
                      {link.company?.city && link.company?.state && <span> • {link.company.city}/{link.company.state}</span>}
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
                      onClick={() => archiveLinkMutation.mutate({ linkId: link.id, companyId: link.company_id })}
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
    </div>
  );
}
