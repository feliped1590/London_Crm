-- Create whatsapp_instances table to store Z-API instances for each seller
CREATE TABLE public.whatsapp_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    instance_id TEXT NOT NULL,
    instance_token TEXT NOT NULL,
    phone_number TEXT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(instance_id)
);

-- Create whatsapp_messages table to store all messages
CREATE TABLE public.whatsapp_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    zapi_message_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create whatsapp_contacts table to link WhatsApp numbers to CRM contacts
CREATE TABLE public.whatsapp_contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    profile_name TEXT,
    profile_picture_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(phone_number)
);

-- Enable RLS on all tables
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_instances
CREATE POLICY "Users can view all instances" ON public.whatsapp_instances
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert instances" ON public.whatsapp_instances
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own instances or admin" ON public.whatsapp_instances
    FOR UPDATE USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete instances" ON public.whatsapp_instances
    FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for whatsapp_messages
CREATE POLICY "Authenticated users can view messages" ON public.whatsapp_messages
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert messages" ON public.whatsapp_messages
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update messages" ON public.whatsapp_messages
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for whatsapp_contacts
CREATE POLICY "Authenticated users can view whatsapp contacts" ON public.whatsapp_contacts
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert whatsapp contacts" ON public.whatsapp_contacts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update whatsapp contacts" ON public.whatsapp_contacts
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete whatsapp contacts" ON public.whatsapp_contacts
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX idx_whatsapp_messages_instance_id ON public.whatsapp_messages(instance_id);
CREATE INDEX idx_whatsapp_messages_contact_id ON public.whatsapp_messages(contact_id);
CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_contacts_phone ON public.whatsapp_contacts(phone_number);

-- Add triggers for updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
    BEFORE UPDATE ON public.whatsapp_instances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_contacts_updated_at
    BEFORE UPDATE ON public.whatsapp_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;