
CREATE OR REPLACE FUNCTION public.report_vendas_produto(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date,   (p_filters->>'to')::date,   now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
  v_group_by text := COALESCE(p_filters->>'group_by', 'produto');
BEGIN
  RETURN COALESCE((
    WITH agg AS (
      SELECT
        CASE WHEN v_group_by='familia' THEN b.product_family_id
             WHEN v_group_by='grupo' THEN b.product_group_id
             ELSE b.product_id END AS grp_id,
        CASE WHEN v_group_by='familia' THEN COALESCE(pf.label,'(sem família)')
             WHEN v_group_by='grupo' THEN COALESCE(pg.label,'(sem grupo)')
             ELSE COALESCE(p.name,'(sem produto)') END AS grp_nome,
        SUM(b.quantity) AS qtd,
        SUM(b.net_value) AS valor
      FROM public.bi_sales_fact b
      LEFT JOIN public.products p ON p.id = b.product_id
      LEFT JOIN public.product_families pf ON pf.id = b.product_family_id
      LEFT JOIN public.product_groups pg ON pg.id = b.product_group_id
      WHERE b.order_date BETWEEN v_from AND v_to AND (v_admin OR b.sales_rep_id = v_my_rep)
      GROUP BY 1, 2
    ),
    with_pct AS (
      SELECT grp_id, grp_nome, qtd, valor,
        CASE WHEN SUM(valor) OVER () > 0 THEN valor / SUM(valor) OVER () * 100 ELSE 0 END AS participacao_pct
      FROM agg
    )
    SELECT jsonb_agg(jsonb_build_object(
      'id', grp_id, 'nome', grp_nome,
      'quantidade', qtd, 'valor_vendido', valor,
      'participacao_pct', participacao_pct
    ) ORDER BY valor DESC) FROM with_pct
  ), '[]'::jsonb);
END $function$;
