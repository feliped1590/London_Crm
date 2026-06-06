
CREATE EXTENSION IF NOT EXISTS hstore;

CREATE OR REPLACE FUNCTION public.enforce_uppercase_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  col TEXT;
  cols TEXT[];
  val TEXT;
BEGIN
  cols := TG_ARGV::TEXT[];
  FOREACH col IN ARRAY cols LOOP
    EXECUTE format('SELECT ($1).%I::text', col) INTO val USING NEW;
    IF val IS NOT NULL AND val <> upper(val) THEN
      NEW := NEW #= hstore(col, upper(val));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- companies
DROP TRIGGER IF EXISTS trg_uppercase_companies ON public.companies;
CREATE TRIGGER trg_uppercase_companies
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text(
  'name','fantasia','address','address_number','address_complement','neighborhood','city','state',
  'contact_name','inscricao_estadual','inscricao_municipal','suframa','origin','notes'
);

DROP TRIGGER IF EXISTS trg_uppercase_contacts ON public.contacts;
CREATE TRIGGER trg_uppercase_contacts
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text(
  'first_name','last_name','job_title','department','notes'
);

DROP TRIGGER IF EXISTS trg_uppercase_products ON public.products;
CREATE TRIGGER trg_uppercase_products
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text(
  'name','nome_impresso','description'
);

DROP TRIGGER IF EXISTS trg_uppercase_deals ON public.deals;
CREATE TRIGGER trg_uppercase_deals
BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text(
  'name','notes','lost_reason'
);

DROP TRIGGER IF EXISTS trg_uppercase_orders ON public.orders;
CREATE TRIGGER trg_uppercase_orders
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text(
  'observations','delivery_name','delivery_contact','delivery_address',
  'delivery_number','delivery_neighborhood','delivery_city','delivery_state'
);

DROP TRIGGER IF EXISTS trg_uppercase_order_items ON public.order_items;
CREATE TRIGGER trg_uppercase_order_items
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text(
  'observations','observations_pcp','ordem_compra','description'
);

DROP TRIGGER IF EXISTS trg_uppercase_pipelines ON public.pipelines;
CREATE TRIGGER trg_uppercase_pipelines
BEFORE INSERT OR UPDATE ON public.pipelines
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text('name','description');

DROP TRIGGER IF EXISTS trg_uppercase_carriers ON public.carriers;
CREATE TRIGGER trg_uppercase_carriers
BEFORE INSERT OR UPDATE ON public.carriers
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text(
  'name','trade_name','address','address_number','neighborhood','city','state','ie'
);

DROP TRIGGER IF EXISTS trg_uppercase_tasks ON public.tasks;
CREATE TRIGGER trg_uppercase_tasks
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_text('title','description');

-- ====== Backfill (sem disparar triggers de sync) ======
SET LOCAL session_replication_role = replica;

UPDATE public.companies SET
  name = upper(name),
  fantasia = upper(fantasia),
  address = upper(address),
  address_number = upper(address_number),
  address_complement = upper(address_complement),
  neighborhood = upper(neighborhood),
  city = upper(city),
  state = upper(state),
  contact_name = upper(contact_name),
  inscricao_estadual = upper(inscricao_estadual),
  inscricao_municipal = upper(inscricao_municipal),
  suframa = upper(suframa),
  origin = upper(origin),
  notes = upper(notes)
WHERE
  name IS DISTINCT FROM upper(name) OR
  fantasia IS DISTINCT FROM upper(fantasia) OR
  address IS DISTINCT FROM upper(address) OR
  address_number IS DISTINCT FROM upper(address_number) OR
  address_complement IS DISTINCT FROM upper(address_complement) OR
  neighborhood IS DISTINCT FROM upper(neighborhood) OR
  city IS DISTINCT FROM upper(city) OR
  state IS DISTINCT FROM upper(state) OR
  contact_name IS DISTINCT FROM upper(contact_name) OR
  inscricao_estadual IS DISTINCT FROM upper(inscricao_estadual) OR
  inscricao_municipal IS DISTINCT FROM upper(inscricao_municipal) OR
  suframa IS DISTINCT FROM upper(suframa) OR
  origin IS DISTINCT FROM upper(origin) OR
  notes IS DISTINCT FROM upper(notes);

