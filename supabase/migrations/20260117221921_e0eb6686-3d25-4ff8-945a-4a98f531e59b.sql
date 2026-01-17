-- Add scheduled_for column to email_logs for scheduling emails
ALTER TABLE email_logs ADD COLUMN scheduled_for TIMESTAMPTZ;