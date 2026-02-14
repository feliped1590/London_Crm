import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, Building2, User, Check, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCNPJ, formatCPF, cleanDocument, isValidCNPJ } from '@/lib/cpfCnpjMask';
import type { Json } from '@/integrations/supabase/types';
import { useLegalEntities } from '@/hooks/useLegalEntities';

const industries = [
  'Tecnologia', 'Saúde', 'Finanças', 'Educação', 'Varejo', 
  'Manufatura', 'Serviços', 'Construção', 'Logística', 'Outros'
];

type CustomerType = 'PJ' | 'PF';

export default function CustomerNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { accessibleEntities: legalEntities, effectiveEntityId } = useLegalEntities();
  const [selectedLegalEntityId, setSelectedLegalEntityId] = useState<string | null>(null);
  
  const [step, setStep] = useState(1);
  const [customerType, setCustomerType] = useState<CustomerType>('PJ');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // CNPJ lookup states (BrasilAPI)
  const [isLookingUpCnpj, setIsLookingUpCnpj] = useState(false);
  const [cnpjLookupDone, setCnpjLookupDone] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const lastLookedUpCnpj = useRef<string>('');
  
  // Iniflex ERP lookup states
  const [isCheckingIniflex, setIsCheckingIniflex] = useState(false);
  const [iniflexCustomer, setIniflexCustomer] = useState<{
    found: boolean;
    data?: {
      external_id: string;
      razao_social: string;
      situacao: string;
    };
  } | null>(null);
  
  // Step 1: Company/PF data
  const [companyForm, setCompanyForm] = useState({
    name: '',
    fantasia: '',
    document: '', // CNPJ or CPF
    phone: '',
    email: '',
    industry: '',
    segment: '', // Segmento obrigatório
    address: '',
    city: '',
    state: '',
  });
  
  // Step 2: Contact data
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    job_title: '',
  });

  // BrasilAPI CNPJ lookup function
  const lookupCnpj = async (cnpjClean: string) => {
    if (cnpjClean.length !== 14 || cnpjClean === lastLookedUpCnpj.current) return;
    if (!isValidCNPJ(cnpjClean)) return; // Don't lookup invalid CNPJ
    
    lastLookedUpCnpj.current = cnpjClean;
    setIsLookingUpCnpj(true);
    setCnpjLookupError(null);
    
    try {
      const response = await supabase.functions.invoke('lookup-cnpj', {
        body: { cnpj: cnpjClean }
      });
      
      if (response.data?.success) {
        const { data } = response.data;
        
        // Fill fields - don't overwrite if already edited by user
        setCompanyForm(prev => ({
          ...prev,
          name: prev.name || data.razao_social,
          fantasia: prev.fantasia || data.nome_fantasia,
          phone: prev.phone || data.telefone,
          address: prev.address || [data.endereco.logradouro, data.endereco.numero].filter(Boolean).join(', '),
          city: prev.city || data.endereco.cidade,
          state: prev.state || data.endereco.uf,
        }));
        
        setCnpjLookupDone(true);
      } else {
        setCnpjLookupError(response.data?.error || 'Erro ao consultar');
      }
    } catch (error) {
      console.error('CNPJ lookup error:', error);
      setCnpjLookupError('Não foi possível consultar. Preencha manualmente.');
    } finally {
      setIsLookingUpCnpj(false);
    }
  };

  // Iniflex ERP customer lookup function
  const checkIniflexCustomer = async (cnpjClean: string) => {
    if (cnpjClean.length !== 14 || !isValidCNPJ(cnpjClean)) return;

    setIsCheckingIniflex(true);
    setIniflexCustomer(null);

    try {
      const response = await supabase.functions.invoke('iniflex-customer-lookup', {
        body: { cnpj: cnpjClean }
      });

      if (response.data?.success) {
        setIniflexCustomer({
          found: response.data.found,
          data: response.data.data,
        });
      }
    } catch (error) {
      console.error('Iniflex lookup error:', error);
      // Silent failure - doesn't block the flow
    } finally {
      setIsCheckingIniflex(false);
    }
  };

  // Check for duplicate document in database
  const checkDuplicateDocument = async (documentClean: string, type: CustomerType): Promise<{ exists: boolean; source?: string; name?: string }> => {
    if (!documentClean) return { exists: false };
    
    if (type === 'PJ') {
      // Check in companies table (CRM)
      const { data: crmCompany } = await supabase
        .from('companies')
        .select('id, name')
        .eq('cnpj', documentClean)
        .maybeSingle();
      
      if (crmCompany) {
        return { exists: true, source: 'CRM', name: crmCompany.name };
      }
      
      // Check in crm_clients table (ERP)
      const { data: erpClient } = await supabase
        .from('crm_clients')
        .select('id, razao_social, cnpj_cpf')
        .eq('cnpj_cpf', documentClean)
        .maybeSingle();
      
      if (erpClient) {
        return { exists: true, source: 'ERP', name: erpClient.razao_social || '' };
      }
    } else {
      // CPF: Check in contacts table
      const { data: crmContact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('cpf', documentClean)
        .maybeSingle();
      
      if (crmContact) {
        return { exists: true, source: 'CRM', name: `${crmContact.first_name} ${crmContact.last_name || ''}`.trim() };
      }
      
      // Check in crm_clients table (ERP) - PF
      const { data: erpClient } = await supabase
        .from('crm_clients')
        .select('id, razao_social, cnpj_cpf')
        .eq('cnpj_cpf', documentClean)
        .maybeSingle();
      
      if (erpClient) {
        return { exists: true, source: 'ERP', name: erpClient.razao_social || '' };
      }
    }
    
    return { exists: false };
  };

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      
      const documentClean = cleanDocument(companyForm.document);
      
      // Backend validation: PJ requires valid CNPJ
      if (customerType === 'PJ') {
        if (!documentClean || documentClean.length !== 14) {
          throw new Error('CNPJ é obrigatório para Pessoa Jurídica');
        }
        if (!isValidCNPJ(documentClean)) {
          throw new Error('CNPJ inválido');
        }
      }
      
      // *** DUPLICATE CHECK - Database validation before insert ***
      if (documentClean) {
        const duplicate = await checkDuplicateDocument(documentClean, customerType);
        if (duplicate.exists) {
          const docType = customerType === 'PJ' ? 'CNPJ' : 'CPF';
          throw new Error(
            `${docType} já cadastrado! Cliente "${duplicate.name}" encontrado no ${duplicate.source}. ` +
            `Acesse o cliente existente ou use outro ${docType}.`
          );
        }
      }
      
      // Create company first
      const companyData: any = {
        name: customerType === 'PJ' ? companyForm.name : `${contactForm.first_name} ${contactForm.last_name}`.trim(),
        fantasia: companyForm.fantasia || null,
        cnpj: customerType === 'PJ' ? documentClean : null,
        phone: companyForm.phone || null,
        email: companyForm.email || null,
        industry: companyForm.industry || null,
        address: companyForm.address || null,
        city: companyForm.city || null,
        state: companyForm.state || null,
        created_by: user?.id,
        owner_id: user?.id,
        legal_entity_id: selectedLegalEntityId || effectiveEntityId || null,
        custom_fields: { 
          tipo_cliente: customerType,
          segmento: companyForm.segment,
        } as Json,
      };

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert(companyData)
        .select()
        .single();

      if (companyError) throw companyError;

      // Create contact linked to company
      const contactData: any = {
        first_name: contactForm.first_name,
        last_name: contactForm.last_name || null,
        email: contactForm.email || null,
        mobile: contactForm.mobile || null,
        job_title: contactForm.job_title || null,
        company_id: company.id,
        created_by: user?.id,
        owner_id: user?.id,
        cpf: customerType === 'PF' ? documentClean : null,
        tipo_pessoa: customerType,
      };

      const { error: contactError } = await supabase
        .from('contacts')
        .insert(contactData);

      if (contactError) throw contactError;

      return company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente criado com sucesso!');
      navigate(`/customers/${company.id}`);
    },
    onError: (error: Error) => {
      console.error('Error creating customer:', error);
      toast.error(error.message || 'Erro ao criar cliente');
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const validateCnpjField = (): boolean => {
    if (customerType !== 'PJ') return true;
    
    const cnpjClean = cleanDocument(companyForm.document);
    
    if (!cnpjClean || cnpjClean.length !== 14) {
      toast.error('CNPJ é obrigatório para Pessoa Jurídica');
      return false;
    }
    
    if (!isValidCNPJ(cnpjClean)) {
      toast.error('CNPJ inválido. Verifique os dígitos');
      return false;
    }
    
    return true;
  };

  const handleNext = () => {
    // Validate step 1
    if (customerType === 'PJ') {
      if (!companyForm.name) {
        toast.error('Informe a razão social');
        return;
      }
      if (!validateCnpjField()) {
        return;
      }
    }
    
    // Segmento obrigatório para todos os tipos de cliente
    if (!companyForm.segment) {
      toast.error('Informe o segmento do cliente');
      return;
    }
    
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate step 2
    if (!contactForm.first_name) {
      toast.error('Informe o nome do contato');
      return;
    }
    if (!contactForm.mobile && !contactForm.email) {
      toast.error('Informe pelo menos um telefone ou email');
      return;
    }
    
    // Final validation for PJ
    if (!validateCnpjField()) {
      setStep(1);
      return;
    }
    
    createCustomerMutation.mutate();
  };

  const handleDocumentChange = (value: string) => {
    const formatted = customerType === 'PJ' ? formatCNPJ(value) : formatCPF(value);
    setCompanyForm({ ...companyForm, document: formatted });
    
    // Reset lookup state when CNPJ changes
    if (customerType === 'PJ') {
      const cnpjClean = cleanDocument(formatted);
      if (cnpjClean !== lastLookedUpCnpj.current) {
        setCnpjLookupDone(false);
        setCnpjLookupError(null);
        setIniflexCustomer(null); // Reset Iniflex state
      }
      
      // Auto-lookup when CNPJ is complete (14 digits) and valid
      if (cnpjClean.length === 14 && isValidCNPJ(cnpjClean)) {
        lookupCnpj(cnpjClean);           // BrasilAPI lookup
        checkIniflexCustomer(cnpjClean); // Iniflex ERP lookup (parallel)
      }
    }
  };

  const getCnpjValidationState = () => {
    if (customerType !== 'PJ') return null;
    const cnpjClean = cleanDocument(companyForm.document);
    if (cnpjClean.length === 0) return null;
    if (cnpjClean.length < 14) return 'incomplete';
    if (!isValidCNPJ(cnpjClean)) return 'invalid';
    return 'valid';
  };

  const cnpjState = getCnpjValidationState();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo Cliente</h1>
          <p className="text-muted-foreground">Passo {step} de 2</p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          {step > 1 ? <Check className="h-4 w-4" /> : '1'}
        </div>
        <div className={`flex-1 h-1 ${step > 1 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          2
        </div>
      </div>

      {/* Step 1: Company/PF data */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
            <CardDescription>Informações básicas do cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer type selector */}
            <div className="space-y-3">
              <Label>Tipo de Cliente</Label>
              <RadioGroup
                value={customerType}
                onValueChange={(v) => {
                  setCustomerType(v as CustomerType);
                  setCompanyForm({ ...companyForm, document: '' });
                  setCnpjLookupDone(false);
                  setCnpjLookupError(null);
                  setIniflexCustomer(null); // Reset Iniflex state
                  lastLookedUpCnpj.current = '';
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PJ" id="pj" />
                  <Label htmlFor="pj" className="flex items-center gap-2 cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    Pessoa Jurídica
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PF" id="pf" />
                  <Label htmlFor="pf" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" />
                    Pessoa Física
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {customerType === 'PJ' ? (
                <>
                  {/* CNPJ field with lookup - comes first for PJ */}
                  <div className="col-span-2">
                    <Label htmlFor="document">CNPJ *</Label>
                    <div className="relative">
                      <Input
                        id="document"
                        value={companyForm.document}
                        onChange={(e) => handleDocumentChange(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        disabled={isLookingUpCnpj}
                        className={
                          cnpjState === 'invalid' 
                            ? 'border-destructive focus-visible:ring-destructive' 
                            : cnpjState === 'valid' 
                              ? 'border-green-500 focus-visible:ring-green-500' 
                              : ''
                        }
                      />
                      {isLookingUpCnpj && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {cnpjState === 'valid' && !isLookingUpCnpj && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                      )}
                    </div>
                    {isLookingUpCnpj && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Buscando dados na Receita Federal...
                      </p>
                    )}
                    {cnpjState === 'invalid' && (
                      <p className="text-sm text-destructive mt-1">
                        CNPJ inválido. Verifique os dígitos.
                      </p>
                    )}
                  </div>

                  {/* Alert for lookup result */}
                  {cnpjLookupDone && (
                    <Alert className="col-span-2 border-green-500/50 bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-700">Dados encontrados</AlertTitle>
                      <AlertDescription className="text-green-600">
                        Dados obtidos da Receita Federal via BrasilAPI. Confira antes de salvar.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {cnpjLookupError && (
                    <Alert className="col-span-2 border-yellow-500/50 bg-yellow-500/10">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertTitle className="text-yellow-700">Consulta indisponível</AlertTitle>
                      <AlertDescription className="text-yellow-600">
                        {cnpjLookupError}. Você pode preencher os dados manualmente.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Iniflex ERP Lookup Feedback */}
                  {isCheckingIniflex && (
                    <Alert className="col-span-2 border-blue-500/50 bg-blue-500/10">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <AlertTitle className="text-blue-700">Verificando ERP</AlertTitle>
                      <AlertDescription className="text-blue-600">
                        Consultando cliente no sistema Iniflex...
                      </AlertDescription>
                    </Alert>
                  )}

                  {iniflexCustomer?.found && (
                    <Alert className="col-span-2 border-orange-500/50 bg-orange-500/10">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertTitle className="text-orange-700">Cliente encontrado no ERP</AlertTitle>
                      <AlertDescription className="text-orange-600">
                        <span className="font-medium">{iniflexCustomer.data?.razao_social}</span>
                        <br />
                        <span className="text-xs">
                          ID Iniflex: {iniflexCustomer.data?.external_id} | 
                          Status: {iniflexCustomer.data?.situacao}
                        </span>
                        <br />
                        <span className="text-xs italic mt-1 block">
                          Ao salvar, este cliente será vinculado ao registro existente.
                        </span>
                      </AlertDescription>
                    </Alert>
                  )}

                  {iniflexCustomer !== null && !iniflexCustomer.found && (
                    <Alert className="col-span-2 border-gray-500/50 bg-gray-500/10">
                      <CheckCircle className="h-4 w-4 text-gray-600" />
                      <AlertTitle className="text-gray-700">Cliente novo</AlertTitle>
                      <AlertDescription className="text-gray-600">
                        Cliente não encontrado no ERP. Será criado quando necessário.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="col-span-2">
                    <Label htmlFor="name">Razão Social *</Label>
                    <Input
                      id="name"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="fantasia">Nome Fantasia</Label>
                    <Input
                      id="fantasia"
                      value={companyForm.fantasia}
                      onChange={(e) => setCompanyForm({ ...companyForm, fantasia: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="industry">Setor</Label>
                    <Select 
                      value={companyForm.industry} 
                      onValueChange={(v) => setCompanyForm({ ...companyForm, industry: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((i) => (
                          <SelectItem key={i} value={i}>{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="segment">Segmento *</Label>
                    <Select 
                      value={companyForm.segment} 
                      onValueChange={(v) => setCompanyForm({ ...companyForm, segment: v })}
                    >
                      <SelectTrigger className={!companyForm.segment ? 'border-muted-foreground/50' : ''}>
                        <SelectValue placeholder="Selecione o segmento (obrigatório)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="industria">Indústria</SelectItem>
                        <SelectItem value="comercio">Comércio</SelectItem>
                        <SelectItem value="servicos">Serviços</SelectItem>
                        <SelectItem value="agronegocio">Agronegócio</SelectItem>
                        <SelectItem value="construcao">Construção Civil</SelectItem>
                        <SelectItem value="distribuidor">Distribuidor</SelectItem>
                        <SelectItem value="varejo">Varejo</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2">
                    <Label htmlFor="document">CPF</Label>
                    <Input
                      id="document"
                      value={companyForm.document}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="segment_pf">Segmento *</Label>
                    <Select 
                      value={companyForm.segment} 
                      onValueChange={(v) => setCompanyForm({ ...companyForm, segment: v })}
                    >
                      <SelectTrigger className={!companyForm.segment ? 'border-muted-foreground/50' : ''}>
                        <SelectValue placeholder="Selecione o segmento (obrigatório)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="industria">Indústria</SelectItem>
                        <SelectItem value="comercio">Comércio</SelectItem>
                        <SelectItem value="servicos">Serviços</SelectItem>
                        <SelectItem value="agronegocio">Agronegócio</SelectItem>
                        <SelectItem value="construcao">Construção Civil</SelectItem>
                        <SelectItem value="distribuidor">Distribuidor</SelectItem>
                        <SelectItem value="varejo">Varejo</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              {legalEntities.length > 0 && (
                <div className="col-span-2">
                  <Label htmlFor="legal_entity">CNPJ Atendimento</Label>
                  <Select 
                    value={selectedLegalEntityId || effectiveEntityId || ''} 
                    onValueChange={(v) => setSelectedLegalEntityId(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o CNPJ" />
                    </SelectTrigger>
                    <SelectContent>
                      {legalEntities.map((le) => (
                        <SelectItem key={le.id} value={le.id}>
                          {le.name} — {formatCNPJ(le.cnpj)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={companyForm.city}
                  onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={companyForm.state}
                  onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                  maxLength={2}
                  placeholder="UF"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleNext} 
                className="gap-2"
                disabled={customerType === 'PJ' && cnpjState !== 'valid'}
              >
                Próximo: Contato
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Contact data */}
      {step === 2 && (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Contato Principal</CardTitle>
              <CardDescription>
                {customerType === 'PJ' 
                  ? 'Pessoa de contato principal na empresa'
                  : 'Dados do cliente pessoa física'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Nome *</Label>
                  <Input
                    id="first_name"
                    value={contactForm.first_name}
                    onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Sobrenome</Label>
                  <Input
                    id="last_name"
                    value={contactForm.last_name}
                    onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contact_mobile">Celular *</Label>
                  <Input
                    id="contact_mobile"
                    value={contactForm.mobile}
                    onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  />
                </div>
                {customerType === 'PJ' && (
                  <div className="col-span-2">
                    <Label htmlFor="job_title">Cargo</Label>
                    <Input
                      id="job_title"
                      value={contactForm.job_title}
                      onChange={(e) => setContactForm({ ...contactForm, job_title: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={handleBack} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Criar Cliente
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
