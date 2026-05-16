import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  uploadAttachment,
  listAttachments,
  deleteAttachment,
  type AttachmentRow,
} from '@/services/attachments';
import type { AttachmentEntityType, AttachmentModule } from '@/lib/storage';

function useActiveTenantId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['active_tenant_id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      return data?.tenant_id ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
}

export function useAttachments(entityType: AttachmentEntityType, entityId: string | undefined | null) {
  return useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => listAttachments(entityType, entityId as string),
    enabled: !!entityId,
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  const { data: tenantId } = useActiveTenantId();

  return useMutation({
    mutationFn: async (args: {
      module: AttachmentModule;
      entityType: AttachmentEntityType;
      entityId: string | null;
      file: File;
    }) => {
      if (!tenantId) throw new Error('Tenant ativo não localizado.');
      return uploadAttachment({ ...args, tenantId });
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: ['attachments', vars.entityType, vars.entityId] });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (att: AttachmentRow) => deleteAttachment(att),
    onSuccess: (_v, att) => {
      qc.invalidateQueries({ queryKey: ['attachments', att.entity_type, att.entity_id] });
    },
  });
}

export type { AttachmentRow };
