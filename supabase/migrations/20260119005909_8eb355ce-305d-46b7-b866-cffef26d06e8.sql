-- Fix PUBLIC_DATA_EXPOSURE: Restrict WhatsApp instances visibility to prevent token theft
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all instances" ON public.whatsapp_instances;

-- Create a secure policy that only shows instances to their owners or admins
CREATE POLICY "Users can view own instances or admin" ON public.whatsapp_instances
    FOR SELECT USING (
        user_id = auth.uid() OR 
        has_role(auth.uid(), 'admin'::app_role)
    );