import { useState } from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Truck, MapPin } from 'lucide-react';

interface DeliveryFields {
  name: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  contact: string;
}

interface DocumentLogisticsSectionProps {
  carrierId: string;
  setCarrierId: (v: string) => void;
  freightType: string;
  setFreightType: (v: string) => void;
  deliverySameAsCompany: boolean;
  setDeliverySameAsCompany: (v: boolean) => void;
  deliveryFields: DeliveryFields;
  setDeliveryFields: React.Dispatch<React.SetStateAction<DeliveryFields>>;
  disabled?: boolean;
}

export function DocumentLogisticsSection({
  carrierId, setCarrierId,
  freightType, setFreightType,
  deliverySameAsCompany, setDeliverySameAsCompany,
  deliveryFields, setDeliveryFields,
  disabled = false,
}: DocumentLogisticsSectionProps) {
  const [carrierSearch, setCarrierSearch] = useState('');

  const { data: carriersRaw } = useQuery({
    queryKey: ['carriers-search-doc', carrierSearch],
    queryFn: async () => {
      let query = supabase.from('carriers').select('id, name, trade_name').eq('active', true).order('name').limit(50);
      if (carrierSearch) query = query.ilike('name', `%${carrierSearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const carrierOptions = useMemo(() => {
    return (carriersRaw || []).map(c => ({
      value: c.id,
      label: c.trade_name ? `${c.trade_name} (${c.name})` : c.name,
    }));
  }, [carriersRaw]);

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Logística</Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Transportadora</Label>
          <SearchableSelect
            options={carrierOptions}
            value={carrierId || null}
            onChange={(v) => setCarrierId(v || '')}
            placeholder="Selecione uma transportadora"
            searchPlaceholder="Buscar transportadora..."
            disabled={disabled}
            onSearchChange={setCarrierSearch}
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de Frete</Label>
          <Select value={freightType} onValueChange={setFreightType} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de frete" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CIF">CIF — Frete por conta do vendedor</SelectItem>
              <SelectItem value="FOB">FOB — Frete por conta do cliente</SelectItem>
              <SelectItem value="REDESPACHO">Redespacho</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Delivery Address */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-semibold">Endereço de Entrega</Label>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={deliverySameAsCompany} onChange={() => setDeliverySameAsCompany(true)} disabled={disabled} />
            <span className="text-sm">Mesmo endereço do cliente</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={!deliverySameAsCompany} onChange={() => setDeliverySameAsCompany(false)} disabled={disabled} />
            <span className="text-sm">Outro endereço</span>
          </label>
        </div>
        {!deliverySameAsCompany && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nome do Local</Label>
              <Input value={deliveryFields.name} onChange={(e) => setDeliveryFields(f => ({ ...f, name: e.target.value }))} placeholder="Ex: CD São Paulo" disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input value={deliveryFields.address} onChange={(e) => setDeliveryFields(f => ({ ...f, address: e.target.value }))} disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número</Label>
              <Input value={deliveryFields.number} onChange={(e) => setDeliveryFields(f => ({ ...f, number: e.target.value }))} disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Input value={deliveryFields.neighborhood} onChange={(e) => setDeliveryFields(f => ({ ...f, neighborhood: e.target.value }))} disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input value={deliveryFields.city} onChange={(e) => setDeliveryFields(f => ({ ...f, city: e.target.value }))} disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Input value={deliveryFields.state} onChange={(e) => setDeliveryFields(f => ({ ...f, state: e.target.value }))} maxLength={2} disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <Input value={deliveryFields.zip_code} onChange={(e) => setDeliveryFields(f => ({ ...f, zip_code: e.target.value }))} disabled={disabled} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Contato no Local</Label>
              <Input value={deliveryFields.contact} onChange={(e) => setDeliveryFields(f => ({ ...f, contact: e.target.value }))} placeholder="Nome e telefone do contato" disabled={disabled} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const EMPTY_DELIVERY_FIELDS = {
  name: '', address: '', number: '', neighborhood: '', city: '', state: '', zip_code: '', contact: '',
};

/** Build logistics data for Supabase insert/update */
export function buildLogisticsPayload(
  carrierId: string,
  freightType: string,
  deliverySameAsCompany: boolean,
  deliveryFields: DeliveryFields,
) {
  return {
    carrier_id: carrierId || null,
    freight_type: freightType || null,
    delivery_same_as_company: deliverySameAsCompany,
    delivery_name: !deliverySameAsCompany ? deliveryFields.name || null : null,
    delivery_address: !deliverySameAsCompany ? deliveryFields.address || null : null,
    delivery_number: !deliverySameAsCompany ? deliveryFields.number || null : null,
    delivery_neighborhood: !deliverySameAsCompany ? deliveryFields.neighborhood || null : null,
    delivery_city: !deliverySameAsCompany ? deliveryFields.city || null : null,
    delivery_state: !deliverySameAsCompany ? deliveryFields.state || null : null,
    delivery_zip_code: !deliverySameAsCompany ? deliveryFields.zip_code || null : null,
    delivery_contact: !deliverySameAsCompany ? deliveryFields.contact || null : null,
  };
}

/** Extract logistics fields from existing record */
export function extractLogisticsFromRecord(record: any) {
  return {
    carrierId: record?.carrier_id || '',
    freightType: record?.freight_type || '',
    deliverySameAsCompany: record?.delivery_same_as_company !== false,
    deliveryFields: {
      name: record?.delivery_name || '',
      address: record?.delivery_address || '',
      number: record?.delivery_number || '',
      neighborhood: record?.delivery_neighborhood || '',
      city: record?.delivery_city || '',
      state: record?.delivery_state || '',
      zip_code: record?.delivery_zip_code || '',
      contact: record?.delivery_contact || '',
    },
  };
}
