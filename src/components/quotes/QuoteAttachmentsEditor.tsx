import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon, Download, Upload } from 'lucide-react';
import {
  fetchQuoteAttachments,
  uploadQuoteAttachment,
  deleteQuoteAttachment,
  type QuoteAttachment,
} from '@/lib/queries/quote_attachments';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface QuoteAttachmentsEditorProps {
  quoteId: string | null;
  orgId: string | null;
}

function isImage(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/');
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function QuoteAttachmentsEditor({ quoteId, orgId }: QuoteAttachmentsEditorProps) {
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      const list = await fetchQuoteAttachments(quoteId);
      setAttachments(list);
    } catch (e) {
      console.error('Failed to load attachments:', e);
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !quoteId || !orgId) return;
    setError(null);
    setUploading(true);
    try {
      // Upload sequentially. Parallel would be faster but if one fails
      // mid-flight the UI gets weird. Most reps will upload 1-3 at a time.
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          setError(`"${file.name}" is over 25 MB and was skipped.`);
          continue;
        }
        const a = await uploadQuoteAttachment(file, quoteId, orgId);
        setAttachments((prev) => [...prev, a]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected if needed.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(a: QuoteAttachment) {
    if (!confirm(`Delete ${a.file_name}?`)) return;
    try {
      await deleteQuoteAttachment(a);
      setAttachments((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (!quoteId) {
    return (
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Paperclip size={14} />
          Attachments
        </h2>
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Save the quote as a draft first, then you can attach photos and files.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Paperclip size={14} />
        Attachments {attachments.length > 0 && (
          <span className="text-xs font-normal text-slate-500">
            ({attachments.length})
          </span>
        )}
      </h2>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner size={20} />
          </div>
        ) : (
          <>
            {attachments.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    {isImage(a.mime_type) ? (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square"
                      >
                        <img
                          src={a.file_url}
                          alt={a.file_name}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex aspect-square flex-col items-center justify-center gap-2 p-3 hover:bg-slate-50"
                      >
                        <FileText size={32} className="text-slate-400" />
                        <span className="line-clamp-2 text-center text-xs text-slate-600">
                          {a.file_name}
                        </span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      className={cn(
                        'absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow opacity-0 transition-opacity hover:bg-white group-hover:opacity-100',
                        // Always visible on touch devices where hover doesn't exist
                        'sm:opacity-0',
                      )}
                      aria-label={`Delete ${a.file_name}`}
                    >
                      <X size={14} />
                    </button>
                    <div className="border-t border-slate-100 px-2 py-1">
                      <p className="truncate text-xs text-slate-700" title={a.file_name}>
                        {a.file_name}
                      </p>
                      {a.file_size && (
                        <p className="text-[10px] text-slate-400">
                          {formatFileSize(a.file_size)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="sr-only"
              id="quote-attachment-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
              disabled={!orgId}
              className="w-full sm:w-auto"
            >
              <Upload size={14} />
              {uploading ? 'Uploading...' : 'Add files'}
            </Button>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <p className="mt-2 text-xs text-slate-500">
              Photos, PDFs, anything — max 25 MB per file. Customer sees these
              on their quote page.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

// Read-only view for the public quote page. Renders the attachment list
// from data already in the quote payload — no fetch, no upload, no delete.
interface QuoteAttachmentsDisplayProps {
  attachments: Pick<QuoteAttachment, 'id' | 'file_name' | 'file_url' | 'mime_type' | 'file_size'>[];
}

function QuoteAttachmentsDisplay({ attachments }: QuoteAttachmentsDisplayProps) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="border-t border-slate-100 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Attachments
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {attachments.map((a) => (
          <a
            key={a.id}
            href={a.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg border border-slate-200 transition-shadow hover:shadow-md"
          >
            {isImage(a.mime_type) ? (
              <div className="aspect-square">
                <img
                  src={a.file_url}
                  alt={a.file_name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-slate-50 p-3">
                <Download size={28} className="text-slate-400" />
                <span className="line-clamp-2 text-center text-xs text-slate-600">
                  {a.file_name}
                </span>
              </div>
            )}
            <div className="border-t border-slate-100 bg-white px-2 py-1.5">
              <p className="truncate text-xs font-medium text-slate-700" title={a.file_name}>
                {isImage(a.mime_type) ? (
                  <ImageIcon size={10} className="mr-1 inline align-text-bottom text-slate-400" />
                ) : (
                  <FileText size={10} className="mr-1 inline align-text-bottom text-slate-400" />
                )}
                {a.file_name}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export { QuoteAttachmentsEditor, QuoteAttachmentsDisplay };
