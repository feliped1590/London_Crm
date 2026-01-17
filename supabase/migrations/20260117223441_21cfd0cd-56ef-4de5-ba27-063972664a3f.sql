-- Add DELETE policy for email_logs so users can delete their scheduled emails
CREATE POLICY "Users can delete scheduled emails they sent"
ON public.email_logs
FOR DELETE
USING (sent_by = auth.uid() AND status = 'scheduled');