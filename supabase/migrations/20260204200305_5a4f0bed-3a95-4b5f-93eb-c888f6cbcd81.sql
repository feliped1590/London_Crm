-- Add owner_id column to crm_clients table for seller assignment
ALTER TABLE crm_clients 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_crm_clients_owner_id ON crm_clients(owner_id);