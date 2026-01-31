import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, ArrowRight, Building2, User, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCNPJ, formatCPF, cleanDocument } from '@/lib/cpfCnpjMask';
import type { Json } from '@/integrations/supabase/types';

const industries = [
  'Tecnologia', 'Saúde', 'Finanças', 'Educação', 'Varejo', 
  'Manufatura', 'Serviços', 'Construção', 'Logística', 'Outros'
];

type CustomerType = 'PJ' | 'PF';

export default function CustomerNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [customerType, setCustomerType] = useState<CustomerType>('PJ');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Company/PF data
  const [companyForm, setCompanyForm] = useState({
    name: '',
    fantasia: '',
    document: '', // CNPJ or CPF
    phone: '',
    email: '',
    industry: '',
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

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      
      // Create company first
      const documentClean = cleanDocument(companyForm.document);
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
        custom_fields: { tipo_cliente: customerType } as Json,
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
    onError: (error) => {
      console.error('Error creating customer:', error);
      toast.error('Erro ao criar cliente');
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleNext = () => {
    // Validate step 1
    if (customerType === 'PJ' && !companyForm.name) {
      toast.error('Informe a razão social');
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
    
    createCustomerMutation.mutate();
  };

  const handleDocumentChange = (value: string) => {
    const formatted = customerType === 'PJ' ? formatCNPJ(value) : formatCPF(value);
    setCompanyForm({ ...companyForm, document: formatted });
  };

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
                  <div className="col-span-2">
                    <Label htmlFor="name">Razão Social *</Label>
                    <Input
                      id="name"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="fantasia">Nome Fantasia</Label>
                    <Input
                      id="fantasia"
                      value={companyForm.fantasia}
                      onChange={(e) => setCompanyForm({ ...companyForm, fantasia: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="document">CNPJ</Label>
                    <Input
                      id="document"
                      value={companyForm.document}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  </div>
                </>
              ) : (
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
              
              {customerType === 'PJ' && (
                <div>
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
              )}
              
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
              <Button onClick={handleNext} className="gap-2">
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
