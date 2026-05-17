import type { AttachmentModule } from './types';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const IMAGES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const DOC_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'text/csv',
  'application/zip',
] as const;

export const MODULE_ALLOWED_MIME: Record<AttachmentModule, readonly string[]> = {
  avatars: IMAGES,
  produtos: [...IMAGES, 'application/pdf'],
  crm: [...IMAGES, ...DOC_MIME],
  pedidos: [...IMAGES, ...DOC_MIME],
  propostas: [...IMAGES, ...DOC_MIME],
  contratos: [...IMAGES, ...DOC_MIME],
  documentos: [...IMAGES, ...DOC_MIME],
};

export const MODULE_BUCKET: Record<AttachmentModule, string> = {
  avatars: 'avatars',
  produtos: 'produtos',
  crm: 'crm',
  pedidos: 'pedidos',
  propostas: 'propostas',
  contratos: 'contratos',
  documentos: 'documentos',
};

export const PUBLIC_MODULES: readonly AttachmentModule[] = ['avatars', 'produtos'];

export function isPublicModule(m: AttachmentModule): boolean {
  return PUBLIC_MODULES.includes(m);
}

export function validateFile(
  file: File,
  module: AttachmentModule,
): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: 'Arquivo vazio.' };
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `Arquivo excede 5 MB (atual: ${(file.size / 1024 / 1024).toFixed(1)} MB).` };
  }
  const allowed = MODULE_ALLOWED_MIME[module];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: `Tipo "${file.type || 'desconhecido'}" não permitido para ${module}.` };
  }
  if (file.name.length > 255) return { ok: false, error: 'Nome do arquivo muito longo (máx. 255).' };
  return { ok: true };
}

/** Slugify simples para nome do objeto no bucket. */
export function slugifyFileName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot).toLowerCase() : '';
  const slug = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'arquivo';
  return `${slug}${ext}`;
}
