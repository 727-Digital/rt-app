import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { fetchPhotos, uploadPhoto, deletePhoto } from '@/lib/queries/photos';
import type { Photo } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PhotoCaptureProps {
  leadId: string;
  orgId: string | null;
  type: 'before' | 'after';
}

interface StagedFile {
  file: File;
  preview: string;
  caption: string;
}

function PhotoCapture({ leadId, orgId, type }: PhotoCaptureProps) {
  const [existing, setExisting] = useState<Photo[]>([]);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPhotos(leadId, type);
      setExisting(data);
    } finally {
      setLoading(false);
    }
  }, [leadId, type]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newStaged: StagedFile[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: '',
    }));
    setStaged((prev) => [...prev, ...newStaged]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeStaged(index: number) {
    setStaged((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateCaption(index: number, caption: string) {
    setStaged((prev) => prev.map((s, i) => (i === index ? { ...s, caption } : s)));
  }

  async function handleUploadAll() {
    if (!orgId || staged.length === 0) return;
    setUploading(true);
    try {
      for (const item of staged) {
        await uploadPhoto(item.file, leadId, orgId, type, item.caption || undefined);
        URL.revokeObjectURL(item.preview);
      }
      setStaged([]);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: string) {
    setDeleting(photoId);
    try {
      await deletePhoto(photoId);
      setExisting((prev) => prev.filter((p) => p.id !== photoId));
    } finally {
      setDeleting(null);
    }
  }

  const badgeVariant = type === 'before' ? 'blue' : 'emerald';
  const label = type === 'before' ? 'Before Photos' : 'After Photos';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
          <Badge variant={badgeVariant}>{existing.length}</Badge>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={14} />
          Add Photo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {staged.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {staged.map((item, i) => (
              <div key={i} className="relative flex flex-col gap-1.5">
                <div className="relative">
                  <img
                    src={item.preview}
                    alt="Staged"
                    className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                  />
                  <button
                    onClick={() => removeStaged(i)}
                    className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
                <Input
                  placeholder="Caption (optional)"
                  value={item.caption}
                  onChange={(e) => updateCaption(i, e.target.value)}
                  className="text-xs"
                />
              </div>
            ))}
          </div>
          <Button
            size="sm"
            onClick={handleUploadAll}
            loading={uploading}
            disabled={!orgId}
          >
            <Upload size={14} />
            Upload {staged.length} {staged.length === 1 ? 'Photo' : 'Photos'}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner size={18} />
        </div>
      ) : existing.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">
          No {type} photos yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {existing.map((photo) => (
            <div key={photo.id} className="group relative">
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={photo.url}
                  alt={photo.caption ?? type}
                  className="aspect-square w-full rounded-lg border border-slate-200 object-cover group-hover:opacity-90 transition-opacity"
                />
              </a>
              {photo.caption && (
                <p className="mt-1 truncate text-xs text-slate-500">{photo.caption}</p>
              )}
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={deleting === photo.id}
                className={cn(
                  'absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all',
                  deleting === photo.id && 'opacity-100',
                )}
              >
                {deleting === photo.id ? (
                  <Spinner size={12} />
                ) : (
                  <Trash2 size={12} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { PhotoCapture };
