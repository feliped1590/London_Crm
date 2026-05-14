
CREATE TABLE IF NOT EXISTS public.ficha_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  description text,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ficha_schemas_key_format CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT ficha_schemas_version_positive CHECK (version > 0),
  CONSTRAINT ficha_schemas_key_version_unique UNIQUE (tenant_id, key, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS ficha_schemas_one_active_per_key
  ON public.ficha_schemas (tenant_id, key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS ficha_schemas_tenant_key_idx
  ON public.ficha_schemas (tenant_id, key);

DROP TRIGGER IF EXISTS trg_ficha_schemas_updated_at ON public.ficha_schemas;
CREATE TRIGGER trg_ficha_schemas_updated_at
BEFORE UPDATE ON public.ficha_schemas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ficha_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ficha_schemas_select_tenant"
ON public.ficha_schemas FOR SELECT
TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "ficha_schemas_insert_admin_dev"
ON public.ficha_schemas FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role))
);

CREATE POLICY "ficha_schemas_update_admin_dev"
ON public.ficha_schemas FOR UPDATE
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role))
);

CREATE POLICY "ficha_schemas_delete_admin_dev"
ON public.ficha_schemas FOR DELETE
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role))
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ficha_schema_key text,
  ADD COLUMN IF NOT EXISTS ficha_schema_version integer;

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS ficha_renderer_version text NOT NULL DEFAULT 'v1';

DO $$
DECLARE
  t_id uuid;
  def_stand_up_liso jsonb;
  def_stand_up_impresso jsonb;
  def_saco_liso jsonb;
  def_saco_impresso jsonb;
  def_bobina_lisa jsonb;
  def_bobina_impressa jsonb;

  sec_stand_up jsonb := jsonb_build_object(
    'id','stand_up','title','Stand Up',
    'layout', jsonb_build_object('columns',2),
    'fields', jsonb_build_array(
      jsonb_build_object('id','distancia_picote','type','number','label','Distância do picote (mm)','unit','mm','min',0,'step',0.01),
      jsonb_build_object('id','distancia_ziper','type','number','label','Distância do zíper (mm)','unit','mm','min',0,'step',0.01)
    )
  );
  sec_acessorios jsonb := jsonb_build_object(
    'id','acessorios','title','Acessórios',
    'fields', jsonb_build_array(
      jsonb_build_object(
        'id','itens','type','repeater','label','Acessórios',
        'itemFields', jsonb_build_array(
          jsonb_build_object('id','accessory_id','type','lookup','source','product_ficha_accessories','label','Acessório','required',true),
          jsonb_build_object('id','valor','type','text','label','Detalhe (opcional)')
        )
      )
    )
  );
  sec_embalagem jsonb := jsonb_build_object(
    'id','embalagem','title','Embalagem',
    'layout', jsonb_build_object('columns',2),
    'fields', jsonb_build_array(
      jsonb_build_object('id','tipo','type','select','label','Tipo','options', jsonb_build_array('Fardo','Caixa')),
      jsonb_build_object('id','quantidade','type','integer','label','Quantidade por embalagem','min',0,'step',1)
    )
  );
  sec_observacoes jsonb := jsonb_build_object(
    'id','observacoes','title','Observações',
    'fields', jsonb_build_array(
      jsonb_build_object('id','texto','type','textarea','label','Observações','rows',3)
    )
  );
  sec_impressao jsonb := jsonb_build_object(
    'id','impressao','title','Impressão',
    'layout', jsonb_build_object('columns',3),
    'fields', jsonb_build_array(
      jsonb_build_object('id','tipo','type','select','label','Tipo de impressão','options', jsonb_build_array('Interna','Externa')),
      jsonb_build_object('id','local','type','select','label','Local de impressão','options', jsonb_build_array('Frente','Frente e Verso','Verso')),
      jsonb_build_object('id','qtd_cores','type','select','label','Quantidade de cores','options', jsonb_build_array(1,2,3,4,5,6,7,8)),
      jsonb_build_object('id','repeticao_lateral','type','number','label','Repetição lateral (mm)','unit','mm','min',0,'step',0.01),
      jsonb_build_object('id','repeticao_longitudinal','type','number','label','Repetição longitudinal (mm)','unit','mm','min',0,'step',0.01),
      jsonb_build_object('id','passo','type','number','label','Passo (mm)','unit','mm','min',0,'step',0.01),
      jsonb_build_object('id','cilindro_id','type','lookup','source','product_ficha_cylinders','label','Diâmetro do cilindro'),
      jsonb_build_object('id','maquina_id','type','lookup','source','product_ficha_machines','label','Máquina'),
      jsonb_build_object('id','cameron','type','select','label','Cameron','options', jsonb_build_array('Sim','Não','Duplo')),
      jsonb_build_object('id','fotocelula','type','select','label','Fotocélula','options', jsonb_build_array('Sim','Não','Dupla'))
    )
  );
  sec_bobina jsonb := jsonb_build_object(
    'id','bobina','title','Bobina',
    'layout', jsonb_build_object('columns',3),
    'fields', jsonb_build_array(
      jsonb_build_object('id','tubete_tipo','type','select','label','Tipo de tubete','options', jsonb_build_array('PVC','Papelão','Ferro')),
      jsonb_build_object('id','tubete_diametro','type','select','label','Diâmetro do tubete (pol)','options', jsonb_build_array('3"','6"')),
      jsonb_build_object('id','descontar_tubo','type','boolean','label','Descontar tubo'),
      jsonb_build_object('id','peso_bobina','type','number','label','Peso por bobina (kg)','unit','kg','min',0,'step',0.001),
      jsonb_build_object('id','diametro_bobina','type','number','label','Diâmetro da bobina (mm)','unit','mm','min',0,'step',0.01),
      jsonb_build_object('id','metragem_bobina','type','number','label','Metragem da bobina (m)','unit','m','min',0,'step',0.01),
      jsonb_build_object('id','emendas_por_bobina','type','select','label','Emendas por bobina','options', jsonb_build_array(1,2,3))
    )
  );
  sec_bobina_impressa jsonb := jsonb_build_object(
    'id','bobina','title','Bobina',
    'layout', jsonb_build_object('columns',3),
    'fields', jsonb_build_array(
      jsonb_build_object('id','tubete_tipo','type','select','label','Tipo de tubete','options', jsonb_build_array('PVC','Papelão','Ferro')),
      jsonb_build_object('id','tubete_diametro','type','select','label','Diâmetro do tubete (pol)','options', jsonb_build_array('3"','6"')),
      jsonb_build_object('id','descontar_tubo','type','boolean','label','Descontar tubo'),
      jsonb_build_object('id','peso_bobina','type','number','label','Peso por bobina (kg)','unit','kg','min',0,'step',0.001),
      jsonb_build_object('id','diametro_bobina','type','number','label','Diâmetro da bobina (mm)','unit','mm','min',0,'step',0.01),
      jsonb_build_object('id','metragem_bobina','type','number','label','Metragem da bobina (m)','unit','m','min',0,'step',0.01),
      jsonb_build_object('id','emendas_por_bobina','type','select','label','Emendas por bobina','options', jsonb_build_array(1,2,3)),
      jsonb_build_object('id','sentido_embobinamento','type','select','label','Sentido de embobinamento','options', jsonb_build_array('Pé Externo','Pé Interno','Cabeça Externo','Cabeça Interno'))
    )
  );
