import { useState } from 'react';
import { ArrowLeftRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReallocationFilters } from '@/components/reallocation/ReallocationFilters';
import { ReallocationResultsTable } from '@/components/reallocation/ReallocationResultsTable';
import { ReallocationConfirmModal } from '@/components/reallocation/ReallocationConfirmModal';
import { usePortfolioReallocation } from '@/hooks/usePortfolioReallocation';

export function PortfolioReallocationContent() {
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  
  const {
    companies,
    availableStates,
    availableRegions,
    sellers,
    isLoading,
    filters,
    setFilters,
    clearFilters,
    selectedCompanies,
    toggleSelectCompany,
    toggleSelectAllOnPage,
    transferCompanies,
    isTransferring,
    refetch,
    currentPage,
    setCurrentPage,
    totalItems,
    totalPages,
    itemsPerPage
  } = usePortfolioReallocation();

  const selectedCompanyData = companies?.filter(c => selectedCompanies.has(c.company_id)) || [];

  const handleConfirmTransfer = (
    toSalesRepId: string,
    transferContacts: boolean,
    transferDeals: boolean,
    reason: string
  ) => {
    // Resolver user_id do vendedor destino
    const targetSeller = sellers?.find(s => s.id === toSalesRepId);

    const companySources: Record<string, 'crm' | 'erp'> = {};
    companies?.forEach(c => {
      if (selectedCompanies.has(c.company_id)) {
        companySources[c.company_id] = c.source;
      }
    });

    transferCompanies({
      companyIds: Array.from(selectedCompanies),
      toSalesRepId,
      toUserId: targetSeller?.linkedUserId || null,
      transferContacts,
      transferDeals,
      reason,
      filterContext: filters,
      companySources
    });
    setConfirmModalOpen(false);
  };

  // Converter sellers para o formato esperado pelo ReallocationFilters
  const sellersForFilter = sellers?.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type || 'interno'
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Identifique clientes por critérios específicos e transfira entre vendedores
        </p>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <ReallocationFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClear={clearFilters}
        availableStates={availableStates || []}
        availableRegions={availableRegions || []}
        sellers={sellersForFilter}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {totalItems > 0
              ? `${totalItems} cliente(s) encontrado(s)` 
              : 'Nenhum resultado'}
            {selectedCompanies.size > 0 && (
              <span className="ml-2 text-primary font-medium">
                • {selectedCompanies.size} selecionado(s)
              </span>
            )}
          </div>
          
          {selectedCompanies.size > 0 && (
            <Button onClick={() => setConfirmModalOpen(true)}>
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Remanejar {selectedCompanies.size} cliente(s)
            </Button>
          )}
        </div>

        <ReallocationResultsTable
          companies={companies || []}
          selectedCompanies={selectedCompanies}
          onToggleSelect={toggleSelectCompany}
          onToggleSelectAll={toggleSelectAllOnPage}
          isLoading={isLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      <ReallocationConfirmModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        selectedCompanies={selectedCompanyData}
        sellers={sellersForFilter}
        filterContext={filters}
        onConfirm={handleConfirmTransfer}
        isLoading={isTransferring}
      />
    </div>
  );
}
