import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Download, 
  Eye,
  AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { storage, validateFile, slugifyFileName } from '@/lib/storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CreditDocumentsTabProps {
  companyId: string;
}

interface CreditDocument {
  id: string;
  company_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreditDocumentsTab({ companyId }: CreditDocumentsTabProps) {
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['credit-documents', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_documents')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CreditDocument[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, desc }: { file: File; desc: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Validação centralizada (50MB + whitelist do módulo 'documentos')
      const check = validateFile(file, 'documentos');
      if (check.ok === false) throw new Error(check.error);

      const filePath = `${companyId}/${Date.now()}_${slugifyFileName(file.name)}`;

      // Upload via storage provider (abstrato — pronto para S3/R2 no futuro)
      await storage.upload({
        bucket: 'credit-documents',
        path: filePath,
        file,
        contentType: file.type,
      });

      // Get user name from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const { error: dbError } = await supabase
        .from('credit_documents')
        .insert({
          company_id: companyId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          description: desc || null,
          uploaded_by: user.id,
          uploaded_by_name: profile?.full_name || user.email || null,
        });
      if (dbError) {
        // rollback do objeto se metadados falharem
        await storage.remove('credit-documents', [filePath]).catch(() => undefined);
        throw dbError;
      }

      // Audit log - upload
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'document.upload',
        entity_type: 'credit_document',
        entity_id: companyId,
        metadata: { file_name: file.name, file_size: file.size },
      }).then(() => {}, () => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-documents', companyId] });
      toast.success('Documento enviado com sucesso!');
      resetUploadForm();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao enviar documento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: CreditDocument) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('credit_documents').delete().eq('id', doc.id);
      if (error) throw error;
      await storage.remove('credit-documents', [doc.file_path]).catch(() => undefined);

      // Audit log - delete
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'document.delete',
          entity_type: 'credit_document',
          entity_id: doc.company_id,
          metadata: { file_name: doc.file_name, doc_id: doc.id },
        }).then(() => {}, () => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-documents', companyId] });
      toast.success('Documento removido');
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Erro ao remover documento');
    },
  });

  const resetUploadForm = () => {
    setUploadOpen(false);
    setSelectedFile(null);
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (doc: CreditDocument) => {
    let signedUrl: string;
    try {
      signedUrl = await storage.getSignedUrl('credit-documents', doc.file_path, 300);
    } catch {
      toast.error('Erro ao gerar link de download');
      return;
    }

    // Audit log - download (best-effort)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'document.download',
        entity_type: 'credit_document',
        entity_id: doc.company_id,
        metadata: { file_name: doc.file_name, doc_id: doc.id },
      }).then(() => {}, () => {});
    }

    window.open(signedUrl, '_blank');
  };

  const docToDelete = documents?.find(d => d.id === deleteId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Faça upload de documentos PDF com informações de crédito do cliente.
        </p>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Enviar Documento
        </Button>
      </div>

      {(!documents || documents.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium">Nenhum documento enviado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Envie arquivos PDF para registrar a situação de crédito deste cliente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {doc.uploaded_by_name && (
                      <>
                        <span>•</span>
                        <span>{doc.uploaded_by_name}</span>
                      </>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{doc.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc)}
                    title="Visualizar / Baixar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(doc.id)}
                      className="text-destructive hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) resetUploadForm(); else setUploadOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Documento de Crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="credit-file">Arquivo PDF *</Label>
              <Input
                ref={fileInputRef}
                id="credit-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="credit-desc">Descrição (opcional)</Label>
              <Textarea
                id="credit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Consulta Serasa março/2026"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetUploadForm}>Cancelar</Button>
            <Button
              onClick={() => selectedFile && uploadMutation.mutate({ file: selectedFile, desc: description })}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo "{docToDelete?.file_name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => docToDelete && deleteMutation.mutate(docToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
