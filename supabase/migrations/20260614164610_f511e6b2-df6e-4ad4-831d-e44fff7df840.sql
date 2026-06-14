
CREATE OR REPLACE FUNCTION public.get_dashboard_card_metrics()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'total_clients', (SELECT count(*) FROM companies),
    'setores_count', (SELECT count(DISTINCT setor_id) FROM companies WHERE setor_id IS NOT NULL),
    'top_setor_nome', (SELECT s.nome FROM companies c JOIN setores s ON c.setor_id = s.id GROUP BY s.nome ORDER BY count(*) DESC LIMIT 1),
    'top_setor_count', (SELECT count(*) FROM companies c JOIN setores s ON c.setor_id = s.id GROUP BY s.nome ORDER BY count(*) DESC LIMIT 1),
    'top_segmento_nome', (SELECT sg.nome FROM companies c JOIN segmentos sg ON c.segmento_id = sg.id GROUP BY sg.nome ORDER BY count(*) DESC LIMIT 1),
    'top_segmento_count', (SELECT count(*) FROM companies c JOIN segmentos sg ON c.segmento_id = sg.id GROUP BY sg.nome ORDER BY count(*) DESC LIMIT 1),
    'top_atividade_nome', (SELECT a.nome FROM companies c JOIN atividades a ON c.atividade_id = a.id GROUP BY a.nome ORDER BY count(*) DESC LIMIT 1),
    'top_atividade_count', (SELECT count(*) FROM companies c JOIN atividades a ON c.atividade_id = a.id GROUP BY a.nome ORDER BY count(*) DESC LIMIT 1),
    'active_clients', (SELECT count(*) FROM companies WHERE lifecycle_stage = 'customer_active' AND activity_status = 'ativo'),
    'open_deals_count', (SELECT count(*) FROM deals WHERE stage NOT IN ('fechado_ganho', 'fechado_perdido')),
    'open_deals_value', (SELECT coalesce(sum(value), 0) FROM deals WHERE stage NOT IN ('fechado_ganho', 'fechado_perdido'))
  );
$function$;
