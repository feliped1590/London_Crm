import { useCallback, useRef, useState } from 'react';
import { Download, FileIcon, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
  type AttachmentRow,
} from '@/hooks/useAttachments';
import { getAttachmentUrl } from '@/services/attachments';
import {
  MAX_FILE_SIZE_BYTES,
  MODULE_ALLOWED_MIME,
  validateFile,
  type AttachmentEntityType,
  type AttachmentModule,
} from '@/lib/storage';

interface Props {
  module: AttachmentModule;
  entityType: AttachmentEntityType;
  entityId: string | null | undefined;
  readOnly?: boolean;
  /** Título opcional do bloco (default depende do módulo) */
  title?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mime: string) {
  return mime.startsWith('image/');
}

export function AttachmentManager({ module, entityType, entityId, readOnly, title }: Props) {
  const { data: items = [], isLoading } = useAttachments(entityType, entityId);
  const upload = useUploadAttachment();
  const remove = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const accept = MODULE_ALLOWED_MIME[module].join(',');

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!entityId) {
        toast({
          title: 'Salve antes de anexar',
          description: 'É necessário salvar o registro pelo menos uma vez antes de adicionar arquivos.',
          variant: 'destructive',
        });
        return;
      }
      for (const file of Array.from(files)) {
        const check = validateFile(file, module);
        if (!check.ok) {
          toast({ title: 'Arquivo inválido', description: check.error, variant: 'destructive' });
          continue;
        }
        try {
          await upload.mutateAsync({ module, entityType, entityId, file });
          toast({ title: 'Arquivo enviado', description: file.name });
        } catch (err) {
          toast({
            title: 'Falha no upload',
            description: err instanceof Error ? err.message : String(err),
            variant: 'destructive',
          });
        }
      }
    },
    [entityId, entityType, module, toast, upload],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (readOnly) return;
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  const onDownload = async (att: AttachmentRow) => {
    try {
      const url = await getAttachmentUrl(att);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast({
        title: 'Erro ao abrir arquivo',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const onDelete = async (att: AttachmentRow) => {
    if (!confirm(`Excluir "${att.original_name}"?`)) return;
    try {
      await remove.mutateAsync(att);
      toast({ title: 'Arquivo removido' });
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-3">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}

      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-muted-foreground">
            Arraste arquivos aqui ou{' '}
            <button
              type="button"
              className="font-medium text-primary underline"
              onClick={() => inputRef.current?.click()}
            >
              clique para selecionar
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            Máx. {(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0)} MB por arquivo
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {upload.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando anexos…</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
          Nenhum arquivo anexado.
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((att) => (
            <li key={att.id} className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
                {isImage(att.mime_type) ? (
                  <ImageIcon className="h-4 w-4" />
                ) : (
                  <FileIcon className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{att.original_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(att.size_bytes)} · {new Date(att.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => onDownload(att)} title="Abrir / baixar">
                <Download className="h-4 w-4" />
              </Button>
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(att)}
                  title="Excluir"
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
