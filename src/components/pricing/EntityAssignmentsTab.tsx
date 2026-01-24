import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Users, Trash2, Plus, Link2 } from 'lucide-react';
import { usePricingTables, PricingTableAssignment } from '@/hooks/usePricingTables';

interface EntityAssignmentsTabProps {
  selectedTableId: string;
  tableName: string;
}

export function EntityAssignmentsTab({ selectedTableId, tableName }: EntityAssignmentsTabProps) {
  const { assignments, assignTable, unassignTable, isPending } = usePricingTables();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string>('');

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });

  // Get assignments for this table
  const tableAssignments = assignments.filter((a) => a.pricing_table_id === selectedTableId);
  const companyAssignments = tableAssignments.filter((a) => a.entity_type === 'company');
  const contactAssignments = tableAssignments.filter((a) => a.entity_type === 'contact');

  // Get already assigned entity IDs
  const assignedCompanyIds = companyAssignments.map((a) => a.entity_id);
  const assignedContactIds = contactAssignments.map((a) => a.entity_id);

  // Filter out already assigned entities
  const availableCompanies = companies?.filter((c) => !assignedCompanyIds.includes(c.id)) || [];
  const availableContacts = contacts?.filter((c) => !assignedContactIds.includes(c.id)) || [];

  const handleAssignCompany = () => {
    if (!selectedCompanyId) return;
    assignTable({
      pricing_table_id: selectedTableId,
      entity_type: 'company',
      entity_id: selectedCompanyId,
      created_by: null, // Will be set by mutation
    });
    setSelectedCompanyId('');
  };

  const handleAssignContact = () => {
    if (!selectedContactId) return;
    assignTable({
      pricing_table_id: selectedTableId,
      entity_type: 'contact',
      entity_id: selectedContactId,
      created_by: null, // Will be set by mutation
    });
    setSelectedContactId('');
  };

  const getCompanyName = (entityId: string) => {
    return companies?.find((c) => c.id === entityId)?.name || 'Empresa não encontrada';
  };

  const getContactName = (entityId: string) => {
    const contact = contacts?.find((c) => c.id === entityId);
    if (!contact) return 'Contato não encontrado';
    return `${contact.first_name} ${contact.last_name || ''}`.trim();
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Vincule empresas e contatos à tabela <strong>{tableName}</strong> para que as regras de preço sejam aplicadas automaticamente.
      </div>

      {/* Companies Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Empresas</h3>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="company_select">Adicionar Empresa</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhuma empresa disponível
                  </SelectItem>
                ) : (
                  availableCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAssignCompany}
            disabled={!selectedCompanyId || isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Vincular
          </Button>
        </div>

        {companyAssignments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="w-[100px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companyAssignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {getCompanyName(assignment.entity_id)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        unassignTable({
                          entityType: assignment.entity_type,
                          entityId: assignment.entity_id,
                        })
                      }
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhuma empresa vinculada a esta tabela.
          </div>
        )}
      </div>

      {/* Contacts Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Contatos</h3>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="contact_select">Adicionar Contato</Label>
            <Select value={selectedContactId} onValueChange={setSelectedContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um contato" />
              </SelectTrigger>
              <SelectContent>
                {availableContacts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum contato disponível
                  </SelectItem>
                ) : (
                  availableContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name || ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAssignContact}
            disabled={!selectedContactId || isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Vincular
          </Button>
        </div>

        {contactAssignments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead className="w-[100px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactAssignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {getContactName(assignment.entity_id)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        unassignTable({
                          entityType: assignment.entity_type,
                          entityId: assignment.entity_id,
                        })
                      }
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum contato vinculado a esta tabela.
          </div>
        )}
      </div>
    </div>
  );
}
