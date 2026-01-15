-- Drop the existing delete policy
DROP POLICY IF EXISTS "Admins can delete instances" ON whatsapp_instances;

-- Create new policy that allows users to delete their own instances or admins to delete any
CREATE POLICY "Users can delete own instances or admin"
ON whatsapp_instances
FOR DELETE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));