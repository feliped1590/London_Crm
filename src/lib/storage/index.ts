import { lovableStorageProvider } from './lovableProvider';
import type { StorageProvider } from './types';

/**
 * Provider único exportado. Para trocar por AWS S3 ou Cloudflare R2 no futuro,
 * basta criar o adapter equivalente e mudar esta linha.
 */
export const storage: StorageProvider = lovableStorageProvider;

export * from './types';
export * from './policies';
