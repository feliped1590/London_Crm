import { Search } from 'lucide-react';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';

export default function Prospecting() {
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
        description="O módulo de prospecção está temporariamente em manutenção e será reativado em breve. Funcionalidades como busca de CNPJ, filtros avançados e salvamento de leads estarão disponíveis novamente."
      />
    </div>
  );
}
