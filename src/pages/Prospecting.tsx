import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Building2, AlertCircle } from 'lucide-react';
import { useProspecting } from '@/hooks/useProspecting';
import { ProspectingFilters } from '@/components/prospecting/ProspectingFilters';
import { ProspectingResultCard } from '@/components/prospecting/ProspectingResultCard';
import { ProspectingHistory } from '@/components/prospecting/ProspectingHistory';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';

export default function Prospecting() {
  const {
    currentSearch,
    resultIdMap,
    isSearching,
    searchHistory,
    isLoadingHistory,
    search,
    saveLead,
    isSavingLead,
  } = useProspecting();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6" />
          Prospecção
        </h1>
        <p className="text-muted-foreground mt-1">
          Encontre empresas qualificadas e transforme em leads acionáveis
        </p>
      </div>

      <UnderDevelopmentBanner 
        title="Módulo de Prospecção em Manutenção"
        description="O módulo de prospecção está temporariamente em manutenção e será reativado em breve."
      />

      {/* Aviso legal */}
      <div className="flex items-start gap-2 p-4 border rounded-lg bg-muted/50">
        <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Os dados são obtidos de fontes públicas (Receita Federal via BrasilAPI). 
          Use com responsabilidade e respeite as normas de proteção de dados.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <ProspectingFilters onSearch={search} isSearching={isSearching} />

          <Tabs defaultValue="results" className="w-full">
            <TabsList>
              <TabsTrigger value="results" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Resultados
                {currentSearch && currentSearch.results.length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                    {currentSearch.results.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="mt-4">
              {!currentSearch ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">Inicie uma busca</p>
                      <p className="text-sm mt-1">
                        Use o CNPJ para encontrar empresas na base da Receita Federal
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : currentSearch.results.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">Nenhum resultado</p>
                      <p className="text-sm mt-1">
                        Tente buscar com outros filtros
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {currentSearch.results.map((result) => (
                    <ProspectingResultCard
                      key={result.cnpj}
                      result={result}
                      resultId={resultIdMap[result.cnpj]}
                      onSaveLead={saveLead}
                      isSaving={isSavingLead}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <ProspectingHistory 
            history={searchHistory} 
            isLoading={isLoadingHistory} 
          />
        </div>
      </div>
    </div>
  );
}
