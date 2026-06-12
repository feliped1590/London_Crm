import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Mail, FileText, History, MessageCircle, Users, StickyNote, Zap, Trash2, ExternalLink, Phone, AtSign, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import { ProposalsList } from '@/components/proposals/ProposalsList';
import { DealHistoryTab } from '@/components/pipeline/DealHistoryTab';
import { DealOrdersTab } from '@/components/pipeline/DealOrdersTab';
import { DealParticipants } from '@/components/pipeline/DealParticipants';
import { DealWhatsAppChat } from '@/components/pipeline/DealWhatsAppChat';
import { QuickNotes } from '@/components/notes/QuickNotes';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';
import { DealQuickActions } from '@/components/pipeline/DealQuickActions';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCNPJ } from '@/lib/cpfCnpjMask';
import type { Deal, DealStage, StageConfigEntry, PipelineStageRow } from '@/hooks/usePipelineData';
import type { TablesInsert, Json } from '@/integrations/supabase/types';

interface DealFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingDeal: Deal | null;
  formData: Partial<TablesInsert<'deals'>>;
  setFormData: (data: Partial<TablesInsert<'deals'>>) => void;
  customFieldsData: Record<string, unknown>;
  setCustomFieldsData: (data: Record<string, unknown>) => void;
  stages: DealStage[];
  stageRows: PipelineStageRow[];
  stageConfig: Record<string, StageConfigEntry>;
  companyOptions: SearchableSelectOption[];
  contactOptions: SearchableSelectOption[];
  legalEntities: any[];
  effectiveLegalEntityId: string | null;
  onCompanySearchChange: (search: string) => void;
  onContactSearchChange: (search: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onDeleteDeal: (deal: Deal) => void;
  onOpenEmailDialog: (deal: Deal) => void;
  onQuickCreateCompany: () => void;
  onQuickCreateContact: () => void;
  canCreateDeal: boolean;
  canEditDeal: boolean;
  canDeleteDeal: (deal: Deal) => boolean;
  isMutating: boolean;
  getContactPhone: (contactId: string | null) => string | null;
  getContactName: (contactId: string | null) => string;
  getContactInfo: (contactId: string | null) => { id: string; first_name: string; last_name?: string; email?: string; phone?: string; mobile?: string } | null;
}

