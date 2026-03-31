import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

interface PaymentQRProps {
  quoteId: string;
  total: number;
}

function PaymentQR({ quoteId, total }: PaymentQRProps) {
  const [copied, setCopied] = useState(false);
  const paymentUrl = `${window.location.origin}/q/${quoteId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentUrl)}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src={qrUrl}
        alt="Payment QR code"
        width={200}
        height={200}
        className="rounded-lg border border-slate-200"
      />
      <p className="text-sm font-medium text-slate-600">Scan to pay</p>
      <p className="text-lg font-bold text-slate-900">{formatCurrency(total)}</p>
      <Button variant="secondary" size="sm" onClick={handleCopy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy Payment Link'}
      </Button>
    </div>
  );
}

export { PaymentQR };
