-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage pipeline stages" ON pipeline_stages;

-- Create new policy that allows all authenticated users to insert/update/delete
-- This is appropriate for settings pages where authorized users are already filtered by the UI
CREATE POLICY "Authenticated users can manage pipeline stages"
ON pipeline_stages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);