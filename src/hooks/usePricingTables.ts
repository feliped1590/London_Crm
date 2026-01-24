import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface PricingTable {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  pricing_table_id: string;
  product_id: string | null;
  category: string | null;
  min_quantity: number;
  max_quantity: number | null;
  discount_percent: number;
  fixed_price: number | null;
  price_per_unit: number | null;
  sort_order: number;
  created_at: string;
}

export interface PricingTableAssignment {
  id: string;
  pricing_table_id: string;
  entity_type: 'company' | 'contact';
  entity_id: string;
  created_by: string | null;
  created_at: string;
}

export function usePricingTables() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pricingTables, isLoading } = useQuery({
    queryKey: ['pricing_tables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_tables')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as PricingTable[];
    },
  });

  const { data: pricingRules } = useQuery({
    queryKey: ['pricing_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*, products(name, sku)')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['pricing_table_assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_table_assignments')
        .select('*');
      if (error) throw error;
      return data as PricingTableAssignment[];
    },
  });

  const createTableMutation = useMutation({
    mutationFn: async (data: Partial<PricingTable>) => {
      const { error } = await supabase.from('pricing_tables').insert([{
        name: data.name || '',
        description: data.description,
        is_default: data.is_default,
        is_active: data.is_active,
        valid_from: data.valid_from,
        valid_until: data.valid_until,
        created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_tables'] });
      toast.success('Tabela de preços criada!');
    },
    onError: () => toast.error('Erro ao criar tabela de preços'),
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PricingTable> & { id: string }) => {
      const { error } = await supabase
        .from('pricing_tables')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_tables'] });
      toast.success('Tabela de preços atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar tabela de preços'),
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing_tables')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_tables'] });
      toast.success('Tabela de preços excluída!');
    },
    onError: () => toast.error('Erro ao excluir tabela de preços'),
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: Partial<PricingRule>) => {
      const { error } = await supabase.from('pricing_rules').insert([{
        pricing_table_id: data.pricing_table_id!,
        product_id: data.product_id,
        category: data.category,
        min_quantity: data.min_quantity ?? 0,
        max_quantity: data.max_quantity,
        discount_percent: data.discount_percent ?? 0,
        fixed_price: data.fixed_price,
        price_per_unit: data.price_per_unit,
        sort_order: data.sort_order ?? 0,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_rules'] });
      toast.success('Regra de preço criada!');
    },
    onError: () => toast.error('Erro ao criar regra de preço'),
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PricingRule> & { id: string }) => {
      const { error } = await supabase
        .from('pricing_rules')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_rules'] });
      toast.success('Regra de preço atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar regra de preço'),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_rules'] });
      toast.success('Regra de preço excluída!');
    },
    onError: () => toast.error('Erro ao excluir regra de preço'),
  });

  const assignTableMutation = useMutation({
    mutationFn: async (data: Omit<PricingTableAssignment, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('pricing_table_assignments').upsert({
        ...data,
        created_by: user?.id,
      }, { onConflict: 'entity_type,entity_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_table_assignments'] });
      toast.success('Tabela de preços vinculada!');
    },
    onError: () => toast.error('Erro ao vincular tabela de preços'),
  });

  const unassignTableMutation = useMutation({
    mutationFn: async ({ entityType, entityId }: { entityType: string; entityId: string }) => {
      const { error } = await supabase
        .from('pricing_table_assignments')
        .delete()
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_table_assignments'] });
      toast.success('Vínculo removido!');
    },
    onError: () => toast.error('Erro ao remover vínculo'),
  });

  const getTableForEntity = (entityType: 'company' | 'contact', entityId: string) => {
    const assignment = assignments?.find(
      (a) => a.entity_type === entityType && a.entity_id === entityId
    );
    if (!assignment) return null;
    return pricingTables?.find((t) => t.id === assignment.pricing_table_id && t.is_active) || null;
  };

  // NEW: Get pricing table that contains a rule for a specific product
  const getTableForProduct = (productId: string): PricingTable | null => {
    const rule = pricingRules?.find(r => r.product_id === productId);
    if (!rule) return null;
    return pricingTables?.find(t => t.id === rule.pricing_table_id && t.is_active) || null;
  };

  // NEW: Get default pricing table
  const getDefaultTable = (): PricingTable | null => {
    return pricingTables?.find(t => t.is_default && t.is_active) || null;
  };

  // NEW: Get applicable table following hierarchy: Client > Product > Default
  const getApplicableTable = (
    entityType: 'company' | 'contact' | null,
    entityId: string | null,
    productId: string | null
  ): PricingTable | null => {
    // 1st - Client/Entity table
    if (entityType && entityId) {
      const entityTable = getTableForEntity(entityType, entityId);
      if (entityTable) return entityTable;
    }

    // 2nd - Product table (if product is linked to any pricing rule)
    if (productId) {
      const productTable = getTableForProduct(productId);
      if (productTable) return productTable;
    }

    // 3rd - Default table
    return getDefaultTable();
  };

  const getRulesForTable = (tableId: string) => {
    return pricingRules?.filter((r) => r.pricing_table_id === tableId) || [];
  };

  const calculatePrice = (
    tableId: string,
    productId: string | null,
    category: string | null,
    quantity: number,
    basePrice: number
  ): { finalPrice: number; discount: number; rule: PricingRule | null } => {
    const rules = getRulesForTable(tableId);
    
    // Find matching rule - prioritize product-specific rules
    const matchingRule = rules.find((r) => {
      // Product match check
      if (r.product_id && productId && r.product_id !== productId) return false;
      // If rule has product_id and we don't match, skip
      if (r.product_id && !productId) return false;
      // Check category match if no product specified in rule
      if (!r.product_id && r.category && category && r.category !== category) return false;
      // Check quantity range
      if (quantity < r.min_quantity) return false;
      if (r.max_quantity !== null && quantity > r.max_quantity) return false;
      return true;
    });

    if (!matchingRule) {
      return { finalPrice: basePrice, discount: 0, rule: null };
    }

    // Apply rule
    if (matchingRule.fixed_price !== null) {
      return {
        finalPrice: matchingRule.fixed_price,
        discount: basePrice - matchingRule.fixed_price,
        rule: matchingRule,
      };
    }

    if (matchingRule.price_per_unit !== null) {
      return {
        finalPrice: matchingRule.price_per_unit,
        discount: basePrice - matchingRule.price_per_unit,
        rule: matchingRule,
      };
    }

    if (matchingRule.discount_percent > 0) {
      const discount = basePrice * (matchingRule.discount_percent / 100);
      return {
        finalPrice: basePrice - discount,
        discount,
        rule: matchingRule,
      };
    }

    return { finalPrice: basePrice, discount: 0, rule: matchingRule };
  };

  // NEW: Validate if a price differs from the pricing table price
  // Returns null if no pricing table applies, otherwise returns the expected price and difference
  const validatePriceAgainstTable = (
    entityType: 'company' | 'contact' | null,
    entityId: string | null,
    productId: string | null,
    productCategory: string | null,
    quantity: number,
    basePrice: number,
    inputPrice: number
  ): { 
    isValid: boolean; 
    expectedPrice: number; 
    difference: number; 
    differencePercent: number;
    tableName: string | null;
  } | null => {
    const applicableTable = getApplicableTable(entityType, entityId, productId);
    
    if (!applicableTable) {
      // No pricing table applies, any price is valid
      return null;
    }

    const { finalPrice } = calculatePrice(
      applicableTable.id,
      productId,
      productCategory,
      quantity,
      basePrice
    );

    const difference = inputPrice - finalPrice;
    const differencePercent = finalPrice > 0 ? (difference / finalPrice) * 100 : 0;
    
    // Price is valid if it matches the table price (with small tolerance for floating point)
    const isValid = Math.abs(difference) < 0.01;

    return {
      isValid,
      expectedPrice: finalPrice,
      difference,
      differencePercent,
      tableName: applicableTable.name,
    };
  };

  return {
    pricingTables: pricingTables || [],
    pricingRules: pricingRules || [],
    assignments: assignments || [],
    isLoading,
    createTable: createTableMutation.mutate,
    updateTable: updateTableMutation.mutate,
    deleteTable: deleteTableMutation.mutate,
    createRule: createRuleMutation.mutate,
    updateRule: updateRuleMutation.mutate,
    deleteRule: deleteRuleMutation.mutate,
    assignTable: assignTableMutation.mutate,
    unassignTable: unassignTableMutation.mutate,
    getTableForEntity,
    getTableForProduct,
    getDefaultTable,
    getApplicableTable,
    getRulesForTable,
    calculatePrice,
    validatePriceAgainstTable,
    isPending:
      createTableMutation.isPending ||
      updateTableMutation.isPending ||
      deleteTableMutation.isPending ||
      createRuleMutation.isPending ||
      updateRuleMutation.isPending ||
      deleteRuleMutation.isPending ||
      assignTableMutation.isPending ||
      unassignTableMutation.isPending,
  };
}
