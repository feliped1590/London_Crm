import { useState } from 'react';
import { ArrowLeftRight, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReallocationFilters } from '@/components/reallocation/ReallocationFilters';
import { ReallocationResultsTable } from '@/components/reallocation/ReallocationResultsTable';
import { ReallocationConfirmModal } from '@/components/reallocation/ReallocationConfirmModal';
import { usePortfolioReallocation } from '@/hooks/usePortfolioReallocation';
import { useModulePermissions } from '@/hooks/useModulePermissions';

export default function PortfolioReallocation() {
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { isAdmin, isLoading: permissionsLoading } = useModulePermissions();
  
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

  // Converter sellers para formato esperado pelos componentes filhos
  const sellersForComponents = sellers?.map(s => ({
    id: s.id,
    name: s.name,
    role: s.type || 'interno'
  })) || [];

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">Acesso Restrito</h2>
        <p className="text-muted-foreground mt-1">
          Apenas administradores podem acessar o remanejamento de carteira.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6" />
            Remanejamento de Carteira
          </h1>
          <p className="text-muted-foreground mt-1">
            Identifique clientes por critérios específicos e transfira entre vendedores
          </p>
        </div>
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
        sellers={sellersForComponents}
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
        sellers={sellersForComponents}
        filterContext={filters}
        onConfirm={handleConfirmTransfer}
        isLoading={isTransferring}
      />
    </div>
  );
}
