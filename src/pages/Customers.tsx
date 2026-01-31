import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Users, RefreshCw, Building2, User, Phone, TrendingUp, Clock, MessageCircle } from 'lucide-react';
import { DealStageBadges } from '@/components/DealStageBadges';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCNPJ, formatCPF } from '@/lib/cpfCnpjMask';
import type { Tables } from '@/integrations/supabase/types';

type DealStage = Tables<'deals'>['stage'];

interface CustomerDeal {
  id: string;
  name: string;
  stage: DealStage;
  value: number | null;
}

interface CustomerListItem {
  id: string;
  name: string;
  fantasia: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  tipo_cliente: 'PJ' | 'PF';
  // Primary contact info
  primary_contact: {
    id: string;
    name: string;
    job_title: string | null;
    mobile: string | null;
    email: string | null;
  } | null;
  // Related data
  deals: CustomerDeal[];
  last_activity_at: string | null;
  contacts_count: number;
}

export default function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Fetch companies with contacts and deals
  const { data: customers, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      // Get companies with their contacts and deals
      const { data: companies, error } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          fantasia,
          cnpj,
          phone,
          email,
          industry,
          city,
          state,
          custom_fields,
          contacts(id, first_name, last_name, job_title, mobile, email),
          deals(id, name, stage, value),
          activities(created_at)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to CustomerListItem format
      const customerList: CustomerListItem[] = companies?.map((company: any) => {
        const contacts = company.contacts || [];
        const primaryContact = contacts[0]; // First contact is primary for now
        
        // Get the most recent activity
        const lastActivity = company.activities?.length > 0
          ? company.activities.sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]?.created_at
          : null;

        // Determine tipo_cliente from custom_fields or presence of CNPJ
        const tipoCliente = (company.custom_fields as any)?.tipo_cliente || 
          (company.cnpj ? 'PJ' : 'PJ');

        return {
          id: company.id,
          name: company.fantasia || company.name,
          fantasia: company.fantasia,
          cnpj: company.cnpj,
          phone: company.phone,
          email: company.email,
          industry: company.industry,
          city: company.city,
          state: company.state,
          tipo_cliente: tipoCliente,
          primary_contact: primaryContact ? {
            id: primaryContact.id,
            name: `${primaryContact.first_name}${primaryContact.last_name ? ' ' + primaryContact.last_name : ''}`,
            job_title: primaryContact.job_title,
            mobile: primaryContact.mobile,
            email: primaryContact.email,
          } : null,
          deals: company.deals || [],
          last_activity_at: lastActivity,
          contacts_count: contacts.length,
        };
      }) || [];

      return customerList;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const handleOpenCustomer = (customerId: string) => {
    navigate(`/customers/${customerId}`);
  };

  const handleOpenWhatsApp = (customer: CustomerListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = customer.primary_contact?.mobile || customer.phone;
    if (!phone) {
      toast.error('Este cliente não possui telefone cadastrado');
      return;
    }
    const contactName = customer.primary_contact?.name || customer.name;
    navigate(`/whatsapp?phone=${encodeURIComponent(phone)}&contactName=${encodeURIComponent(contactName)}`);
  };

  const filteredCustomers = customers?.filter(customer =>
    customer.name.toLowerCase().includes(search.toLowerCase()) ||
    customer.fantasia?.toLowerCase().includes(search.toLowerCase()) ||
    customer.cnpj?.includes(search.replace(/\D/g, '')) ||
    customer.primary_contact?.name.toLowerCase().includes(search.toLowerCase()) ||
    customer.industry?.toLowerCase().includes(search.toLowerCase()) ||
    customer.city?.toLowerCase().includes(search.toLowerCase())
  );

  const getCustomerIcon = (tipo: 'PJ' | 'PF') => {
    return tipo === 'PJ' ? Building2 : User;
  };

  const formatDocument = (cnpj: string | null, tipo: 'PJ' | 'PF') => {
    if (!cnpj) return '-';
    return tipo === 'PJ' ? formatCNPJ(cnpj) : formatCPF(cnpj);
  };

  const getLastActivityText = (date: string | null) => {
    if (!date) return 'Sem atividade';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua carteira de clientes</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/customers/new')}>
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes por nome, CNPJ, contato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredCustomers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">Comece adicionando seu primeiro cliente.</p>
              <Button className="mt-4 gap-2" onClick={() => navigate('/customers/new')}>
                <Plus className="h-4 w-4" />
                Novo Cliente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato Principal</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      Telefone
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Última Atividade
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Negócios
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.map((customer) => {
                  const CustomerIcon = getCustomerIcon(customer.tipo_cliente);
                  const phone = customer.primary_contact?.mobile || customer.phone;
                  
                  return (
                    <TableRow 
                      key={customer.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenCustomer(customer.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              <CustomerIcon className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {customer.cnpj && (
                                <span>{formatDocument(customer.cnpj, customer.tipo_cliente)}</span>
                              )}
                              {customer.city && customer.state && (
                                <span>• {customer.city}/{customer.state}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.primary_contact ? (
                          <div>
                            <p className="font-medium">{customer.primary_contact.name}</p>
                            {customer.primary_contact.job_title && (
                              <p className="text-sm text-muted-foreground">{customer.primary_contact.job_title}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sem contato</span>
                        )}
                        {customer.contacts_count > 1 && (
                          <Badge variant="secondary" className="ml-2">
                            +{customer.contacts_count - 1}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {phone ? (
                          <span className="font-mono text-sm">{phone}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm ${!customer.last_activity_at ? 'text-muted-foreground' : ''}`}>
                          {getLastActivityText(customer.last_activity_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {customer.deals.length > 0 ? (
                          <DealStageBadges deals={customer.deals} />
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleOpenWhatsApp(customer, e)}
                          disabled={!phone}
                          title={phone ? 'Abrir WhatsApp' : 'Sem telefone'}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
