/**
 * Abstração de storage — preparada para múltiplos providers (Supabase agora,
 * AWS S3 / Cloudflare R2 no futuro). Toda a aplicação consome apenas estes tipos.
 */

export type AttachmentModule =
  | 'crm'
  | 'pedidos'
  | 'produtos'
  | 'propostas'
  | 'contratos'
  | 'avatars'
  | 'documentos';

export type AttachmentEntityType =
  | 'company'
  | 'order'
  | 'proposal'
  | 'product'
  | 'contract'
  | 'customer_document'
  | 'service_engagement'
  | 'user'
  | 'misc';

export interface UploadInput {
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  upsert?: boolean;
}

export interface UploadResult {
  bucket: string;
  path: string;
}

export interface StorageProvider {
  upload(input: UploadInput): Promise<UploadResult>;
  getPublicUrl(bucket: string, path: string): string;
  getSignedUrl(bucket: string, path: string, expiresInSec?: number): Promise<string>;
  remove(bucket: string, paths: string[]): Promise<void>;
}
