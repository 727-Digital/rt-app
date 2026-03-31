import { useCallback, useEffect, useState } from 'react';
import { Copy, Image } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { fetchPhotos } from '@/lib/queries/photos';
import type { Photo } from '@/lib/types';

interface BeforeAfterGalleryProps {
  leadId: string;
}

function BeforeAfterGallery({ leadId }: BeforeAfterGalleryProps) {
  const [beforePhotos, setBeforePhotos] = useState<Photo[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [before, after] = await Promise.all([
        fetchPhotos(leadId, 'before'),
        fetchPhotos(leadId, 'after'),
      ]);
      setBeforePhotos(before);
      setAfterPhotos(after);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleShare() {
    const url = `${window.location.origin}/gallery/${leadId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return null;
  if (beforePhotos.length === 0 || afterPhotos.length === 0) return null;

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image size={16} className="text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-900">Before & After</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={handleShare}>
          <Copy size={14} />
          {copied ? 'Copied!' : 'Share'}
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <Badge variant="blue" className="mb-2">Before</Badge>
          <div className="flex flex-col gap-2">
            {beforePhotos.map((photo) => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? 'Before'}
                  className="w-full rounded-lg border border-slate-200 object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
        <div>
          <Badge variant="emerald" className="mb-2">After</Badge>
          <div className="flex flex-col gap-2">
            {afterPhotos.map((photo) => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? 'After'}
                  className="w-full rounded-lg border border-slate-200 object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export { BeforeAfterGallery };
