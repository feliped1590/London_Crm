import { supabase } from '@/integrations/supabase/client';
import type { StorageProvider, UploadInput, UploadResult } from './types';

/**
 * Adapter do Lovable Cloud (Supabase Storage).
 * Trocar por adapter S3/R2 no futuro é só implementar a mesma interface.
 */
export const lovableStorageProvider: StorageProvider = {
  async upload({ bucket, path, file, contentType, upsert }: UploadInput): Promise<UploadResult> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: contentType ?? (file instanceof File ? file.type : undefined),
      upsert: upsert ?? false,
    });
    if (error) throw new Error(`Falha no upload: ${error.message}`);
    return { bucket, path };
  },

  getPublicUrl(bucket, path) {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },

  async getSignedUrl(bucket, path, expiresInSec = 3600) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
    if (error) throw new Error(`Falha ao gerar URL assinada: ${error.message}`);
    return data.signedUrl;
  },

  async remove(bucket, paths) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw new Error(`Falha ao remover arquivo: ${error.message}`);
  },
};
