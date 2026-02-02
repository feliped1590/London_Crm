-- Adicionar coluna active na tabela companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Atualizar todos os registros existentes para ativo
UPDATE companies SET active = true WHERE active IS NULL;