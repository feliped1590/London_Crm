import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExportPDFButton } from '@/components/reports/ExportPDFButton';
import { ExecutiveFilters } from './ExecutiveFiltersBar';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  reportCode: 'executivo_comercial' | 'vendedor_360';
  reportName: string;
  filters: ExecutiveFilters;
  /** True enquanto qualquer bloco principal do relatório ainda está carregando. */
  isLoading?: boolean;
  /** True quando o relatório não tem nenhum dado principal renderizado. */
  isEmpty?: boolean;
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ExecutiveExportButton({
  reportCode,
  reportName,
  filters,
  isLoading,
  isEmpty,
}: Props) {
  const { accessibleEntities, activeLegalEntityId } = useLegalEntities();
  const { salesReps } = useSalesReps();
  const { user } = useAuth();

  const effectiveLeId = filters.legalEntityId ?? activeLegalEntityId ?? null;
  const entity = accessibleEntities.find((e) => e.id === effectiveLeId);
  const entityName = entity?.name ?? 'Todas acessíveis';
  const entityLogo = entity?.logo_url ?? null;
  const sellerName =
    reportCode === 'vendedor_360'
      ? (salesReps ?? []).find((s) => s.id === filters.sellerId)?.name ?? '—'
      : null;

  const periodo = `${format(filters.startDate, 'dd/MM/yyyy', { locale: ptBR })} – ${format(
    filters.endDate,
    'dd/MM/yyyy',
    { locale: ptBR }
  )}`;

  const userLabel = user?.user_metadata?.full_name || user?.email || '—';
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // Cabeçalho inline (a partir da página 2)
  const headerExtraHtml = [
    `<div><strong>Entidade:</strong> ${esc(entityName)}</div>`,
    sellerName ? `<div><strong>Vendedor:</strong> ${esc(sellerName)}</div>` : '',
    `<div><strong>Período:</strong> ${esc(periodo)}</div>`,
  ]
    .filter(Boolean)
    .join('');

  const titleSuffix =
    reportCode === 'vendedor_360' && sellerName && sellerName !== '—'
      ? ` — ${sellerName}`
      : entityName !== 'Todas acessíveis'
      ? ` — ${entityName}`
      : '';

  // Capa executiva
  const eyebrow =
    reportCode === 'vendedor_360' ? 'Relatório 360° do Vendedor' : 'Relatório Executivo Comercial';

  const coverRows = [
    { label: 'Entidade jurídica', value: entityName },
    ...(sellerName ? [{ label: 'Vendedor', value: sellerName }] : []),
    { label: 'Período', value: periodo },
    { label: 'Gerado por', value: String(userLabel) },
    { label: 'Gerado em', value: geradoEm },
    { label: 'Origem', value: 'CRM · Central de BI' },
  ];

  const coverHtml = `
    <div class="print-cover-top">
      <div class="print-cover-brand">
        ${
          entityLogo
            ? `<img class="print-cover-logo" src="${esc(entityLogo)}" alt="${esc(entityName)}" />`
            : ''
        }
      </div>
      <div class="print-cover-source">CRM · Central de BI</div>
    </div>
    <div class="print-cover-main">
      <div class="print-cover-eyebrow">${esc(eyebrow)}</div>
      <h1 class="print-cover-title">${esc(reportName)}</h1>
      <p class="print-cover-subtitle">${esc(entityName)}${
    sellerName ? ` · ${esc(sellerName)}` : ''
  }</p>
      <div class="print-cover-meta">
        ${coverRows
          .map(
            (r) => `
            <div class="row">
              <span class="label">${esc(r.label)}</span>
              <span class="value">${esc(r.value)}</span>
            </div>`
          )
          .join('')}
      </div>
    </div>
    <div class="print-cover-bottom">Documento gerado automaticamente · uso interno</div>
  `;

  const disabled = !!isLoading || !!isEmpty;
  const disabledReason = isLoading
    ? 'Aguarde o carregamento completo para exportar'
    : isEmpty
    ? 'Sem dados para exportar neste filtro'
    : undefined;

  return (
    <ExportPDFButton
      containerId={`bi-export-${reportCode}`}
      title={`${reportName}${titleSuffix}`}
      headerExtraHtml={headerExtraHtml}
      coverHtml={coverHtml}
      footerLabel={`CRM · ${eyebrow}`}
      disabled={disabled}
      disabledReason={disabledReason}
    />
  );
}
