import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { cn } from '@/lib/utils';

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * In-card thumbnail that opens a full-screen pinch-zoom viewer on tap.
 * Stays inside the app — does NOT link out to the source URL.
 *
 * Uses react-zoom-pan-pinch for trackpad/touch pinch + pan. Backdrop blocks
 * background scroll so the gesture lands on the image, not the page.
 */
export function ZoomableImage({ src, alt, className }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the viewer is open so iOS doesn't pan the page
  // behind the modal during pinch gestures.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'relative w-full overflow-hidden rounded-lg border border-slate-200 transition-opacity hover:opacity-90',
          className,
        )}
        aria-label="Open aerial view"
      >
        <img src={src} alt={alt} className="block w-full" />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
          Tap to zoom
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur active:bg-white/25"
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={8}
              doubleClick={{ mode: 'toggle', step: 3 }}
              wheel={{ step: 0.2 }}
              pinch={{ step: 5 }}
              centerOnInit
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img
                  src={src}
                  alt={alt}
                  className="max-h-full max-w-full select-none"
                  draggable={false}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      )}
    </>
  );
}
