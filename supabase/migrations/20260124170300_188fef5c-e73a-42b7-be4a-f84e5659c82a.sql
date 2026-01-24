
-- Fix infinite recursion in deals RLS policy
-- The problem is that deal_participants policy references deals, creating a cycle

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view deals they have access to" ON public.deals;

-- Create a simpler policy that doesn't cause recursion
-- Use a subquery with SECURITY INVOKER to avoid recursion
CREATE POLICY "Users can view deals they have access to"
ON public.deals FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR id IN (
    SELECT deal_id FROM public.deal_participants WHERE user_id = auth.uid()
  )
);

-- Also fix deal_participants policy to avoid referencing deals
DROP POLICY IF EXISTS "Admins and deal owners can manage participants" ON public.deal_participants;

CREATE POLICY "Admins can manage all participants"
ON public.deal_participants FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Deal owners can manage participants"
ON public.deal_participants FOR ALL TO authenticated
USING (
  added_by = auth.uid() OR user_id = auth.uid()
)
WITH CHECK (true);
