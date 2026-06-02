-- Backfill: cada versão filha passa a ter `name` próprio (base do pai + erp_versao do filho).
-- O `erp_versao` por dimensão já é gerado pelo trigger `compute_product_erp_versao`.
-- SKU dos filhos não é recalculado aqui (regenerar exige a função estrutural do app);
-- usuários poderão re-salvar a versão para regerar o SKU. Marcamos os filhos como
-- pendentes de envio ao ERP para que a nova descrição/atributos sejam ressincronizados.

DO $$
DECLARE
  r RECORD;
  parent_name TEXT;
  parent_versao TEXT;
  base_name TEXT;
  new_name TEXT;
BEGIN
  FOR r IN
    SELECT c.id, c.erp_versao, c.parent_product_id, p.name AS parent_name, p.erp_versao AS parent_versao
    FROM public.products c
    JOIN public.products p ON p.id = c.parent_product_id
    WHERE c.parent_product_id IS NOT NULL
  LOOP
    parent_name := COALESCE(r.parent_name, '');
    parent_versao := COALESCE(r.parent_versao, '');

    -- Remove o erp_versao do pai do final do nome para obter a base de identidade
    IF parent_versao <> '' AND right(parent_name, length(parent_versao)) = parent_versao THEN
      base_name := btrim(left(parent_name, length(parent_name) - length(parent_versao)));
    ELSE
      base_name := parent_name;
    END IF;

    new_name := btrim(base_name || ' ' || COALESCE(r.erp_versao, ''));

    UPDATE public.products
       SET name = new_name,
           origem_alteracao = 'CRM',
           pendente_envio = TRUE
     WHERE id = r.id
       AND (name IS DISTINCT FROM new_name);
  END LOOP;
END$$;