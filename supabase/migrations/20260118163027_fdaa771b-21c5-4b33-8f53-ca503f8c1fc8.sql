-- Create enums for proposal and order statuses
CREATE TYPE proposal_status AS ENUM ('rascunho', 'enviada', 'em_analise', 'aprovada', 'recusada', 'expirada');
CREATE TYPE order_status AS ENUM ('pendente', 'em_producao', 'produzido', 'faturado', 'entregue', 'cancelado');

-- Create products table for packaging items catalog
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit_measure TEXT DEFAULT 'un',
    unit_price NUMERIC(12,2) DEFAULT 0,
    material TEXT,
    color TEXT,
    width NUMERIC(10,2),
    length NUMERIC(10,2),
    thickness NUMERIC(10,3),
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create proposals table
CREATE TABLE public.proposals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    deal_id UUID NOT NULL,
    company_id UUID,
    contact_id UUID,
    status proposal_status NOT NULL DEFAULT 'rascunho',
    validity_date DATE,
    payment_terms TEXT,
    delivery_terms TEXT,
    observations TEXT,
    total_value NUMERIC(14,2) DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create proposal_items table
CREATE TABLE public.proposal_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    description TEXT NOT NULL,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    width NUMERIC(10,2),
    length NUMERIC(10,2),
    thickness NUMERIC(10,3),
    discount_percent NUMERIC(5,2) DEFAULT 0,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    proposal_id UUID REFERENCES public.proposals(id),
    company_id UUID,
    contact_id UUID,
    status order_status NOT NULL DEFAULT 'pendente',
    delivery_date DATE,
    total_value NUMERIC(14,2) DEFAULT 0,
    observations TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    description TEXT NOT NULL,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    width NUMERIC(10,2),
    length NUMERIC(10,2),
    thickness NUMERIC(10,3),
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence for proposal numbers
CREATE SEQUENCE proposal_number_seq START 1;

-- Create sequence for order numbers
CREATE SEQUENCE order_number_seq START 1;

-- Function to generate proposal number
CREATE OR REPLACE FUNCTION public.generate_proposal_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := 'PROP-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('proposal_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := 'PED-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for proposal number generation
CREATE TRIGGER generate_proposal_number_trigger
BEFORE INSERT ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.generate_proposal_number();

-- Trigger for order number generation
CREATE TRIGGER generate_order_number_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

-- Trigger for updated_at on products
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on proposals
CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on orders
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "Authenticated users can view active products"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert products"
ON public.products FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update products"
ON public.products FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for proposals
CREATE POLICY "Authenticated users can view proposals"
ON public.proposals FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert proposals"
ON public.proposals FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update proposals they created or are admin"
ON public.proposals FOR UPDATE
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete proposals"
ON public.proposals FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for proposal_items
CREATE POLICY "Authenticated users can view proposal items"
ON public.proposal_items FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert proposal items"
ON public.proposal_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update proposal items"
ON public.proposal_items FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete proposal items"
ON public.proposal_items FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies for orders
CREATE POLICY "Authenticated users can view orders"
ON public.orders FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update orders they created or are admin"
ON public.orders FOR UPDATE
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for order_items
CREATE POLICY "Authenticated users can view order items"
ON public.order_items FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert order items"
ON public.order_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update order items"
ON public.order_items FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete order items"
ON public.order_items FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active ON public.products(active);
CREATE INDEX idx_proposals_deal_id ON public.proposals(deal_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_proposals_company_id ON public.proposals(company_id);
CREATE INDEX idx_proposal_items_proposal_id ON public.proposal_items(proposal_id);
CREATE INDEX idx_orders_proposal_id ON public.orders(proposal_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_company_id ON public.orders(company_id);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);