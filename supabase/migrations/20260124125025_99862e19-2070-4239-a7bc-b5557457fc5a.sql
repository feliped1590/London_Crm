-- Drop existing delete policy
DROP POLICY IF EXISTS "Admins can delete companies" ON companies;

-- Create new policy allowing owners, creators and admins to delete
CREATE POLICY "Users can delete companies they own or are admin"
ON companies FOR DELETE
USING (
  owner_id = auth.uid() 
  OR created_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin'::app_role)
);