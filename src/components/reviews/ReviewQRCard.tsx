import { useCallback, useRef, useState } from 'react';
import { Check, Copy, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReviewQRCardProps {
  leadName: string;
  reviewUrl: string;
}

function ReviewQRCard({ leadName, reviewUrl }: ReviewQRCardProps) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(reviewUrl)}`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [reviewUrl]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          [data-review-card], [data-review-card] * { visibility: visible !important; }
          [data-review-card] {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 4in;
            height: 6in;
            box-shadow: none !important;
          }
          [data-no-print] { display: none !important; }
        }
      `}</style>

      <div
        ref={cardRef}
        data-review-card
        className="mx-auto w-full max-w-sm rounded-xl border-2 border-emerald-200 bg-white p-6"
        style={{ aspectRatio: '4 / 6' }}
      >
        <div className="flex h-full flex-col items-center justify-between text-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-emerald-700">
              Reliable Turf
            </h2>
            <div className="mx-auto mt-1 h-0.5 w-12 rounded-full bg-emerald-300" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-800">
              Thank you, {leadName}!
            </h3>
            <p className="text-sm leading-relaxed text-slate-500">
              We'd love your feedback! Scan the QR code below to leave us a Google review.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <img
                src={qrUrl}
                alt="Review QR Code"
                width={160}
                height={160}
                className="block"
              />
            </div>
            <p className="max-w-[260px] break-all text-xs text-slate-400">
              {reviewUrl}
            </p>
          </div>

          <div className="text-2xl tracking-wider" aria-label="5 stars">
            <span className="text-amber-400">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          </div>

          <p className="text-sm font-medium text-emerald-600">
            Thank you for choosing Reliable Turf!
          </p>
        </div>
      </div>

      <div data-no-print className="mt-4 flex items-center justify-center gap-3">
        <Button size="sm" variant="secondary" onClick={handlePrint}>
          <Printer size={14} />
          Print Card
        </Button>
        <Button size="sm" variant="secondary" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
      </div>
    </div>
  );
}

export { ReviewQRCard };