BEGIN
  def_stand_up_liso := jsonb_build_object('key','stand_up_liso','title','Stand Up Liso','sections', jsonb_build_array(sec_stand_up, sec_acessorios, sec_embalagem, sec_observacoes));
  def_stand_up_impresso := jsonb_build_object('key','stand_up_impresso','title','Stand Up Impresso','sections', jsonb_build_array(sec_stand_up, sec_acessorios, sec_embalagem, sec_impressao, sec_observacoes));
  def_saco_liso := jsonb_build_object('key','saco_liso','title','Saco Liso','sections', jsonb_build_array(sec_acessorios, sec_embalagem, sec_observacoes));
  def_saco_impresso := jsonb_build_object('key','saco_impresso','title','Saco Impresso','sections', jsonb_build_array(sec_acessorios, sec_embalagem, sec_impressao, sec_observacoes));
  def_bobina_lisa := jsonb_build_object('key','bobina_lisa','title','Bobina Lisa','sections', jsonb_build_array(sec_bobina, sec_observacoes));
  def_bobina_impressa := jsonb_build_object('key','bobina_impressa','title','Bobina Impressa','sections', jsonb_build_array(sec_bobina_impressa, sec_impressao, sec_observacoes));

  FOR t_id IN SELECT DISTINCT tenant_id FROM public.tenant_settings LOOP
    INSERT INTO public.ficha_schemas (tenant_id, key, version, is_active, title, definition, published_at)
    VALUES
      (t_id, 'stand_up_liso',     1, true, 'Stand Up Liso',     def_stand_up_liso,     now()),
      (t_id, 'stand_up_impresso', 1, true, 'Stand Up Impresso', def_stand_up_impresso, now()),
      (t_id, 'saco_liso',         1, true, 'Saco Liso',         def_saco_liso,         now()),
      (t_id, 'saco_impresso',     1, true, 'Saco Impresso',     def_saco_impresso,     now()),
      (t_id, 'bobina_lisa',       1, true, 'Bobina Lisa',       def_bobina_lisa,       now()),
      (t_id, 'bobina_impressa',   1, true, 'Bobina Impressa',   def_bobina_impressa,   now())
    ON CONFLICT (tenant_id, key, version) DO NOTHING;
  END LOOP;
END $$;
