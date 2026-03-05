
-- Create IPI mode enum
CREATE TYPE public.ipi_mode AS ENUM ('destacar', 'incluso', 'isento');

-- Add IPI fields to proposals
ALTER TABLE public.proposals
  ADD COLUMN ipi_mode public.ipi_mode NOT NULL DEFAULT 'destacar',
  ADD COLUMN subtotal_products numeric NOT NULL DEFAULT 0,
  ADD COLUMN total_ipi numeric NOT NULL DEFAULT 0;

-- Add IPI fields to proposal_items
ALTER TABLE public.proposal_items
  ADD COLUMN ipi_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN ipi_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN subtotal_item numeric NOT NULL DEFAULT 0,
  ADD COLUMN total_item numeric NOT NULL DEFAULT 0;

-- Add IPI fields to orders
ALTER TABLE public.orders
  ADD COLUMN ipi_mode public.ipi_mode NOT NULL DEFAULT 'destacar',
  ADD COLUMN subtotal_products numeric NOT NULL DEFAULT 0,
  ADD COLUMN total_ipi numeric NOT NULL DEFAULT 0;

-- Add IPI fields to order_items
ALTER TABLE public.order_items
  ADD COLUMN ipi_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN ipi_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN subtotal_item numeric NOT NULL DEFAULT 0,
  ADD COLUMN total_item numeric NOT NULL DEFAULT 0;

-- Backfill existing data: set subtotal_item = subtotal and total_item = subtotal for all existing items
UPDATE public.proposal_items SET subtotal_item = subtotal, total_item = subtotal WHERE subtotal_item = 0 AND subtotal > 0;
UPDATE public.order_items SET subtotal_item = subtotal, total_item = subtotal WHERE subtotal_item = 0 AND subtotal > 0;

-- Backfill proposals totals
UPDATE public.proposals SET subtotal_products = total_value WHERE subtotal_products = 0 AND total_value > 0;
UPDATE public.orders SET subtotal_products = total_value WHERE subtotal_products = 0 AND total_value > 0;
