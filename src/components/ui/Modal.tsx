import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      // dvh tracks the visual viewport on iOS when the keyboard appears, so
      // a modal with a focused input doesn't get hidden behind the keyboard.
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          // mx-3 (12px) on phone gives the modal more breathing room and
          // max-h uses dvh so iOS keyboard does not eat the bottom buttons.
          'relative w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl mx-3 sm:mx-4 max-h-[90dvh]',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            // 44x44 tap target per Apple HIG. Was a tiny 28px box before.
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

export { Modal };
export type { ModalProps };
