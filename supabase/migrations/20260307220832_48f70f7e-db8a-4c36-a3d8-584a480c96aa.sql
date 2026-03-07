
-- Drop the old function signature with uuid parameters
DROP FUNCTION IF EXISTS public.search_customers_paginated(text, text, text, text, uuid, uuid, uuid, uuid, text, text, integer, integer);
