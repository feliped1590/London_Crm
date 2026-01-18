-- Create table for user dashboard configurations
CREATE TABLE public.user_dashboard_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL DEFAULT 'Meu Dashboard',
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.user_dashboard_configs ENABLE ROW LEVEL SECURITY;

-- Policies: users can only manage their own configs
CREATE POLICY "Users can view their own dashboard configs"
ON public.user_dashboard_configs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboard configs"
ON public.user_dashboard_configs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard configs"
ON public.user_dashboard_configs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard configs"
ON public.user_dashboard_configs
FOR DELETE
USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_user_dashboard_configs_updated_at
BEFORE UPDATE ON public.user_dashboard_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();