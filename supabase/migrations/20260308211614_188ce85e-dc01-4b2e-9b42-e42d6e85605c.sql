
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at LIMIT 1;

  -- TIPOS (product_types)
  INSERT INTO public.product_types (value, label, sort_order, tenant_id, is_active) VALUES
    ('1', 'Produto Acabado', 1, v_tenant_id, true),
    ('2', 'Bobina Extrusada', 2, v_tenant_id, true),
    ('8', 'Semi Acabado', 3, v_tenant_id, true),
    ('9', 'Tintas Formuladas', 4, v_tenant_id, true),
    ('10', 'Matéria Prima', 5, v_tenant_id, true),
    ('12', 'Uso e Consumo / Insumos', 6, v_tenant_id, true)
  ON CONFLICT DO NOTHING;

  -- GRUPOS (product_groups)
  INSERT INTO public.product_groups (value, label, sort_order, tenant_id, is_active) VALUES
    ('1', 'Impresso Saco', 1, v_tenant_id, true),
    ('2', 'Liso Saco', 2, v_tenant_id, true),
    ('3', 'Impresso Bobina', 3, v_tenant_id, true),
    ('4', 'Liso Bobina', 4, v_tenant_id, true),
    ('5', 'Resinas', 5, v_tenant_id, true),
    ('6', 'Adesivo / Catalisador', 6, v_tenant_id, true),
    ('7', 'Tintas', 7, v_tenant_id, true),
    ('8', 'Solventes Vernizes e Aditivos', 8, v_tenant_id, true),
    ('9', 'Filmes', 9, v_tenant_id, true),
    ('10', 'Material de Expediente', 10, v_tenant_id, true),
    ('11', 'Material de Limpeza', 11, v_tenant_id, true),
    ('12', 'Material de EPI', 12, v_tenant_id, true),
    ('13', 'Material de Manutenção', 13, v_tenant_id, true),
    ('14', 'Embalagens', 14, v_tenant_id, true)
  ON CONFLICT DO NOTHING;

  -- SUBGRUPOS (product_subgroups)
  INSERT INTO public.product_subgroups (value, label, sort_order, tenant_id, is_active) VALUES
    ('1', '2 Soldas', 1, v_tenant_id, true),
    ('2', '3 Soldas', 2, v_tenant_id, true),
    ('3', '4 Soldas', 3, v_tenant_id, true),
    ('4', 'Spl', 4, v_tenant_id, true),
    ('5', 'Fundo Reto', 5, v_tenant_id, true),
    ('6', 'Fundo Oval', 6, v_tenant_id, true),
    ('7', 'Dorso', 7, v_tenant_id, true),
    ('8', 'Enfestado Natural', 8, v_tenant_id, true),
    ('9', 'Enfestado Branco', 9, v_tenant_id, true),
    ('10', 'Enfestado Azul', 10, v_tenant_id, true),
    ('11', 'Folha Natural', 11, v_tenant_id, true),
    ('12', 'Folha Branco', 12, v_tenant_id, true),
    ('13', 'Folha Azul', 13, v_tenant_id, true),
    ('14', 'Tubular Natural', 14, v_tenant_id, true),
    ('15', 'Tubular Branco', 15, v_tenant_id, true),
    ('16', 'Tubular Azul', 16, v_tenant_id, true),
    ('17', 'Geladeira', 17, v_tenant_id, true),
    ('18', 'Laminação', 18, v_tenant_id, true),
    ('19', 'Termoencolhível', 19, v_tenant_id, true),
    ('20', 'Linear', 20, v_tenant_id, true),
    ('21', 'Industrial', 21, v_tenant_id, true),
    ('22', 'Convencional', 22, v_tenant_id, true),
    ('23', 'Metalocêno', 23, v_tenant_id, true),
    ('24', 'Homopolímero', 24, v_tenant_id, true),
    ('25', 'Copolímero', 25, v_tenant_id, true),
    ('26', 'Adesivo', 26, v_tenant_id, true),
    ('27', 'Catalisador', 27, v_tenant_id, true),
    ('28', 'Solvente', 28, v_tenant_id, true),
    ('29', 'Verniz', 29, v_tenant_id, true),
    ('30', 'Aditivo', 30, v_tenant_id, true),
    ('31', 'Pet Nat', 31, v_tenant_id, true),
    ('32', 'Pet Met', 32, v_tenant_id, true),
    ('33', 'Pet Vmate', 33, v_tenant_id, true),
    ('34', 'Bopp Nat', 34, v_tenant_id, true),
    ('35', 'Bopp Met', 35, v_tenant_id, true),
    ('36', 'Bopp Mate', 36, v_tenant_id, true),
    ('37', 'PP Nat', 37, v_tenant_id, true),
    ('38', 'Caneta', 38, v_tenant_id, true),
    ('39', 'Papel', 39, v_tenant_id, true),
    ('40', 'Desinfetante', 40, v_tenant_id, true),
    ('41', 'Multiuso', 41, v_tenant_id, true),
    ('42', 'Protetor Auditivo', 42, v_tenant_id, true),
    ('43', 'Bota', 43, v_tenant_id, true),
    ('44', 'Luva', 44, v_tenant_id, true),
    ('45', 'Mecânico', 45, v_tenant_id, true),
    ('46', 'Elétrico', 46, v_tenant_id, true),
    ('47', 'Fita', 47, v_tenant_id, true),
    ('48', 'Caixa', 48, v_tenant_id, true)
  ON CONFLICT DO NOTHING;

  -- FAMÍLIAS (product_families)
  INSERT INTO public.product_families (value, label, sort_order, tenant_id, is_active) VALUES
    ('1', 'NP', 1, v_tenant_id, true),
    ('2', 'PE', 2, v_tenant_id, true),
    ('3', 'Laminado Transparente', 3, v_tenant_id, true),
    ('4', 'Laminado Metalizado', 4, v_tenant_id, true),
    ('5', 'Termoencolhível', 5, v_tenant_id, true),
    ('6', 'RP', 6, v_tenant_id, true)
  ON CONFLICT DO NOTHING;

  -- CLASSES (product_classes)
  INSERT INTO public.product_classes (value, label, sort_order, tenant_id, is_active) VALUES
    ('1', '(NP + Pet Nat)', 1, v_tenant_id, true),
    ('2', '(NP + Pet Met)', 2, v_tenant_id, true),
    ('3', '(PE + Pet Nat)', 3, v_tenant_id, true),
    ('4', '(PE + Pet Met)', 4, v_tenant_id, true),
    ('5', '(NP + Pet Met + Pet Nat)', 5, v_tenant_id, true),
    ('6', '(PE + Pet Met + Pet Nat)', 6, v_tenant_id, true),
    ('7', '(NP + Pet Met + Bopp Mate)', 7, v_tenant_id, true),
    ('8', '(PE + Pet Met + Bopp Mate)', 8, v_tenant_id, true),
    ('9', '(NP + Pet Nat + Bopp Mate)', 9, v_tenant_id, true),
    ('10', '(PE + Pet Nat + Bopp Mate)', 10, v_tenant_id, true)
  ON CONFLICT DO NOTHING;

END $$;
