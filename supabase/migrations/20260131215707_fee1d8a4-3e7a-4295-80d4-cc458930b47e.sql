-- Tabela de itens de checklist por etapa
CREATE TABLE public.stage_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage public.deal_stage NOT NULL,
    pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    validation_type TEXT DEFAULT 'manual',
    auto_condition JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID
);

-- Tabela de conclusões por deal
CREATE TABLE public.deal_checklist_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
    checklist_item_id UUID REFERENCES public.stage_checklist_items(id) ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_by UUID,
    notes TEXT,
    UNIQUE(deal_id, checklist_item_id)
);

-- Índices para performance
CREATE INDEX idx_stage_checklist_items_stage ON public.stage_checklist_items(stage);
CREATE INDEX idx_stage_checklist_items_pipeline ON public.stage_checklist_items(pipeline_id);
CREATE INDEX idx_deal_checklist_completions_deal ON public.deal_checklist_completions(deal_id);
CREATE INDEX idx_deal_checklist_completions_item ON public.deal_checklist_completions(checklist_item_id);

-- RLS para stage_checklist_items
ALTER TABLE public.stage_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist items" 
    ON public.stage_checklist_items 
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Admins can manage checklist items" 
    ON public.stage_checklist_items 
    FOR ALL 
    TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS para deal_checklist_completions
ALTER TABLE public.deal_checklist_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist completions" 
    ON public.deal_checklist_completions 
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Authenticated users can insert checklist completions" 
    ON public.deal_checklist_completions 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own completions or admins" 
    ON public.deal_checklist_completions 
    FOR UPDATE 
    TO authenticated 
    USING (completed_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own completions or admins" 
    ON public.deal_checklist_completions 
    FOR DELETE 
    TO authenticated 
    USING (completed_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));