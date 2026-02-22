
CREATE OR REPLACE FUNCTION public.get_region_by_state(state_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE UPPER(TRIM(COALESCE(state_code, '')))
    WHEN 'AC' THEN 'Norte'
    WHEN 'AP' THEN 'Norte'
    WHEN 'AM' THEN 'Norte'
    WHEN 'PA' THEN 'Norte'
    WHEN 'RO' THEN 'Norte'
    WHEN 'RR' THEN 'Norte'
    WHEN 'TO' THEN 'Norte'
    WHEN 'AL' THEN 'Nordeste'
    WHEN 'BA' THEN 'Nordeste'
    WHEN 'CE' THEN 'Nordeste'
    WHEN 'MA' THEN 'Nordeste'
    WHEN 'PB' THEN 'Nordeste'
    WHEN 'PE' THEN 'Nordeste'
    WHEN 'PI' THEN 'Nordeste'
    WHEN 'RN' THEN 'Nordeste'
    WHEN 'SE' THEN 'Nordeste'
    WHEN 'DF' THEN 'Centro-Oeste'
    WHEN 'GO' THEN 'Centro-Oeste'
    WHEN 'MT' THEN 'Centro-Oeste'
    WHEN 'MS' THEN 'Centro-Oeste'
    WHEN 'ES' THEN 'Sudeste'
    WHEN 'MG' THEN 'Sudeste'
    WHEN 'RJ' THEN 'Sudeste'
    WHEN 'SP' THEN 'Sudeste'
    WHEN 'PR' THEN 'Sul'
    WHEN 'RS' THEN 'Sul'
    WHEN 'SC' THEN 'Sul'
    ELSE 'Não definido'
  END;
$function$;
