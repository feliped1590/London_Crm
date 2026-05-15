/**
 * Validador pré-envio de produtos ao ERP Projedata.
 * Espelha o validator de cliente/pedido.
 */

import type { ProductForSync, ProductSyncContext } from './product-mapper-v2.ts';

export interface ProductValidationError {
  field: string;
  message: string;
}

export interface ProductValidationResult {
  valid: boolean;
  errors: ProductValidationError[];
}

export function validateProductForSync(
  p: ProductForSync,
  ctx: ProductSyncContext,
): ProductValidationResult {
  const errors: ProductValidationError[] = [];
  const req = (cond: boolean, field: string, message: string) => {
    if (!cond) errors.push({ field, message });
  };

  req(!!p.name?.trim(), 'name', 'Descrição do produto obrigatória');
  req(!!(p.nome_impresso ?? '').trim(), 'nome_impresso', 'Nome Complementar obrigatório (enviado como descrição ao ERP)');
  req(!!(p.erp_versao ?? '').trim(), 'erp_versao', 'Versão do Produto obrigatória (gerada a partir das dimensões; enviada em versoes[].detalhes)');
  req(!!(p.erp_grupo ?? '').trim(), 'erp_grupo', 'Grupo ERP obrigatório');
  req(!!(p.erp_subgrupo ?? '').trim(), 'erp_subgrupo', 'Subgrupo ERP obrigatório');
  req(!!(p.familia_label ?? '').trim(), 'familia', 'Família obrigatória');
  req(!!(p.classe_label ?? '').trim(), 'classe', 'Classe obrigatória');
  req(!!(p.tipo_item ?? '').trim(), 'tipo_item', 'Tipo de item obrigatório');
  req(!!p.tipo_ficha && p.tipo_ficha > 0, 'tipo_ficha', 'Tipo de ficha obrigatório');
  req(!!(p.unit_measure ?? '').trim(), 'unidade', 'Unidade de medida obrigatória');
  const ncm = (p.ncm_code ?? '').replace(/\D/g, '');
  req(/^\d{8}$/.test(ncm), 'ncm', 'NCM deve conter 8 dígitos');
  req(!!ctx.erp_usuario && Number.isFinite(ctx.erp_usuario), 'usuario', 'Usuário ERP do executor não configurado (erp_user_code)');

  return { valid: errors.length === 0, errors };
}

/**
 * Carrega um produto + labels de família/classe + erp_usuario do executor.
 * Retorna ProductForSync pronto para mapper/validator.
 */
export async function loadProductForSync(
  supabase: any,
  productId: string,
  executorUserId?: string | null,
): Promise<{ product: ProductForSync; ctx: ProductSyncContext; tenantId: string | null }> {
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      id, tenant_id, name, nome_impresso, erp_versao, erp_product_code, erp_empresa,
      erp_grupo, erp_subgrupo, tipo_item, tipo_ficha,
      unit_measure, ncm_code, family_id, class_id, tipo_id, created_by,
      versao_numero, parent_product_id
    `)
    .eq('id', productId)
    .single();

  if (error || !product) {
    throw new Error(`Produto não encontrado: ${productId}`);
  }

  // Prioridade: executor informado pela fila/JWT → created_by do produto → usuário padrão do tenant.
  let userIdForErp = executorUserId || product.created_by || null;

  let familia_label: string | null = null;
  if (product.family_id) {
    const { data } = await supabase
      .from('product_families')
      .select('label')
      .eq('id', product.family_id)
      .maybeSingle();
    familia_label = data?.label ?? null;
  }

  let classe_label: string | null = null;
  if (product.class_id) {
    const { data } = await supabase
      .from('product_classes')
      .select('label')
      .eq('id', product.class_id)
      .maybeSingle();
    classe_label = data?.label ?? null;
  }

  let tipo_item: string | null = product.tipo_item ?? null;
  if (product.tipo_id) {
    const { data } = await supabase
      .from('product_types')
      .select('value')
      .eq('id', product.tipo_id)
      .maybeSingle();
    tipo_item = data?.value ?? tipo_item;
  }

  let erp_usuario = 0;
  if (userIdForErp) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('erp_user_code')
      .eq('user_id', userIdForErp)
      .maybeSingle();
    erp_usuario = Number(profile?.erp_user_code) || 0;
  }

  if (!erp_usuario && product.tenant_id) {
    const { data: tenantProfile } = await supabase
      .from('profiles')
      .select('user_id, erp_user_code')
      .eq('active_tenant_id', product.tenant_id)
      .not('erp_user_code', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    userIdForErp = tenantProfile?.user_id ?? userIdForErp;
    erp_usuario = Number(tenantProfile?.erp_user_code) || 0;
  }

  return {
    product: {
      id: product.id,
      name: product.name,
      nome_impresso: product.nome_impresso,
      erp_versao: product.erp_versao,
      erp_product_code: product.erp_product_code,
      erp_empresa: product.erp_empresa,
      erp_grupo: product.erp_grupo,
      erp_subgrupo: product.erp_subgrupo,
      familia_label,
      classe_label,
      tipo_item,
      tipo_ficha: product.tipo_ficha,
      unit_measure: product.unit_measure,
      ncm_code: product.ncm_code,
    },
    ctx: { erp_usuario },
    tenantId: product.tenant_id ?? null,
  };
}
