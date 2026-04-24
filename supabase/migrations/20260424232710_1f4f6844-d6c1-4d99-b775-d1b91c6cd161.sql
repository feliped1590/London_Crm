-- Padronizar e completar módulos de permissão do CRM
DO $$
DECLARE
  role_value public.app_role;
  module_record record;
BEGIN
  -- Atualiza rótulo/caminho do módulo de clientes preservando a chave atual usada pelo menu
  UPDATE public.system_modules
  SET name = 'Clientes', path = '/customers', is_active = true
  WHERE key = 'companies';

  -- Padroniza o módulo antigo de Iniflex para Integrações, preservando permissões já ligadas ao mesmo ID
  UPDATE public.system_modules
  SET key = 'integrations', name = 'Integrações', path = '/integrations', is_active = true, sort_order = 60
  WHERE key = 'iniflex';

  -- Garante módulos reais que existem como rotas/áreas do sistema
  INSERT INTO public.system_modules (key, name, path, icon, is_active, sort_order)
  VALUES
    ('carriers', 'Transportadoras', '/carriers', 'Truck', true, 13),
    ('import_companies', 'Importação de Clientes', '/import-companies', 'Upload', true, 14),
    ('bots', 'Bots', '/bots', 'Bot', true, 15),
    ('portfolio', 'Carteira', '/reallocation', 'Users', true, 16)
  ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      path = EXCLUDED.path,
      icon = EXCLUDED.icon,
      is_active = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order;

  -- Completa linhas ausentes para todos os perfis configuráveis, sem conceder acesso por padrão
  FOR role_value IN
    SELECT unnest(ARRAY[
      'vendedor'::public.app_role,
      'atendente'::public.app_role,
      'financeiro'::public.app_role,
      'faturamento'::public.app_role,
      'logistica'::public.app_role,
      'qualidade'::public.app_role
    ])
  LOOP
    FOR module_record IN SELECT id FROM public.system_modules WHERE is_active = true
    LOOP
      INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
      VALUES (role_value, module_record.id, false, 'restrito')
      ON CONFLICT (role, module_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;