UPDATE public.contacts SET
  first_name = upper(first_name),
  last_name = upper(last_name),
  job_title = upper(job_title),
  department = upper(department),
  notes = upper(notes)
WHERE
  first_name IS DISTINCT FROM upper(first_name) OR
  last_name IS DISTINCT FROM upper(last_name) OR
  job_title IS DISTINCT FROM upper(job_title) OR
  department IS DISTINCT FROM upper(department) OR
  notes IS DISTINCT FROM upper(notes);

UPDATE public.products SET
  name = upper(name),
  nome_impresso = upper(nome_impresso),
  description = upper(description)
WHERE
  name IS DISTINCT FROM upper(name) OR
  nome_impresso IS DISTINCT FROM upper(nome_impresso) OR
  description IS DISTINCT FROM upper(description);

UPDATE public.deals SET
  name = upper(name),
  notes = upper(notes),
  lost_reason = upper(lost_reason)
WHERE
  name IS DISTINCT FROM upper(name) OR
  notes IS DISTINCT FROM upper(notes) OR
  lost_reason IS DISTINCT FROM upper(lost_reason);

UPDATE public.orders SET
  observations = upper(observations),
  delivery_name = upper(delivery_name),
  delivery_contact = upper(delivery_contact),
  delivery_address = upper(delivery_address),
  delivery_number = upper(delivery_number),
  delivery_neighborhood = upper(delivery_neighborhood),
  delivery_city = upper(delivery_city),
  delivery_state = upper(delivery_state)
WHERE
  observations IS DISTINCT FROM upper(observations) OR
  delivery_name IS DISTINCT FROM upper(delivery_name) OR
  delivery_contact IS DISTINCT FROM upper(delivery_contact) OR
  delivery_address IS DISTINCT FROM upper(delivery_address) OR
  delivery_number IS DISTINCT FROM upper(delivery_number) OR
  delivery_neighborhood IS DISTINCT FROM upper(delivery_neighborhood) OR
  delivery_city IS DISTINCT FROM upper(delivery_city) OR
  delivery_state IS DISTINCT FROM upper(delivery_state);

UPDATE public.order_items SET
  observations = upper(observations),
  observations_pcp = upper(observations_pcp),
  ordem_compra = upper(ordem_compra),
  description = upper(description)
WHERE
  observations IS DISTINCT FROM upper(observations) OR
  observations_pcp IS DISTINCT FROM upper(observations_pcp) OR
  ordem_compra IS DISTINCT FROM upper(ordem_compra) OR
  description IS DISTINCT FROM upper(description);

UPDATE public.pipelines SET
  name = upper(name),
  description = upper(description)
WHERE name IS DISTINCT FROM upper(name) OR description IS DISTINCT FROM upper(description);

UPDATE public.carriers SET
  name = upper(name),
  trade_name = upper(trade_name),
  address = upper(address),
  address_number = upper(address_number),
  neighborhood = upper(neighborhood),
  city = upper(city),
  state = upper(state),
  ie = upper(ie)
WHERE
  name IS DISTINCT FROM upper(name) OR
  trade_name IS DISTINCT FROM upper(trade_name) OR
  address IS DISTINCT FROM upper(address) OR
  address_number IS DISTINCT FROM upper(address_number) OR
  neighborhood IS DISTINCT FROM upper(neighborhood) OR
  city IS DISTINCT FROM upper(city) OR
  state IS DISTINCT FROM upper(state) OR
  ie IS DISTINCT FROM upper(ie);

UPDATE public.tasks SET
  title = upper(title),
  description = upper(description)
WHERE title IS DISTINCT FROM upper(title) OR description IS DISTINCT FROM upper(description);
