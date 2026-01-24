-- Table for AI-generated conversation summaries
CREATE TABLE public.whatsapp_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  customer_intent TEXT,
  next_steps TEXT[],
  message_count INT,
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table for detected objections in conversations
CREATE TABLE public.whatsapp_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('price', 'timing', 'competition', 'authority', 'need', 'other')),
  description TEXT NOT NULL,
  message_excerpt TEXT,
  status TEXT DEFAULT 'raised' CHECK (status IN ('raised', 'addressed', 'resolved')),
  resolution TEXT,
  detected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_summaries_phone ON public.whatsapp_conversation_summaries(phone);
CREATE INDEX idx_summaries_contact ON public.whatsapp_conversation_summaries(contact_id);
CREATE INDEX idx_objections_phone ON public.whatsapp_objections(phone);
CREATE INDEX idx_objections_contact ON public.whatsapp_objections(contact_id);
CREATE INDEX idx_objections_status ON public.whatsapp_objections(status);

-- Enable RLS
ALTER TABLE public.whatsapp_conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_objections ENABLE ROW LEVEL SECURITY;

-- RLS policies for summaries (authenticated users can access)
CREATE POLICY "Authenticated users can view summaries"
ON public.whatsapp_conversation_summaries FOR SELECT
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert summaries"
ON public.whatsapp_conversation_summaries FOR INSERT
WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update summaries"
ON public.whatsapp_conversation_summaries FOR UPDATE
USING (public.is_authenticated());

-- RLS policies for objections
CREATE POLICY "Authenticated users can view objections"
ON public.whatsapp_objections FOR SELECT
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can insert objections"
ON public.whatsapp_objections FOR INSERT
WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update objections"
ON public.whatsapp_objections FOR UPDATE
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can delete objections"
ON public.whatsapp_objections FOR DELETE
USING (public.is_authenticated());

-- Triggers for updated_at
CREATE TRIGGER update_summaries_updated_at
BEFORE UPDATE ON public.whatsapp_conversation_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_objections_updated_at
BEFORE UPDATE ON public.whatsapp_objections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();