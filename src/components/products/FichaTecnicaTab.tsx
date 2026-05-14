import { FichaTecnicaSection, type FichaTecnicaData } from '@/components/products/FichaTecnicaSection';
import { FichaRenderer } from '@/components/ficha/FichaRenderer';
import { useFichaSchema } from '@/hooks/useFichaSchema';
import { useFichaRendererVersion } from '@/hooks/useFichaRendererVersion';
import type { FichaProfile } from '@/hooks/useProductLookups';
import type { FichaData } from '@/components/ficha/engine/types';

interface Props {
  profile: FichaProfile;
  value: FichaTecnicaData;
  onChange: (next: FichaTecnicaData) => void;
}

/**
 * Switch entre renderer legacy (v1) e schema-driven (v2) por feature flag de tenant.
 * O JSON gravado em `products.ficha_tecnica` tem o mesmo formato em ambos os caminhos
 * (chave de section = chave do objeto, chave de field = sub-chave).
 */
export function FichaTecnicaTab({ profile, value, onChange }: Props) {
  const { data: version } = useFichaRendererVersion();
  const useV2 = version === 'v2';
  const { data: schemaData, isLoading } = useFichaSchema(useV2 ? profile : null);

  if (!useV2) {
    return <FichaTecnicaSection profile={profile} value={value} onChange={onChange} />;
  }

  if (!profile || profile === 'none') {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Selecione um grupo com perfil de ficha técnica configurado para preencher os campos específicos.
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Carregando ficha…</div>;
  }

  if (!schemaData?.schema) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Schema "{profile}" não encontrado. Verifique a publicação em Cadastro Básico.
      </div>
    );
  }

  return (
    <FichaRenderer
      schema={schemaData.schema}
      value={(value as unknown as FichaData) || {}}
      onChange={(next) => onChange(next as unknown as FichaTecnicaData)}
    />
  );
}

export default FichaTecnicaTab;
