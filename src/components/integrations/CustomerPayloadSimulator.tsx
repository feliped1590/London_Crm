import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Loader2, Copy, AlertTriangle, CheckCircle2, FileJson } from 'lucide-react';
import { toast } from 'sonner';

interface ResolutionStep {
  label: string;
  field: string;
  crmValue: string | number | null;
  erpValue: string | number | null;
  status: 'ok' | 'error' | 'warning';
  message?: string;
}

export function CustomerPayloadSimulator() {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [steps, setSteps] = useState<ResolutionStep[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-for-simulator', companySearch],
    queryFn: async () => {
      let query = supabase
        .from('companies')
        .select('id, name, cnpj, fantasia')
        .eq('active', true)
        .order('name')
        .limit(50);

      if (companySearch.trim().length >= 2) {
        const term = companySearch.trim();
        query = query.or(`name.ilike.%${term}%,cnpj.ilike.%${term}%,fantasia.ilike.%${term}%`);
      }

      const { data } = await query;
      return (data || []) as any[];
    },
    enabled: companySearch.trim().length >= 2,
  });

  const companyOptions = companies.map((c: any) => ({
    value: c.id,
    label: `${c.name}${c.fantasia ? ` (${c.fantasia})` : ''}${c.cnpj ? ` — ${c.cnpj}` : ''}`,
  }));

  const handleSimulate = async () => {
    if (!selectedCompanyId) return;
    setIsSimulating(true);
    setPayload(null);
    setSteps([]);
    setErrors([]);

    const resolvedSteps: ResolutionStep[] = [];
    const errs: string[] = [];

    try {
      // 1. Load company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select(`
          id, name, fantasia, cnpj, tipo_pessoa, email, phone,
          address, address_number, address_complement, neighborhood, city, state, zip_code,
          inscricao_estadual, sales_rep_id, created_by, legal_entity_id,
          legal_entities(id, name, erp_company_code)
        `)
        .eq('id', selectedCompanyId)
        .single();

      if (companyError || !company) {
        errs.push('Empresa não encontrada');
        setErrors(errs);
        setIsSimulating(false);
        return;
      }

      // 2. CNPJ
      const cnpjDigits = (company.cnpj || '').replace(/\D/g, '');
      resolvedSteps.push({
        label: 'CNPJ/CPF',
        field: 'cnpj_cpf',
        crmValue: company.cnpj || 'Não definido',
        erpValue: cnpjDigits ? Number(cnpjDigits) : null,
        status: cnpjDigits ? 'ok' : 'error',
      });
      if (!cnpjDigits) errs.push('CNPJ/CPF não definido');

      // 3. Tipo Pessoa (inferido)
      const tipoPessoa = company.tipo_pessoa || (cnpjDigits.length === 11 ? 'PF' : 'PJ');
      const pfpj = tipoPessoa === 'PJ' ? 'J' : 'F';
      resolvedSteps.push({
        label: 'Tipo Pessoa',
        field: 'pfpj',
        crmValue: company.tipo_pessoa || `Inferido: ${tipoPessoa}`,
        erpValue: pfpj,
        status: 'ok',
        message: !company.tipo_pessoa ? `Inferido pelo tamanho do doc (${cnpjDigits.length} dígitos)` : undefined,
      });

      // 4. Nome
      resolvedSteps.push({
        label: 'Razão Social',
        field: 'nome',
        crmValue: company.name,
        erpValue: company.name,
        status: company.name?.trim() ? 'ok' : 'error',
      });
      if (!company.name?.trim()) errs.push('Nome/Razão Social vazio');

      // 5. Cidade ERP
      let cidadeCodigo = 0;
      if (company.city && company.state) {
        const { data: cityMapping } = await supabase
          .from('erp_cities')
          .select('codigo_erp')
          .eq('nome', company.city)
          .eq('uf', company.state)
          .maybeSingle();
        cidadeCodigo = cityMapping?.codigo_erp || 0;
      }
      resolvedSteps.push({
        label: 'Cidade ERP',
        field: 'cidade',
        crmValue: company.city && company.state ? `${company.city}/${company.state}` : 'Não definido',
        erpValue: cidadeCodigo || null,
        status: cidadeCodigo ? 'ok' : 'error',
        message: !cidadeCodigo ? 'Cidade não mapeada. Cadastre em Settings → ERP Mappings → Cidades.' : undefined,
      });
      if (!cidadeCodigo) errs.push('Cidade não mapeada no ERP');

      // 6. Vendedor ERP
      let vendedorCodigo = 0;
      let sellerName = 'N/A';
      if (company.sales_rep_id) {
        const { data: rep } = await supabase
          .from('sales_reps')
          .select('name, erp_vendor_code')
          .eq('id', company.sales_rep_id)
          .maybeSingle();
        if (rep) {
          sellerName = rep.name || 'N/A';
          vendedorCodigo = Number(rep.erp_vendor_code) || 0;
        }
      }
      resolvedSteps.push({
        label: 'Vendedor',
        field: 'vendedor',
        crmValue: sellerName,
        erpValue: vendedorCodigo || null,
        status: vendedorCodigo ? 'ok' : 'error',
        message: !vendedorCodigo ? 'erp_vendor_code não definido' : undefined,
      });
      if (!vendedorCodigo) errs.push('Vendedor sem código ERP');

      // 7. Usuário ERP
      let usuarioErp = 0;
      let userName = 'N/A';
      if (company.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, erp_user_code')
          .eq('user_id', company.created_by)
          .maybeSingle();
        if (profile) {
          userName = profile.full_name || 'N/A';
          usuarioErp = Number(profile.erp_user_code) || 0;
        }
      }
      resolvedSteps.push({
        label: 'Usuário ERP',
        field: 'usuario',
        crmValue: userName,
        erpValue: usuarioErp || null,
        status: usuarioErp ? 'ok' : 'error',
        message: !usuarioErp ? 'erp_user_code não definido no perfil' : undefined,
      });
      if (!usuarioErp) errs.push('Usuário sem código ERP');

      // 8. Empresa emissora
      const legalEntity = company.legal_entities as any;
      const empresaCodigo = Number(legalEntity?.erp_company_code) || 0;
      resolvedSteps.push({
        label: 'Empresa Emissora',
        field: 'empresa',
        crmValue: legalEntity?.name || 'Não definida',
        erpValue: empresaCodigo || null,
        status: empresaCodigo ? 'ok' : 'warning',
        message: !empresaCodigo ? 'Será usado padrão (1)' : undefined,
      });

      // 9. Endereço
      resolvedSteps.push({
        label: 'Endereço',
        field: 'endereco',
        crmValue: company.address || 'Não definido',
        erpValue: company.address || null,
        status: company.address?.trim() ? 'ok' : 'error',
      });
      if (!company.address?.trim()) errs.push('Endereço não definido');

      resolvedSteps.push({
        label: 'Número',
        field: 'numero_endereco',
        crmValue: company.address_number || 'Não definido',
        erpValue: company.address_number || null,
        status: company.address_number ? 'ok' : 'warning',
      });

      resolvedSteps.push({
        label: 'Bairro',
        field: 'bairro',
        crmValue: company.neighborhood || 'Não definido',
        erpValue: company.neighborhood || null,
        status: company.neighborhood ? 'ok' : 'warning',
      });

      const cepNum = Number((company.zip_code || '').replace(/\D/g, '')) || 0;
      resolvedSteps.push({
        label: 'CEP',
        field: 'cep',
        crmValue: company.zip_code || 'Não definido',
        erpValue: cepNum || null,
        status: cepNum ? 'ok' : 'warning',
      });

      // 10. Build the IMP_CLIENTE_V3 payload
      const innerJson = {
        cnpj_cpf: cnpjDigits ? Number(cnpjDigits) : null,
        pfpj,
        nome: company.name,
        fantasia: company.fantasia || company.name,
        fone: company.phone || '',
        email: company.email || '',
        insc_estadual: company.inscricao_estadual || '',
        obs_geral: '',
        tipo_correntista: 'C',
        rg: '',
        tributacao_ir: '',
        regiao: '',
        destino_mercadoria: 'N',
        usuario: usuarioErp || 1,
        banco_padrao: 0,
        segmento_mercado: 0,
        subsegmento_mercado: 0,
        enderecos: [{
          cidade: cidadeCodigo,
          tipo_endereco: 'P',
          endereco: company.address || '',
          complemento: company.address_complement || '',
          numero_endereco: company.address_number || '',
          bairro: company.neighborhood || '',
          cep: cepNum,
        }],
        enderecos_entrega: [{
          cidade: cidadeCodigo,
          codigo_entrega: 1,
          endereco: company.address || '',
          complemento: company.address_complement || '',
          numero_endereco: company.address_number || '',
          bairro: company.neighborhood || '',
          cep: cepNum,
          telefone: company.phone || '',
        }],
        vendedores: [{
          empresa: empresaCodigo || 1,
          codigo_vendedor: vendedorCodigo || 0,
          digita_pedidos: 'S',
          exibir_historico: 'S',
          remove_vendedor: 'N',
        }],
      };

      const envelope = {
        tipoComando: 'ASDCOMANDO',
        grupoComando: 'IMP_CLIENTE_V3',
        '#out#p_retorno': 'T',
        json: JSON.stringify(innerJson),
      };

      setPayload(envelope);
      setSteps(resolvedSteps);
      setErrors(errs);
    } catch (err: any) {
      setErrors([err.message || 'Erro inesperado na simulação']);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopy = () => {
    if (!payload) return;
    navigator.clipboard.writeText(JSON.stringify(payload));
    setCopied(true);
    toast.success('Payload copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInner = () => {
    if (!payload?.json) return;
    navigator.clipboard.writeText(payload.json);
    toast.success('JSON interno copiado');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileJson className="h-4 w-4" />
          Simulador de Payload ERP — Cliente (IMP_CLIENTE_V3)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <SearchableSelect
              options={companyOptions}
              value={selectedCompanyId}
              onChange={(val) => setSelectedCompanyId(val || '')}
              placeholder="Selecione um cliente..."
            />
          </div>
          <Button onClick={handleSimulate} disabled={!selectedCompanyId || isSimulating} className="gap-2">
            {isSimulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
            Simular
          </Button>
        </div>

        {/* Resolution Steps */}
        {steps.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-2 text-sm font-medium">Mapeamento CRM → ERP</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-1.5 font-medium">Campo</th>
                  <th className="text-left px-3 py-1.5 font-medium">CRM</th>
                  <th className="text-left px-3 py-1.5 font-medium">ERP</th>
                  <th className="text-center px-3 py-1.5 font-medium w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium">{step.label}</td>
                    <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs">{String(step.crmValue ?? '—')}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">
                      {step.erpValue !== null ? String(step.erpValue) : '—'}
                      {step.message && step.status !== 'error' && (
                        <span className="ml-1 text-muted-foreground">({step.message})</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {step.status === 'ok' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                      ) : step.status === 'warning' ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 inline" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {errors.length} erro(s) — envio seria bloqueado
            </div>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-destructive/80 pl-6">• {e}</p>
            ))}
          </div>
        )}

        {/* Success */}
        {payload && errors.length === 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-sm font-medium text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Payload válido — pronto para envio ao ERP
            </p>
          </div>
        )}

        {/* Payload JSON */}
        {payload && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Envelope ASDCOMANDO</h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={handleCopyInner} className="gap-1 text-xs h-7">
                  <Copy className="h-3 w-3" /> JSON interno
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1 text-xs h-7">
                  {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Envelope
                </Button>
              </div>
            </div>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-[400px] whitespace-pre-wrap break-words">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