export function DealFormDialog({
  isOpen,
  onOpenChange,
  editingDeal,
  formData,
  setFormData,
  customFieldsData,
  setCustomFieldsData,
  stages,
  stageRows,
  stageConfig,
  companyOptions,
  contactOptions,
  legalEntities,
  effectiveLegalEntityId,
  onCompanySearchChange,
  onContactSearchChange,
  onSubmit,
  onReset,
  onDeleteDeal,
  onOpenEmailDialog,
  onQuickCreateCompany,
  onQuickCreateContact,
  canCreateDeal,
  canEditDeal,
  canDeleteDeal,
  isMutating,
  getContactPhone,
  getContactName,
  getContactInfo,
}: DealFormDialogProps) {
  const navigate = useNavigate();

  // Regra: todo NOVO negócio cai obrigatoriamente na 1ª etapa do funil (Prospecção).
  // Auto-preenche o pipeline_stage_id assim que o diálogo abre e as etapas estão carregadas.
  useEffect(() => {
    if (!isOpen || editingDeal) return;
    if (!stageRows || stageRows.length === 0) return;
    const firstRow = stageRows[0];
    const currentStageId = (formData as any).pipeline_stage_id;
    if (currentStageId === firstRow.id) return;
    const next: Partial<TablesInsert<'deals'>> = {
      ...formData,
      pipeline_stage_id: firstRow.id,
    };
    if (firstRow.stage) {
      (next as any).stage = firstRow.stage;
    } else {
      delete (next as any).stage;
    }
    setFormData(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingDeal, stageRows]);

  const renderFormFields = (isEditing: boolean) => (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label htmlFor="name">Nome do Negócio *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="value">Valor (R$)</Label>
        <CurrencyInput
          id="value"
          value={formData.value || 0}
          onChange={(val) => setFormData({ ...formData, value: val })}
        />
      </div>
      <div>
        <Label htmlFor="stage">Etapa</Label>
        <Select
          value={(formData as any).pipeline_stage_id || ''}
          disabled={!isEditing}
          onValueChange={(v) => {
            const row = stageRows.find(s => s.id === v);
            const nextFormData: Partial<TablesInsert<'deals'>> = {
              ...formData,
              pipeline_stage_id: v,
            };

            // O campo legado `stage` não deve receber UUID da etapa.
            // Para etapas dinâmicas sem código legado, a identidade real é `pipeline_stage_id`.
            if (row?.stage) {
              nextFormData.stage = row.stage as DealStage;
            } else {
              delete (nextFormData as any).stage;
            }

            setFormData(nextFormData);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a etapa" />
          </SelectTrigger>
          <SelectContent>
            {stageRows.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isEditing && (
          <p className="text-xs text-muted-foreground mt-1">
            Novos negócios entram automaticamente na primeira etapa do funil.
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="probability">Probabilidade (%)</Label>
        <Input
          id="probability"
          type="number"
          min="0"
          max="100"
          value={formData.probability || 0}
          onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label htmlFor="expected_close_date">Previsão de Fechamento</Label>
        <Input
          id="expected_close_date"
          type="date"
          value={formData.expected_close_date || ''}
          onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="company_id">Empresa</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchableSelect
              options={companyOptions}
              value={isEditing ? formData.company_id : (formData.company_id || '')}
              onChange={(v) => setFormData({ ...formData, company_id: isEditing ? v : (v || null), contact_id: null })}
              placeholder="Buscar empresa..."
              searchPlaceholder="Nome ou CNPJ..."
              emptyMessage="Nenhuma empresa encontrada."
              onCreateNew={onQuickCreateCompany}
              createNewLabel="Criar nova empresa"
              onSearchChange={onCompanySearchChange}
            />
          </div>
          {formData.company_id && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              title="Ver Empresa"
              onClick={() => {
                onOpenChange(false);
                navigate(`/customers/${formData.company_id}`);
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="contact_id">Contato</Label>
        <SearchableSelect
          options={contactOptions}
          value={isEditing ? formData.contact_id : (formData.contact_id || '')}
          onChange={(v) => setFormData({ ...formData, contact_id: isEditing ? v : (v || null) })}
          placeholder="Buscar contato..."
          searchPlaceholder="Nome ou CPF..."
          emptyMessage="Nenhum contato encontrado."
          onCreateNew={onQuickCreateContact}
          createNewLabel="Criar novo contato"
          onSearchChange={onContactSearchChange}
        />
        {(() => {
          const contactInfo = getContactInfo(formData.contact_id ?? null);
          if (!contactInfo) return null;
          const phone = contactInfo.mobile || contactInfo.phone;
          const email = contactInfo.email;
          if (!phone && !email) return null;
          return (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {phone}
                </span>
              )}
              {email && (
                <span className="inline-flex items-center gap-1">
                  <AtSign className="h-3.5 w-3.5" />
                  {email}
                </span>
              )}
            </div>
          );
        })()}
      </div>
      {legalEntities.length > 0 && isEditing && (
        <div>
          <Label htmlFor="legal_entity_id">CNPJ Atendimento</Label>
          <Select
            value={(formData as any).legal_entity_id || effectiveLegalEntityId || ''}
            onValueChange={(v) => setFormData({ ...formData, legal_entity_id: v } as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o CNPJ" />
            </SelectTrigger>
            <SelectContent>
              {legalEntities.map((le: any) => (
                <SelectItem key={le.id} value={le.id}>
                  {le.name} — {formatCNPJ(le.cnpj)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="col-span-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </div>
      <div className="col-span-2">
        <CustomFieldsRenderer
          entity="deal"
          values={customFieldsData}
          onChange={setCustomFieldsData}
        />
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) onReset(); }}>
      {canCreateDeal && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Negócio
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingDeal ? `Detalhes: ${editingDeal.name}` : 'Novo Negócio'}</DialogTitle>
        </DialogHeader>

        {editingDeal ? (
          <Tabs defaultValue="dados" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="notas" className="flex items-center gap-2">
                <StickyNote className="h-4 w-4" />
                <span className="hidden sm:inline">Notas</span>
              </TabsTrigger>
              <TabsTrigger value="propostas" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Propostas</span>
              </TabsTrigger>
              <TabsTrigger value="pedidos" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Pedidos</span>
              </TabsTrigger>
              <TabsTrigger value="participantes" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Equipe</span>
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="flex-1 overflow-auto mt-4">
              <form onSubmit={onSubmit} className="space-y-4">
                {renderFormFields(true)}
                {/* Quick Actions */}
                <div className="pt-4 border-t">
                  <Label className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4" />
                    Ações Rápidas
                  </Label>
                  <DealQuickActions
                    deal={editingDeal as any}
                    onWhatsAppClick={() => {
                      const tabsTrigger = document.querySelector('[data-state="inactive"][value="whatsapp"]');
                      if (tabsTrigger instanceof HTMLElement) {
                        tabsTrigger.click();
                      }
                    }}
                  />
                </div>

                <div className="flex justify-between gap-2 pt-4">
                  <div className="flex gap-2">
                    {(editingDeal as any).contacts?.email && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenEmailDialog(editingDeal)}
                        className="gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        Enviar Email
                      </Button>
                    )}
                    {canDeleteDeal(editingDeal) && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => onDeleteDeal(editingDeal)}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onReset}>
                      Cancelar
                    </Button>
                    {canEditDeal && <Button type="submit" disabled={isMutating}>
                      Atualizar
                    </Button>}
                  </div>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="notas" className="flex-1 overflow-auto mt-4">
              <QuickNotes entityType="deal" entityId={editingDeal.id} />
            </TabsContent>

            <TabsContent value="propostas" className="flex-1 overflow-auto mt-4">
              <ProposalsList
                dealId={editingDeal.id}
                companyId={editingDeal.company_id}
                contactId={editingDeal.contact_id}
              />
            </TabsContent>

            <TabsContent value="pedidos" className="flex-1 overflow-auto mt-4">
              <DealOrdersTab dealId={editingDeal.id} />
            </TabsContent>

            <TabsContent value="participantes" className="flex-1 overflow-auto mt-4">
              <DealParticipants
                dealId={editingDeal.id}
                ownerId={editingDeal.owner_id}
                createdBy={editingDeal.created_by}
              />
            </TabsContent>

            <TabsContent value="historico" className="flex-1 overflow-auto mt-4">
              <DealHistoryTab dealId={editingDeal.id} />
            </TabsContent>

            <TabsContent value="whatsapp" className="flex-1 overflow-hidden mt-4 flex flex-col gap-4">
              <UnderDevelopmentBanner compact title="Em Desenvolvimento" />
              <DealWhatsAppChat
                contactId={editingDeal.contact_id}
                contactPhone={getContactPhone(editingDeal.contact_id)}
                contactName={getContactName(editingDeal.contact_id)}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {renderFormFields(false)}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onReset}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating || !canCreateDeal}>
                Criar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
