import { supabase } from '@/integrations/supabase/client';
import {
  storage,
  validateFile,
  slugifyFileName,
  MODULE_BUCKET,
  isPublicModule,
  type AttachmentEntityType,
  type AttachmentModule,
} from '@/lib/storage';

export interface AttachmentRow {
  id: string;
  tenant_id: string;
  bucket: string;
  object_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  module: AttachmentModule;
  entity_type: AttachmentEntityType;
  entity_id: string | null;
  is_public: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface UploadAttachmentInput {
  module: AttachmentModule;
  entityType: AttachmentEntityType;
  entityId: string | null;
  file: File;
  tenantId: string;
}

function buildObjectPath(
  tenantId: string,
  entityType: AttachmentEntityType,
  entityId: string | null,
  fileName: string,
): string {
  const uid = crypto.randomUUID();
  const safe = slugifyFileName(fileName);
  const eid = entityId ?? 'misc';
  return `${tenantId}/${entityType}/${eid}/${uid}-${safe}`;
}

export async function uploadAttachment(input: UploadAttachmentInput): Promise<AttachmentRow> {
  const { module, entityType, entityId, file, tenantId } = input;

  const validation = validateFile(file, module);
  if (!validation.ok) throw new Error(validation.error);

  const bucket = MODULE_BUCKET[module];
  const objectPath = buildObjectPath(tenantId, entityType, entityId, file.name);

  // 1) Sobe para o bucket
  await storage.upload({ bucket, path: objectPath, file, contentType: file.type });

  // 2) Registra metadados — se falhar, remove o objeto para não deixar órfão
  try {
    const { data, error } = await supabase
      .from('file_attachments')
      .insert({
        tenant_id: tenantId,
        bucket,
        object_path: objectPath,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        module,
        entity_type: entityType,
        entity_id: entityId,
        is_public: isPublicModule(module),
      })
      .select()
      .single();
    if (error) throw error;
    return data as AttachmentRow;
  } catch (err) {
    await storage.remove(bucket, [objectPath]).catch(() => undefined);
    throw err instanceof Error ? err : new Error('Falha ao salvar metadados do anexo.');
  }
}

export async function listAttachments(
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from('file_attachments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AttachmentRow[];
}

export async function getAttachmentUrl(att: AttachmentRow): Promise<string> {
  if (att.is_public) return storage.getPublicUrl(att.bucket, att.object_path);
  return storage.getSignedUrl(att.bucket, att.object_path, 3600);
}

export async function deleteAttachment(att: AttachmentRow): Promise<void> {
  // Remove a linha primeiro (RLS valida permissão). Em sucesso, apaga o objeto.
  const { error } = await supabase.from('file_attachments').delete().eq('id', att.id);
  if (error) throw error;
  await storage.remove(att.bucket, [att.object_path]).catch(() => undefined);
}
